import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";
import { buildCategoriser } from "../akahu/categoriser.js";

type CategoryRulePayload = {
  id?: string;
  pattern?: string;
  field?: string;
  category?: string;
  categoryType?: string;
  priority?: number;
  amountCondition?: string | null;
  isDisabled?: boolean;
};

function normalizeRule(input: CategoryRulePayload, index: number) {
  const pattern = (input.pattern ?? "").trim();
  const category = (input.category ?? "Uncategorised").trim() || "Uncategorised";
  const categoryType = (input.categoryType ?? "").trim();
  const field = input.field === "description_raw" ? "description_raw" : "merchant_normalised";
  const priority = Number.isFinite(input.priority) ? Number(input.priority) : index + 1;
  const amountCondition = input.amountCondition?.trim() || null;

  return {
    pattern,
    category,
    categoryType,
    field,
    priority,
    amountCondition,
    isDisabled: Boolean(input.isDisabled)
  };
}

export async function categoryRoutes(app: FastifyInstance) {
  app.get("/", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const rules = await prisma.categoryRule.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" }
    });

    reply.send({ ok: true, rules });
  });

  app.put("/", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const body = req.body as { rules?: CategoryRulePayload[] } | undefined;
    const incoming = Array.isArray(body?.rules) ? body.rules : [];
    const normalized = incoming.map((rule, index) => normalizeRule(rule, index)).filter((rule) => rule.pattern);

    await prisma.$transaction([
      prisma.categoryRule.deleteMany({ where: { userId: user.id } }),
      ...(normalized.length
        ? [
            prisma.categoryRule.createMany({
              data: normalized.map((rule) => ({
                userId: user.id,
                pattern: rule.pattern,
                field: rule.field,
                category: rule.category,
                categoryType: rule.categoryType,
                priority: rule.priority,
                amountCondition: rule.amountCondition,
                isDisabled: rule.isDisabled
              }))
            })
          ]
        : [])
    ]);

    reply.send({ ok: true, count: normalized.length });
  });

  app.post("/reapply", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const transferDetector = buildCategoriser([]);

    // Load model
    const { loadModelForUser, getFallbackSuggestedCategory } = await import("../ml/service.js");
    const { computeInboxState } = await import("../ml/inboxState.js");
    const { extractFeatures } = await import("../ml/index.js");
    const { predict: predictWithModel } = await import("../ml/model.js");
    
    const model = await loadModelForUser(user.id);
    const fallbackSuggestedCategory = model ? null : await getFallbackSuggestedCategory(user.id);

    const transactions: Array<{ 
      id: string; 
      amount: number; 
      descriptionRaw: string; 
      merchantName: string;
      accountName: string;
      date: Date;
    }> = await prisma.transaction.findMany({
      where: { userId: user.id },
      select: { 
        id: true, 
        amount: true, 
        descriptionRaw: true, 
        merchantName: true,
        accountName: true,
        date: true
      }
    });

    const updates = transactions.map((tx) => {
      const isTransfer = transferDetector.detectTransfer({
        amount: tx.amount,
        descriptionRaw: tx.descriptionRaw,
        merchantName: tx.merchantName
      });

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
          isTransfer,
          inboxState: inboxResult.inboxState,
          classificationSource: inboxResult.classificationSource,
          suggestedCategoryId: inboxResult.suggestedCategoryId,
          confidence: inboxResult.confidence
        }
      });
    });

    for (let i = 0; i < updates.length; i += 100) {
      await prisma.$transaction(updates.slice(i, i + 100));
    }

    reply.send({ ok: true, updated: updates.length });
  });
}
