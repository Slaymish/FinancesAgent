import { createApp } from "./app.js";
import { loadDotenv } from "./dotenv.js";
import { loadEnv } from "./env.js";
import { ensureLegacyUser } from "./auth.js";
import { applyMigrations } from "./migrate.js";

loadDotenv();

const env = loadEnv();

await applyMigrations(env);
await ensureLegacyUser();

const app = createApp();

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
