import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadDotenv() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.join(dir, "../.env") });
}
