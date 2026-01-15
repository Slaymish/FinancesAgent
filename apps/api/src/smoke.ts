import { loadDotenv } from "./dotenv.js";

loadDotenv();

import { createApp } from "./app.js";

async function run() {
  const app = createApp();

  const health = await app.inject({ method: "GET", url: "/health" });
  const status = await app.inject({ method: "GET", url: "/api/ingest/status" });
  const pipeline = await app.inject({ method: "POST", url: "/api/pipeline/run" });

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
