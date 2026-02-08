import { z } from "zod";

const envSchema = z.object({
  INTERNAL_API_KEY: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),

  PIPELINE_TOKEN: z.string().optional(),

  DATABASE_URL: z.string().min(1),
  DATABASE_DIRECT_URL: z.string().optional(),
  PRISMA_MIGRATE_ON_START: z
    .preprocess((v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "string") {
        const normalized = v.toLowerCase();
        if (["1", "true", "yes", "on"].includes(normalized)) return true;
        if (["0", "false", "no", "off"].includes(normalized)) return false;
      }
      return undefined;
    }, z.boolean().optional())
    .default(false),
  AKAHU_APP_TOKEN: z.string().min(1).optional(),
  AKAHU_USER_TOKEN: z.string().min(1).optional(),
  AKAHU_BASE_URL: z.string().min(1).default("https://api.akahu.io/v1"),
  AKAHU_LOOKBACK_DAYS: z.coerce.number().int().positive().default(14),
  AKAHU_PAGE_SIZE: z.coerce.number().int().positive().default(250),

  INSIGHTS_ENABLED: z
    .preprocess((v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "string") {
        const normalized = v.toLowerCase();
        if (["1", "true", "yes", "on"].includes(normalized)) return true;
        if (["0", "false", "no", "off"].includes(normalized)) return false;
      }
      return undefined;
    }, z.boolean().optional())
    .default(false),
  OPENAI_API_KEY: z.string().optional(),
  INSIGHTS_MODEL: z.string().optional().default("gpt-4o-mini"),
  TINKER_MODEL_PATH: z
    .string()
    .optional()
    .default("tinker://1bdf299a-25aa-5110-877d-9ce6c42f64af:train:0/sampler_weights/insights-agent-model"),
  TINKER_BRIDGE_CMD: z
    .string()
    .optional()
    .default("python3")
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(processEnv: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(processEnv);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${message}`);
  }
  return parsed.data;
}
