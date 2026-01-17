import Fastify from "fastify";
import { ingestRoutes } from "./routes/ingest.js";
import { pipelineRoutes } from "./routes/pipeline.js";
import { insightsRoutes } from "./routes/insights.js";
import { dataQualityRoutes } from "./routes/dataQuality.js";

export function createApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024
  });

  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (req, body, done) => {
      done(null, body);
    }
  );

  app.get("/health", async () => {
    return { ok: true };
  });

  app.register(ingestRoutes, { prefix: "/api/ingest" });
  app.register(pipelineRoutes, { prefix: "/api/pipeline" });
  app.register(insightsRoutes, { prefix: "/api/insights" });
  app.register(dataQualityRoutes, { prefix: "/api/data-quality" });

  return app;
}
