import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";
import {
  getPredictionContextForUser,
  predictCategoryWithContext,
  reclassifyTransactionsForUser,
  retrainAndReclassifyIfNeeded
} from "../ml/service.js";

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

    const [transactions, total, predictionContext] = await Promise.all([
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
      getPredictionContextForUser(user.id)
    ]);

    const suggestedTransactions = transactions.map((tx) => {
      if (tx.suggestedCategoryId) {
        return tx;
      }

      const prediction = predictCategoryWithContext(predictionContext, {
        merchantNormalised: tx.merchantName,
        descriptionRaw: tx.descriptionRaw,
        amount: tx.amount,
        accountId: tx.accountName,
        date: tx.date
      });
      if (prediction) {
        return {
          ...tx,
          suggestedCategoryId: prediction.category,
          confidence: prediction.confidence
        };
      }

      return {
        ...tx,
        suggestedCategoryId: "Uncategorised",
        confidence: tx.confidence ?? 0
      };
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

    let modelRetrained = false;
    let reclassified = 0;
    let warning: string | undefined;

    try {
      const result = await retrainAndReclassifyIfNeeded({
        userId: user.id,
        threshold: user.modelAutoThreshold
      });
      modelRetrained = result.retrained;
      reclassified = result.reclassified;
    } catch (error) {
      req.log.warn({ err: error, userId: user.id }, "inbox_confirm_retrain_failed");
      warning = "model_retrain_failed";
    }

    reply.send({
      ok: true,
      transaction: updated,
      modelRetrained,
      reclassified,
      ...(warning ? { warning } : {})
    });
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

    const startDate = body.startDate ? new Date(body.startDate) : undefined;
    const endDate = body.endDate ? new Date(body.endDate) : undefined;

    const reprocessed = await reclassifyTransactionsForUser({
      userId: user.id,
      threshold: user.modelAutoThreshold,
      options: { startDate, endDate }
    });

    reply.send({ ok: true, reprocessed });
  });
}
