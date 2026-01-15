import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";

const bodySchema = z.unknown();

function computeSha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function ingestRoutes(app: FastifyInstance) {
  const env = loadEnv();

  app.post("/apple-health", async (req, reply) => {
    const token = req.headers["x-ingest-token"];
    if (typeof token !== "string" || token !== env.INGEST_TOKEN) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const body = bodySchema.parse(req.body);
    const raw = JSON.stringify(body);

    const checksum = computeSha256(raw);
    const receivedAt = new Date();

    if (env.STORAGE_PROVIDER !== "local") {
      return reply
        .code(501)
        .send({ error: `storage provider '${env.STORAGE_PROVIDER}' not implemented` });
    }

    const dir = env.STORAGE_LOCAL_DIR;
    await fs.mkdir(dir, { recursive: true });

    const filename = `${receivedAt.toISOString()}_${checksum}.json`.replaceAll(":", "-");
    const storageKey = path.join("apple-health", filename);

    const fullPath = path.join(dir, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, raw, "utf8");

    const ingestFile = await prisma.ingestFile.create({
      data: {
        source: "apple-health",
        receivedAt,
        checksum,
        storageKey,
        processedAt: null
      }
    });

    return reply.code(201).send({
      ok: true,
      ingestFileId: ingestFile.id
    });
  });

  app.get("/status", async () => {
    const last = await prisma.ingestFile.findFirst({
      orderBy: { receivedAt: "desc" }
    });

    return {
      lastIngest: last
        ? {
            id: last.id,
            source: last.source,
            receivedAt: last.receivedAt,
            checksum: last.checksum,
            processedAt: last.processedAt
          }
        : null
    };
  });
}
