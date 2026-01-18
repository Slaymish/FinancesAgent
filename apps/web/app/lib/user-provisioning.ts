import { LEGACY_USER_ID } from "@health-agent/shared";
import { prisma } from "./prisma";
import { generateIngestToken, hashToken } from "./tokens";

export async function ensureUserHasIngestToken(userId: string): Promise<{ preview: string; token?: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ingestTokenHash: true, ingestTokenPreview: true }
  });
  if (!user) return null;

  if (user.ingestTokenHash && user.ingestTokenHash.length === 64) {
    return { preview: user.ingestTokenPreview };
  }

  const token = generateIngestToken();
  const hash = hashToken(token);
  const preview = token.slice(-6);

  await prisma.user.update({
    where: { id: userId },
    data: { ingestTokenHash: hash, ingestTokenPreview: preview }
  });

  return { token, preview };
}

export async function migrateLegacyDataToUser(userId: string) {
  if (!userId || userId === LEGACY_USER_ID) return;

  const [legacyIngestCount, userIngestCount] = await Promise.all([
    prisma.ingestFile.count({ where: { userId: LEGACY_USER_ID } }),
    prisma.ingestFile.count({ where: { userId } })
  ]);

  if (legacyIngestCount === 0) return;
  if (userIngestCount > 0) return;

  await prisma.$transaction([
    prisma.ingestFile.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.dailyWeight.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.dailyNutrition.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.dailyVitals.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.sleepSession.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.workout.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.pipelineRun.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } }),
    prisma.insightsDoc.updateMany({ where: { userId: LEGACY_USER_ID }, data: { userId } })
  ]);
}
