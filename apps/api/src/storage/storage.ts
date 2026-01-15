import path from "node:path";
import fs from "node:fs/promises";
import type { Env } from "../env.js";
import { readLocalStorageJson } from "./localStorage.js";
import { readGcsJson, writeGcsJson } from "./gcsStorage.js";

export async function writeStorageJson(params: {
  env: Env;
  storageKey: string;
  rawJson: string;
}): Promise<void> {
  const { env, storageKey, rawJson } = params;

  if (env.STORAGE_PROVIDER === "local") {
    const fullPath = path.join(env.STORAGE_LOCAL_DIR, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, rawJson, "utf8");
    return;
  }

  if (env.STORAGE_PROVIDER === "gcs") {
    if (!env.STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is required for gcs storage");
    await writeGcsJson({ bucket: env.STORAGE_BUCKET, storageKey, rawJson });
    return;
  }

  throw new Error(`storage provider '${env.STORAGE_PROVIDER}' not implemented`);
}

export async function readStorageJson(params: {
  env: Env;
  storageKey: string;
}): Promise<unknown> {
  const { env, storageKey } = params;

  if (env.STORAGE_PROVIDER === "local") {
    return readLocalStorageJson(env.STORAGE_LOCAL_DIR, storageKey);
  }

  if (env.STORAGE_PROVIDER === "gcs") {
    if (!env.STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is required for gcs storage");
    return readGcsJson({ bucket: env.STORAGE_BUCKET, storageKey });
  }

  throw new Error(`storage provider '${env.STORAGE_PROVIDER}' not implemented`);
}
