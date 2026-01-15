import Fastify from "fastify";
import { ingestRoutes } from "./routes/ingest.js";
import { pipelineRoutes } from "./routes/pipeline.js";

export function createApp() {
  const app = Fastify({
    logger: true
  });

  app.get("/health", async () => {
    return { ok: true };
  });

  app.register(ingestRoutes, { prefix: "/api/ingest" });
  app.register(pipelineRoutes, { prefix: "/api/pipeline" });

  return app;
}
