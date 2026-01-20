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

    const rules = await prisma.categoryRule.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" }
    });
    const categoriser = buildCategoriser(rules);

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      select: { id: true, amount: true, descriptionRaw: true, merchantName: true }
    });

    const updates = transactions.map((tx) => {
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
      return prisma.transaction.update({
        where: { id: tx.id },
        data: { category, categoryType, isTransfer }
      });
    });

    for (let i = 0; i < updates.length; i += 100) {
      await prisma.$transaction(updates.slice(i, i + 100));
    }

    reply.send({ ok: true, updated: updates.length });
  });
}
