import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function insightsRoutes(app: FastifyInstance) {
  app.get("/latest", async () => {
    const latest = await prisma.insightsDoc.findFirst({
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

  app.get("/history", async () => {
    const docs = await prisma.insightsDoc.findMany({
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

  app.get("/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const doc = await prisma.insightsDoc.findUnique({ where: { id } });

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
