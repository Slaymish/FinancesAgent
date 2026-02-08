import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";
import { AkahuClient } from "../akahu/client.js";
import { buildCategoriser } from "../akahu/categoriser.js";
import { computeMetricsPack } from "../finance/metrics.js";
import { sanitizeInsightsMarkdown } from "../insights/sanitize.js";
import { generateInsightsUnifiedDiff } from "../insights/llm.js";
import { applyUnifiedDiff } from "../insights/patch.js";

function subtractMs(date: Date, ms: number): Date {
  return new Date(date.getTime() - ms);
}

function safeParseIsoDate(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

async function runBatchedTransactions(operations: Prisma.PrismaPromise<unknown>[], batchSize: number) {
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    await prisma.$transaction(batch);
  }
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
    try {
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
        await runBatchedTransactions(
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
          ),
          100
        );
      }

      const rules = await prisma.categoryRule.findMany({
        where: { userId: user.id },
        orderBy: { priority: "asc" }
      });
      const categoriser = buildCategoriser(rules);

      // Load model for predictions
      const { loadModelForUser } = await import("../ml/service.js");
      const { computeInboxState } = await import("../ml/inboxState.js");
      const { extractFeatures } = await import("../ml/index.js");
      const { predict: predictWithModel } = await import("../ml/model.js");
      
      const model = await loadModelForUser(user.id);

      const transactions = await client.fetchSettledTransactions({ start, end: now });
      if (transactions.length > 0) {
        const operations = transactions.map((tx) => {
          const ruleResult = categoriser.categorise({
            amount: tx.amount,
            descriptionRaw: tx.descriptionRaw,
            merchantName: tx.merchantName
          });
          
          const isTransfer = categoriser.detectTransfer({
            amount: tx.amount,
            descriptionRaw: tx.descriptionRaw,
            merchantName: tx.merchantName
          });

          // Compute inbox state using state machine
          let modelPrediction = null;
          if (!ruleResult.matched && model) {
            const features = extractFeatures({
              merchantNormalised: tx.merchantName,
              descriptionRaw: tx.descriptionRaw,
              amount: tx.amount,
              accountId: tx.accountName,
              date: safeParseIsoDate(tx.date, now)
            });
            const pred = predictWithModel(model, features);
            modelPrediction = {
              category: pred.category,
              categoryType: "", // We don't store categoryType in model
              confidence: pred.confidence
            };
          }

          const inboxResult = computeInboxState({
            ruleMatch: ruleResult.matched
              ? { category: ruleResult.category, categoryType: ruleResult.categoryType, confidence: 1.0, source: "rule" as const }
              : null,
            modelPrediction,
            threshold: user.modelAutoThreshold
          });

          const date = safeParseIsoDate(tx.date, now);
          return prisma.transaction.upsert({
            where: { userId_akahuId: { userId: user.id, akahuId: tx.id } },
            update: {
              date,
              accountName: tx.accountName,
              amount: tx.amount,
              balance: tx.balance,
              descriptionRaw: tx.descriptionRaw,
              merchantName: tx.merchantName,
              category: inboxResult.category,
              categoryType: inboxResult.categoryType,
              isTransfer,
              source: tx.source,
              importedAt: now,
              inboxState: inboxResult.inboxState,
              classificationSource: inboxResult.classificationSource,
              suggestedCategoryId: inboxResult.suggestedCategoryId,
              confidence: inboxResult.confidence
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
              category: inboxResult.category,
              categoryType: inboxResult.categoryType,
              isTransfer,
              source: tx.source,
              importedAt: now,
              inboxState: inboxResult.inboxState,
              classificationSource: inboxResult.classificationSource,
              suggestedCategoryId: inboxResult.suggestedCategoryId,
              confidence: inboxResult.confidence
            }
          });
        });

        await runBatchedTransactions(operations, 100);
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

      const manualProfile = await prisma.manualFinanceProfile.findUnique({ where: { userId: user.id } });
      const consolidatedData = {
        metricsPack,
        manualData: manualProfile?.data ?? null
      };

      const pipelineRun = await prisma.pipelineRun.create({
        data: {
          userId: user.id,
          metricsPack,
          processedCount: transactions.length
        }
      });

      const warnings: string[] = [];

      if (env.INSIGHTS_ENABLED) {
        const prev = await prisma.insightsDoc.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

        if (!prev) {
          const sanitized = sanitizeInsightsMarkdown("## Financial synthesis\n- Awaiting next update.\n");
          await prisma.insightsDoc.create({
            data: {
              userId: user.id,
              markdown: sanitized.markdown,
              diffFromPrev: null,
              metricsPack: consolidatedData as any,
              pipelineRunId: pipelineRun.id
            }
          });
        } else {
          let nextMarkdown = prev.markdown;
          let diffFromPrev: string | null = null;

          try {
            const diff = await generateInsightsUnifiedDiff({
              apiKey: env.OPENAI_API_KEY || "",
              model: env.INSIGHTS_MODEL || "",
              previousMarkdown: prev.markdown,
              metricsPack: consolidatedData,
              systemPrompt: user.insightsSystemPrompt
            });

            nextMarkdown = applyUnifiedDiff({ previous: prev.markdown, patch: diff });
            diffFromPrev = diff;
          } catch (err) {
            warnings.push(`Insights update failed: ${err instanceof Error ? err.message : String(err)}`);
          }

          const sanitized = sanitizeInsightsMarkdown(nextMarkdown);
          if (sanitized.changed) {
            warnings.push("Insights markdown normalized to bullet-only format.");
            diffFromPrev = null;
          }
          nextMarkdown = sanitized.markdown;

          await prisma.insightsDoc.create({
            data: {
              userId: user.id,
              markdown: nextMarkdown,
              diffFromPrev,
              metricsPack: consolidatedData as any,
              pipelineRunId: pipelineRun.id
            }
          });
        }
      }

      // Train model if needed
      const { shouldRetrainModel, trainModelForUser } = await import("../ml/service.js");
      try {
        if (await shouldRetrainModel(user.id)) {
          await trainModelForUser(user.id);
          warnings.push("Model retrained with new confirmed labels");
        }
      } catch (err) {
        warnings.push(`Model training skipped: ${err instanceof Error ? err.message : String(err)}`);
      }

      reply.send({
        ok: true,
        processed: transactions.length,
        pipelineRunId: pipelineRun.id,
        warnings,
        metricsPack
      });
    } catch (error) {
      req.log.error({ err: error }, "pipeline_run_failed");
      reply.status(500).send({ ok: false, error: "pipeline_failed" });
    }
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
