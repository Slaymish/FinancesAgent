import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";
import { computeMetricsPack } from "../finance/metrics.js";
import { retrainModelForUserIfNeeded } from "../ml/service.js";

type CategorySummary = {
  category: string;
  count: number;
  expenseTotal: number;
  incomeTotal: number;
  lastDate: string | null;
};

export async function transactionRoutes(app: FastifyInstance) {
  app.get("/summary", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const now = new Date();
    const metricsStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

    const [metricTransactions, latestTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: user.id, date: { gte: metricsStart } },
        orderBy: { date: "asc" }
      }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 50
      })
    ]);

    const metricsPack = computeMetricsPack(metricTransactions, now);

    reply.send({
      ok: true,
      metricsPack,
      latestTransactions
    });
  });

  app.get("/categories", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const query = req.query as { category?: string; limit?: string };
    const selectedInput = query.category?.trim();
    const limitRaw = parseInt(query.limit ?? "200", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

    const rows = await prisma.transaction.findMany({
      where: { userId: user.id },
      select: {
        category: true,
        amount: true,
        date: true
      }
    });

    const summaryMap = new Map<string, CategorySummary>();
    for (const row of rows) {
      const category = row.category.trim() || "Uncategorised";
      const existing = summaryMap.get(category);
      const isExpense = row.amount < 0;
      const amountAbs = Math.abs(row.amount);

      if (!existing) {
        summaryMap.set(category, {
          category,
          count: 1,
          expenseTotal: isExpense ? amountAbs : 0,
          incomeTotal: isExpense ? 0 : row.amount,
          lastDate: row.date.toISOString()
        });
      } else {
        existing.count += 1;
        if (isExpense) {
          existing.expenseTotal += amountAbs;
        } else {
          existing.incomeTotal += row.amount;
        }
        if (!existing.lastDate || row.date.toISOString() > existing.lastDate) {
          existing.lastDate = row.date.toISOString();
        }
      }
    }

    const categories = Array.from(summaryMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.category.localeCompare(b.category);
    });

    const selectedCategory =
      selectedInput && categories.some((row) => row.category === selectedInput)
        ? selectedInput
        : (categories[0]?.category ?? null);

    const transactions = selectedCategory
      ? await prisma.transaction.findMany({
          where: { userId: user.id, category: selectedCategory },
          orderBy: { date: "desc" },
          take: limit,
          select: {
            id: true,
            date: true,
            merchantName: true,
            descriptionRaw: true,
            amount: true,
            accountName: true,
            category: true
          }
        })
      : [];

    reply.send({
      ok: true,
      categories,
      selectedCategory,
      transactions
    });
  });

  app.put("/:id/category", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const { id } = req.params as { id: string };
    const body = req.body as { category?: string } | undefined;
    if (typeof body?.category !== "string") {
      reply.code(400).send({ error: "missing_category" });
      return;
    }

    const category = body.category.trim() || "Uncategorised";
    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      select: { id: true }
    });

    if (!existing) {
      reply.code(404).send({ error: "transaction_not_found" });
      return;
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        category,
        categoryType: "",
        categoryConfirmed: true,
        confirmedAt: new Date(),
        classificationSource: "user",
        inboxState: "cleared",
        suggestedCategoryId: null,
        confidence: null
      }
    });

    let modelRetrained = false;
    let warning: string | undefined;
    try {
      modelRetrained = await retrainModelForUserIfNeeded(user.id);
    } catch (error) {
      req.log.warn({ err: error, userId: user.id }, "transaction_category_retrain_failed");
      warning = "model_retrain_failed";
    }

    reply.send({
      ok: true,
      transaction,
      modelRetrained,
      ...(warning ? { warning } : {})
    });
  });
}
