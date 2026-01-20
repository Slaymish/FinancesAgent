import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { requireUserFromInternalRequest } from "../auth.js";

type ManualFinancePayload = {
  data?: Prisma.InputJsonValue;
};

export async function manualDataRoutes(app: FastifyInstance) {
  app.get("/", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const record = await prisma.manualFinanceProfile.findUnique({
      where: { userId: user.id }
    });

    reply.send({ ok: true, data: record?.data ?? null });
  });

  app.put("/", async (req, reply) => {
    const env = loadEnv();
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const payload = req.body as ManualFinancePayload | null;
    if (!payload || payload.data === null || payload.data === undefined) {
      reply.status(400).send({ ok: false, error: "invalid_payload" });
      return;
    }

    const record = await prisma.manualFinanceProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, data: payload.data },
      update: { data: payload.data }
    });

    reply.send({ ok: true, data: record.data });
  });
}
