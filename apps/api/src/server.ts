import { createApp } from "./app.js";
import { loadDotenv } from "./dotenv.js";
import { loadEnv } from "./env.js";

loadDotenv();

const env = loadEnv();

const app = createApp();

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
