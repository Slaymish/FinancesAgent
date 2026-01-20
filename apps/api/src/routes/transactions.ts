import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";
import { computeMetricsPack } from "../finance/metrics.js";

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
}
