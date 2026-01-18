import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { requireUserFromInternalRequest } from "../auth.js";
import { loadEnv } from "../env.js";

export async function insightsRoutes(app: FastifyInstance) {
  const env = loadEnv();

  app.get("/latest", async (req, reply) => {
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const latest = await prisma.insightsDoc.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });

    return {
      latest: latest
        ? {
            id: latest.id,
            createdAt: latest.createdAt,
            markdown: latest.markdown,
            diffFromPrev: latest.diffFromPrev,
            pipelineRunId: latest.pipelineRunId
          }
        : null
    };
  });

  app.get("/history", async (req, reply) => {
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const docs = await prisma.insightsDoc.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return {
      docs: docs.map((d) => ({
        id: d.id,
        createdAt: d.createdAt,
        diffFromPrev: d.diffFromPrev,
        pipelineRunId: d.pipelineRunId
      }))
    };
  });

  app.get("/:id", async (req, reply) => {
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const id = (req.params as { id: string }).id;
    const doc = await prisma.insightsDoc.findFirst({ where: { id, userId: user.id } });

    return {
      doc: doc
        ? {
            id: doc.id,
            createdAt: doc.createdAt,
            markdown: doc.markdown,
            diffFromPrev: doc.diffFromPrev,
            pipelineRunId: doc.pipelineRunId
          }
        : null
    };
  });
}
