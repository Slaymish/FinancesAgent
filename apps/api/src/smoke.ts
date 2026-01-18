import { loadDotenv } from "./dotenv.js";
import { loadEnv } from "./env.js";
import { createApp } from "./app.js";
import { ensureLegacyUser, LEGACY_USER_ID } from "./auth.js";

async function run() {
  loadDotenv();
  const env = loadEnv();
  await ensureLegacyUser(env);

  const app = createApp();

  const baseHeaders = { "x-user-id": LEGACY_USER_ID, "x-internal-api-key": env.INTERNAL_API_KEY };
  const pipelineHeaders = env.PIPELINE_TOKEN ? { ...baseHeaders, "x-pipeline-token": env.PIPELINE_TOKEN } : baseHeaders;

  const health = await app.inject({ method: "GET", url: "/health" });
  const status = await app.inject({ method: "GET", url: "/api/ingest/status", headers: baseHeaders });
  const pipeline = await app.inject({ method: "POST", url: "/api/pipeline/run", headers: pipelineHeaders });

  // eslint-disable-next-line no-console
  console.log("/health", health.statusCode, health.body);
  // eslint-disable-next-line no-console
  console.log("/api/ingest/status", status.statusCode, status.body);
  // eslint-disable-next-line no-console
  console.log("/api/pipeline/run", pipeline.statusCode, pipeline.body);

  await app.close();

  if (health.statusCode !== 200) process.exit(1);
  if (status.statusCode !== 200) process.exit(1);
  if (pipeline.statusCode !== 200) process.exit(1);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
