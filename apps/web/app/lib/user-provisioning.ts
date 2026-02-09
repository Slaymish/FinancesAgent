import { prisma } from "./prisma";

const LEGACY_USER_ID = "legacy-user";

export async function migrateLegacyDataToUser(userId: string) {
  if (!userId || userId === LEGACY_USER_ID) return;

  const [legacyNonDemoCount, userNonDemoCount, userDemoCount] = await Promise.all([
    prisma.transaction.count({
      where: {
        userId: LEGACY_USER_ID,
        source: { not: "demo" }
      }
    }),
    prisma.transaction.count({
      where: {
        userId,
        source: { not: "demo" }
      }
    }),
    prisma.transaction.count({
      where: {
        userId,
        source: "demo"
      }
    })
  ]);

  // If demo rows were previously migrated into a real user, remove them.
  if (userDemoCount > 0) {
    await prisma.transaction.deleteMany({
      where: {
        userId,
        source: "demo"
      }
    });
  }

  // Only migrate legacy rows that represent real data.
  if (legacyNonDemoCount === 0 || userNonDemoCount > 0) return;

  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: {
        userId: LEGACY_USER_ID,
        source: { not: "demo" }
      },
      data: { userId }
    }),
    prisma.categoryRule.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.pipelineRun.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.bankAccount.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.financeSyncState.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } })
  ]);
}
