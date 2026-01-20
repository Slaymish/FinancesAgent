import { loadDotenv } from "./dotenv.js";
import { loadEnv } from "./env.js";
import { createApp } from "./app.js";
import { ensureLegacyUser, LEGACY_USER_ID } from "./auth.js";

async function run() {
  loadDotenv();
  const env = loadEnv();
  await ensureLegacyUser();

  const app = createApp();

  const baseHeaders = { "x-user-id": LEGACY_USER_ID, "x-internal-api-key": env.INTERNAL_API_KEY };
  const pipelineHeaders = env.PIPELINE_TOKEN ? { ...baseHeaders, "x-pipeline-token": env.PIPELINE_TOKEN } : baseHeaders;

  const health = await app.inject({ method: "GET", url: "/health" });
  const pipeline = await app.inject({ method: "POST", url: "/api/pipeline/run", headers: pipelineHeaders });
  const summary = await app.inject({ method: "GET", url: "/api/transactions/summary", headers: baseHeaders });

  // eslint-disable-next-line no-console
  console.log("/health", health.statusCode, health.body);
  // eslint-disable-next-line no-console
  // eslint-disable-next-line no-console
  console.log("/api/pipeline/run", pipeline.statusCode, pipeline.body);
  // eslint-disable-next-line no-console
  console.log("/api/transactions/summary", summary.statusCode, summary.body);

  await app.close();

  if (health.statusCode !== 200) process.exit(1);
  const expectsPipelineOk = !!(env.AKAHU_APP_TOKEN && env.AKAHU_USER_TOKEN);
  if (expectsPipelineOk && pipeline.statusCode !== 200) process.exit(1);
  if (!expectsPipelineOk && pipeline.statusCode !== 400) process.exit(1);
  if (summary.statusCode !== 200) process.exit(1);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
