import { prisma } from "./prisma";

const LEGACY_USER_ID = "legacy-user";

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
