import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";
import { AkahuClient } from "../akahu/client.js";
import { buildCategoriser } from "../akahu/categoriser.js";
import { computeMetricsPack } from "../finance/metrics.js";

function parseIsoDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function subtractMs(date: Date, ms: number): Date {
  return new Date(date.getTime() - ms);
}

export async function pipelineRoutes(app: FastifyInstance) {
  app.post("/run", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env, allowPipelineToken: true });
    if (!user) return;

    if (!env.AKAHU_APP_TOKEN || !env.AKAHU_USER_TOKEN) {
      reply.code(400).send({ error: "missing_akahu_tokens" });
      return;
    }

    const now = new Date();
    const syncState = await prisma.financeSyncState.findUnique({ where: { userId: user.id } });
    const fallbackStart = new Date(now.getTime() - env.AKAHU_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const start = syncState?.lastSyncedAt ? subtractMs(syncState.lastSyncedAt, 1) : fallbackStart;

    const client = new AkahuClient({
      userToken: env.AKAHU_USER_TOKEN,
      appToken: env.AKAHU_APP_TOKEN,
      baseUrl: env.AKAHU_BASE_URL,
      pageSize: env.AKAHU_PAGE_SIZE
    });

    const accounts = await client.fetchAccounts();
    if (accounts.length > 0) {
      await prisma.$transaction(
        accounts.map((account) =>
          prisma.bankAccount.upsert({
            where: { userId_akahuId: { userId: user.id, akahuId: account.id } },
            update: {
              name: account.name,
              institution: account.institution,
              type: account.type,
              status: account.status,
              currency: account.currency
            },
            create: {
              userId: user.id,
              akahuId: account.id,
              name: account.name,
              institution: account.institution,
              type: account.type,
              status: account.status,
              currency: account.currency
            }
          })
        )
      );
    }

    const rules = await prisma.categoryRule.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" }
    });
    const categoriser = buildCategoriser(rules);

    const transactions = await client.fetchSettledTransactions({ start, end: now });
    const upserts = transactions.map((tx) => {
      const { category, categoryType } = categoriser.categorise({
        amount: tx.amount,
        descriptionRaw: tx.descriptionRaw,
        merchantName: tx.merchantName
      });
      const isTransfer = categoriser.detectTransfer({
        amount: tx.amount,
        descriptionRaw: tx.descriptionRaw,
        merchantName: tx.merchantName
      });
      const date = parseIsoDate(tx.date);
      return prisma.transaction.upsert({
        where: { userId_akahuId: { userId: user.id, akahuId: tx.id } },
        update: {
          date,
          accountName: tx.accountName,
          amount: tx.amount,
          balance: tx.balance,
          descriptionRaw: tx.descriptionRaw,
          merchantName: tx.merchantName,
          category,
          categoryType,
          isTransfer,
          source: tx.source,
          importedAt: now
        },
        create: {
          userId: user.id,
          akahuId: tx.id,
          date,
          accountName: tx.accountName,
          amount: tx.amount,
          balance: tx.balance,
          descriptionRaw: tx.descriptionRaw,
          merchantName: tx.merchantName,
          category,
          categoryType,
          isTransfer,
          source: tx.source,
          importedAt: now
        }
      });
    });

    if (upserts.length > 0) {
      await prisma.$transaction(upserts);
    }

    await prisma.financeSyncState.upsert({
      where: { userId: user.id },
      update: { lastSyncedAt: now },
      create: { userId: user.id, lastSyncedAt: now }
    });

    const metricsStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const metricTransactions = await prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: metricsStart } },
      orderBy: { date: "asc" }
    });
    const metricsPack = computeMetricsPack(metricTransactions, now);

    const pipelineRun = await prisma.pipelineRun.create({
      data: {
        userId: user.id,
        metricsPack,
        processedCount: transactions.length
      }
    });

    reply.send({
      ok: true,
      processed: transactions.length,
      pipelineRunId: pipelineRun.id,
      metricsPack
    });
  });

  app.get("/latest", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const latest = await prisma.pipelineRun.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });

    reply.send({ ok: true, latest });
  });
}
