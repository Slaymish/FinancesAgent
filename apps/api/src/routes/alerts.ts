import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";

const INGEST_ALERT_HOURS = 36;

interface AlertCheckResult {
  ok: boolean;
  alerts: {
    type: string;
    message: string;
    details?: unknown;
  }[];
}

async function checkIngestAlert(userId: string): Promise<AlertCheckResult["alerts"][number] | null> {
  const syncState = await prisma.financeSyncState.findUnique({
    where: { userId }
  });

  if (!syncState?.lastSyncedAt) {
    return {
      type: "ingest_never_synced",
      message: "Finance data has never been synced. Please run the pipeline.",
      details: { lastSyncedAt: null }
    };
  }

  const hoursSinceSync = (Date.now() - syncState.lastSyncedAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceSync > INGEST_ALERT_HOURS) {
    return {
      type: "ingest_stale",
      message: `Finance data is stale (last sync ${Math.round(hoursSinceSync)} hours ago). Pipeline may need attention.`,
      details: {
        lastSyncedAt: syncState.lastSyncedAt.toISOString(),
        hoursSinceSync: Math.round(hoursSinceSync * 10) / 10,
        thresholdHours: INGEST_ALERT_HOURS
      }
    };
  }

  return null;
}

export async function alertsRoutes(app: FastifyInstance) {
  app.get("/check", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const alerts: AlertCheckResult["alerts"] = [];

    const ingestAlert = await checkIngestAlert(user.id);
    if (ingestAlert) {
      alerts.push(ingestAlert);
    }

    const result: AlertCheckResult = {
      ok: alerts.length === 0,
      alerts
    };

    reply.send(result);
  });
}
