import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { writeStorageJson } from "../storage/storage.js";

const bodySchema = z.unknown();

function extractBearerToken(authorizationHeader: unknown): string | null {
  if (typeof authorizationHeader !== "string") return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice("bearer ".length).trim();
  return token.length ? token : null;
}

function normalizeJsonBody(body: unknown): unknown {
  if (Buffer.isBuffer(body)) {
    body = body.toString("utf8");
  }

  if (typeof body === "string") {
    const trimmed = body.trim();
    // Apple Shortcuts often sends file contents as raw text.
    // If it's valid JSON, parse it so we store a proper JSON payload.
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fall through and store it as a string if it isn't valid JSON.
      }
    }
  }

  return body;
}

function computeSha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function ingestRoutes(app: FastifyInstance) {
  const env = loadEnv();

  app.post("/apple-health", async (req, reply) => {
    const headerToken = req.headers["x-ingest-token"];
    const bearerToken = extractBearerToken(req.headers.authorization);
    const token = typeof headerToken === "string" ? headerToken : bearerToken;
    if (!token || token !== env.INGEST_TOKEN) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const parsed = bodySchema.parse(req.body);
    const body = normalizeJsonBody(parsed);
    const raw = JSON.stringify(body);

    const checksum = computeSha256(raw);
    const receivedAt = new Date();

    const filename = `${receivedAt.toISOString()}_${checksum}.json`.replaceAll(":", "-");
    const storageKey = path.join("apple-health", filename);

    await writeStorageJson({ env, storageKey, rawJson: raw });

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
