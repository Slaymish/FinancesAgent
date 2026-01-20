import { LEGACY_USER_ID } from "@finance-agent/shared";
import { prisma } from "./prisma";

export async function migrateLegacyDataToUser(userId: string) {
  if (!userId || userId === LEGACY_USER_ID) return;

  const [legacyCount, userCount] = await Promise.all([
    prisma.transaction.count({ where: { userId: LEGACY_USER_ID } }),
    prisma.transaction.count({ where: { userId } })
  ]);

  if (legacyCount === 0 || userCount > 0) return;

  await prisma.$transaction([
    prisma.transaction.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.categoryRule.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.pipelineRun.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.bankAccount.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.financeSyncState.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } })
  ]);
}

export async function seedDefaultCategoryRules(userId: string) {
  const existing = await prisma.categoryRule.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.categoryRule.createMany({
    data: [
      {
        userId,
        pattern: "COUNTDOWN|PAKNSAVE|NEW WORLD",
        field: "merchant_normalised",
        category: "Groceries",
        categoryType: "essential",
        priority: 10
      },
      {
        userId,
        pattern: "RENT|MORTGAGE",
        field: "description_raw",
        category: "Housing",
        categoryType: "essential",
        priority: 5
      },
      {
        userId,
        pattern: "UBER|EATS|DOORDASH|DELIVEROO",
        field: "merchant_normalised",
        category: "Takeaway",
        categoryType: "want",
        priority: 20
      },
      {
        userId,
        pattern: "KIWISAVER|INVEST|BROKER",
        field: "description_raw",
        category: "Investing",
        categoryType: "saving",
        priority: 15
      }
    ]
  });
}
