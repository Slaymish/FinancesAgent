import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { writeStorageJson } from "../storage/storage.js";
import { extractBearerToken, findUserByIngestToken, requireUserFromInternalRequest } from "../auth.js";

const bodySchema = z.unknown();

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

  // Some exporter apps "test" connectivity with a GET/HEAD-style probe.
  // Keep this unauthenticated so it can be used as a simple reachability check.
  app.get("/apple-health", async () => {
    return { ok: true };
  });

  app.post("/apple-health", async (req, reply) => {
    req.log.info(
      {
        contentType: req.headers["content-type"],
        contentLength: req.headers["content-length"]
      },
      "ingest_request"
    );

    const headerToken = req.headers["x-ingest-token"];
    const bearerToken = extractBearerToken(req.headers.authorization);
    const token = typeof headerToken === "string" ? headerToken : bearerToken;
    const user = token ? await findUserByIngestToken(token, env) : null;
    if (!token || !user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const parsed = bodySchema.parse(req.body);
    const body = normalizeJsonBody(parsed);
    // JSON.stringify(undefined) returns undefined which would crash hashing.
    // Treat missing/unparsed bodies as null.
    const raw = JSON.stringify(body ?? null);

    const checksum = computeSha256(raw);
    const receivedAt = new Date();

    const filename = `${receivedAt.toISOString()}_${checksum}.json`.replaceAll(":", "-");
    const storageKey = path.join("apple-health", user.id, filename);

    await writeStorageJson({ env, storageKey, rawJson: raw });

    const ingestFile = await prisma.ingestFile.create({
      data: {
        userId: user.id,
        source: "apple-health",
        receivedAt,
        checksum,
        storageKey,
        processedAt: null
      }
    });

    return reply.code(200).send({
      ok: true,
      ingestFileId: ingestFile.id
    });
  });

  app.get("/status", async (req, reply) => {
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const last = await prisma.ingestFile.findFirst({
      where: { userId: user.id },
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
