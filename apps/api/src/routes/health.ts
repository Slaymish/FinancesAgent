import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";

interface HealthCheckResult {
  ok: boolean;
  checks: {
    name: string;
    status: "pass" | "fail" | "warn";
    message: string;
    details?: unknown;
  }[];
}

export async function healthRoutes(app: FastifyInstance) {
  app.get("/full", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const checks: HealthCheckResult["checks"] = [];

    // Database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.push({
        name: "database",
        status: "pass",
        message: "Database connection healthy"
      });
    } catch (err) {
      checks.push({
        name: "database",
        status: "fail",
        message: "Database connection failed",
        details: err instanceof Error ? err.message : String(err)
      });
    }

    // Last sync time
    const syncState = await prisma.financeSyncState.findUnique({
      where: { userId: user.id }
    });

    if (!syncState?.lastSyncedAt) {
      checks.push({
        name: "sync_state",
        status: "warn",
        message: "No sync has been performed yet",
        details: { lastSyncedAt: null }
      });
    } else {
      const hoursSinceSync = (Date.now() - syncState.lastSyncedAt.getTime()) / (1000 * 60 * 60);
      const status = hoursSinceSync > 36 ? "warn" : "pass";
      checks.push({
        name: "sync_state",
        status,
        message: `Last sync ${Math.round(hoursSinceSync * 10) / 10} hours ago`,
        details: {
          lastSyncedAt: syncState.lastSyncedAt.toISOString(),
          hoursSinceSync: Math.round(hoursSinceSync * 10) / 10
        }
      });
    }

    // Configuration checks
    if (!env.AKAHU_APP_TOKEN || !env.AKAHU_USER_TOKEN) {
      checks.push({
        name: "akahu_credentials",
        status: "fail",
        message: "Akahu credentials missing"
      });
    } else {
      checks.push({
        name: "akahu_credentials",
        status: "pass",
        message: "Akahu credentials configured"
      });
    }

    if (env.INSIGHTS_ENABLED) {
      if (!env.OPENAI_API_KEY) {
        checks.push({
          name: "insights_config",
          status: "fail",
          message: "Insights enabled but OpenAI API key missing"
        });
      } else {
        checks.push({
          name: "insights_config",
          status: "pass",
          message: "Insights enabled and configured"
        });
      }
    } else {
      checks.push({
        name: "insights_config",
        status: "pass",
        message: "Insights disabled"
      });
    }

    const result: HealthCheckResult = {
      ok: checks.every(c => c.status === "pass"),
      checks
    };

    const statusCode = result.ok ? 200 : 503;
    reply.code(statusCode).send(result);
  });
}
