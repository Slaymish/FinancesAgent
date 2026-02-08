import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";
import { computeInboxState } from "../ml/inboxState.js";
import { extractFeatures } from "../ml/index.js";
import { predict as predictWithModel } from "../ml/model.js";
import { getFallbackSuggestedCategory, loadModelForUser } from "../ml/service.js";

export async function inboxRoutes(app: FastifyInstance) {
  /**
   * GET /api/inbox
   * Get paginated inbox transactions (needs_review + unclassified)
   */
  app.get("/", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const query = req.query as { page?: string; perPage?: string };
    const page = parseInt(query.page || "1", 10);
    const perPage = Math.min(parseInt(query.perPage || "50", 10), 100);
    const skip = (page - 1) * perPage;

    const [transactions, total, model] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          inboxState: { in: ["needs_review", "unclassified"] }
        },
        orderBy: { date: "desc" },
        skip,
        take: perPage
      }),
      prisma.transaction.count({
        where: {
          userId: user.id,
          inboxState: { in: ["needs_review", "unclassified"] }
        }
      }),
      loadModelForUser(user.id)
    ]);

    const fallbackSuggestedCategory = model ? null : await getFallbackSuggestedCategory(user.id);
    const suggestedTransactions = transactions.map((tx) => {
      if (tx.suggestedCategoryId || tx.inboxState !== "unclassified") {
        return tx;
      }

      if (model) {
        const features = extractFeatures({
          merchantNormalised: tx.merchantName,
          descriptionRaw: tx.descriptionRaw,
          amount: tx.amount,
          accountId: tx.accountName,
          date: tx.date
        });
        const pred = predictWithModel(model, features);
        return {
          ...tx,
          suggestedCategoryId: pred.category,
          confidence: pred.confidence
        };
      }

      if (fallbackSuggestedCategory) {
        return {
          ...tx,
          suggestedCategoryId: fallbackSuggestedCategory,
          confidence: 0
        };
      }

      return tx;
    });

    reply.send({
      ok: true,
      transactions: suggestedTransactions,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    });
  });

  /**
   * POST /api/inbox/:id/confirm
   * Confirm/set category for a transaction
   */
  app.post("/:id/confirm", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const { id } = req.params as { id: string };
    const body = req.body as { categoryId: string; categoryType?: string };

    if (!body.categoryId) {
      reply.code(400).send({ error: "missing_category_id" });
      return;
    }

    // Get transaction
    const tx = await prisma.transaction.findFirst({
      where: { id, userId: user.id }
    });

    if (!tx) {
      reply.code(404).send({ error: "transaction_not_found" });
      return;
    }

    // Update transaction
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        category: body.categoryId,
        categoryType: body.categoryType || "",
        categoryConfirmed: true,
        confirmedAt: new Date(),
        classificationSource: "user",
        inboxState: "cleared",
        confidence: null,
        suggestedCategoryId: null
      }
    });

    reply.send({ ok: true, transaction: updated });
  });

  /**
   * GET /api/inbox/stats
   * Get inbox statistics (count, streak, auto-classified %)
   */
  app.get("/stats", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    // Count transactions to clear
    const toClearCount = await prisma.transaction.count({
      where: {
        userId: user.id,
        inboxState: { in: ["needs_review", "unclassified"] }
      }
    });

    // Calculate streak (days with inbox cleared)
    // For MVP, we'll calculate this as consecutive days where inbox was at 0 at some point
    const now = new Date();
    
    // Get transactions confirmed in last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentConfirmed = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        confirmedAt: { gte: thirtyDaysAgo }
      },
      select: { confirmedAt: true },
      orderBy: { confirmedAt: "desc" }
    });

    // Simple streak calculation: count consecutive days with confirmations
    let streak = 0;
    const seenDates = new Set<string>();
    
    for (const tx of recentConfirmed) {
      if (!tx.confirmedAt) continue;
      const dateStr = tx.confirmedAt.toISOString().split("T")[0];
      if (dateStr) {
        seenDates.add(dateStr);
      }
    }

    const sortedDates = Array.from(seenDates).sort().reverse();
    for (let i = 0; i < sortedDates.length; i++) {
      const expectedDate = new Date(now);
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().split("T")[0];
      
      if (sortedDates[i] === expectedDateStr) {
        streak++;
      } else {
        break;
      }
    }

    // Calculate auto-classified % over last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [autoClassified, totalRecent] = await Promise.all([
      prisma.transaction.count({
        where: {
          userId: user.id,
          importedAt: { gte: sevenDaysAgo },
          inboxState: "auto_classified"
        }
      }),
      prisma.transaction.count({
        where: {
          userId: user.id,
          importedAt: { gte: sevenDaysAgo }
        }
      })
    ]);

    const autoClassifiedPercent = totalRecent > 0 ? (autoClassified / totalRecent) * 100 : 0;

    reply.send({
      ok: true,
      toClearCount,
      streak,
      autoClassifiedPercent: Math.round(autoClassifiedPercent)
    });
  });

  /**
   * POST /api/inbox/reprocess
   * Reprocess transactions to update inbox states
   */
  app.post("/reprocess", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const body = req.body as { startDate?: string; endDate?: string };

    // Build date filter
    type DateFilter = { gte?: Date; lte?: Date };
    const dateFilter: DateFilter = {};
    if (body.startDate) {
      dateFilter.gte = new Date(body.startDate);
    }
    if (body.endDate) {
      dateFilter.lte = new Date(body.endDate);
    }

    // Get transactions to reprocess
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      },
      select: {
        id: true,
        amount: true,
        descriptionRaw: true,
        merchantName: true,
        accountName: true,
        date: true
      }
    });

    // Load model (or fallback suggestion category when model is unavailable)
    const model = await loadModelForUser(user.id);
    const fallbackSuggestedCategory = model ? null : await getFallbackSuggestedCategory(user.id);

    // Reprocess each transaction
    const updates = transactions.map((tx) => {
      // Compute inbox state
      let modelPrediction = null;
      if (model) {
        const features = extractFeatures({
          merchantNormalised: tx.merchantName,
          descriptionRaw: tx.descriptionRaw,
          amount: tx.amount,
          accountId: tx.accountName,
          date: tx.date
        });
        const pred = predictWithModel(model, features);
        modelPrediction = {
          category: pred.category,
          categoryType: "",
          confidence: pred.confidence
        };
      } else if (fallbackSuggestedCategory) {
        modelPrediction = {
          category: fallbackSuggestedCategory,
          categoryType: "",
          confidence: 0
        };
      }

      const inboxResult = computeInboxState({
        modelPrediction,
        threshold: user.modelAutoThreshold
      });

      return prisma.transaction.update({
        where: { id: tx.id },
        data: {
          category: inboxResult.category,
          categoryType: inboxResult.categoryType,
          inboxState: inboxResult.inboxState,
          classificationSource: inboxResult.classificationSource,
          suggestedCategoryId: inboxResult.suggestedCategoryId,
          confidence: inboxResult.confidence
        }
      });
    });

    // Execute in batches
    for (let i = 0; i < updates.length; i += 100) {
      await prisma.$transaction(updates.slice(i, i + 100));
    }

    reply.send({ ok: true, reprocessed: updates.length });
  });
}
