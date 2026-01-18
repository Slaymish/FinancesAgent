import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { loadDotenv } from "../dotenv.js";
import { loadEnv } from "../env.js";
import { prisma } from "../prisma.js";
import { createApp } from "../app.js";
import { LEGACY_USER_ID, ensureLegacyUser } from "../auth.js";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function seedIngestFromFile(opts: { filePath: string }) {
  const env = loadEnv();
  await ensureLegacyUser(env);
  if (env.STORAGE_PROVIDER !== "local") {
    throw new Error(`STORAGE_PROVIDER '${env.STORAGE_PROVIDER}' not supported by seed script`);
  }

  const receivedAt = new Date();
  const raw = await fs.readFile(opts.filePath, "utf8");
  const checksum = sha256(raw);

  const filename = `${receivedAt.toISOString()}_${checksum}.json`.replaceAll(":", "-");
  const storageKey = path.join("apple-health", LEGACY_USER_ID, filename);

  const storageRoot = env.STORAGE_LOCAL_DIR;
  const fullPath = path.join(storageRoot, storageKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, raw, "utf8");

  const ingestFile = await prisma.ingestFile.upsert({
    where: { userId_source_checksum: { userId: LEGACY_USER_ID, source: "apple-health", checksum } },
    update: {
      storageKey,
      receivedAt,
      processedAt: null
    },
    create: {
      userId: LEGACY_USER_ID,
      source: "apple-health",
      checksum,
      storageKey,
      receivedAt,
      processedAt: null
    }
  });

  return {
    ingestFileId: ingestFile.id,
    checksum,
    storageKey,
    storedPath: fullPath
  };
}

async function run() {
  loadDotenv();

  const env = loadEnv();

  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../../../");

  const inputPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(repoRoot, "HealthAutoExport-2026-01-01-2026-01-15.json");

  const seeded = await seedIngestFromFile({ filePath: inputPath });

  const app = createApp();
  const pipelineHeaders: Record<string, string> = {
    "x-user-id": LEGACY_USER_ID,
    "x-internal-api-key": env.INTERNAL_API_KEY
  };
  if (env.PIPELINE_TOKEN) pipelineHeaders["x-pipeline-token"] = env.PIPELINE_TOKEN;
  const pipeline = await app.inject({
    method: "POST",
    url: "/api/pipeline/run",
    headers: pipelineHeaders
  });
  await app.close();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        seeded,
        pipeline: {
          statusCode: pipeline.statusCode,
          body: pipeline.body ? JSON.parse(pipeline.body) : null
        }
      },
      null,
      2
    )
  );

  if (pipeline.statusCode !== 200) process.exit(1);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
