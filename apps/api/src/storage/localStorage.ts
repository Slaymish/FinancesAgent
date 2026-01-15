import path from "node:path";
import fs from "node:fs/promises";

export async function readLocalStorageJson(storageRootDir: string, storageKey: string): Promise<unknown> {
  const fullPath = path.join(storageRootDir, storageKey);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw) as unknown;
}
