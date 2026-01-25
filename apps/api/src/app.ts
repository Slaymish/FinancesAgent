import Fastify from "fastify";
import { pipelineRoutes } from "./routes/pipeline.js";
import { categoryRoutes } from "./routes/categories.js";
import { transactionRoutes } from "./routes/transactions.js";
import { manualDataRoutes } from "./routes/manual-data.js";
import { insightsRoutes } from "./routes/insights.js";

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

  app.register(pipelineRoutes, { prefix: "/api/pipeline" });
  app.register(categoryRoutes, { prefix: "/api/categories" });
  app.register(transactionRoutes, { prefix: "/api/transactions" });
  app.register(manualDataRoutes, { prefix: "/api/manual-data" });
  app.register(insightsRoutes, { prefix: "/api/insights" });

  return app;
}
