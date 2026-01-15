import { z } from "zod";

const envSchema = z.object({
  INGEST_TOKEN: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1),

  STORAGE_PROVIDER: z.enum(["local", "s3", "gcs"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("storage/local"),

  OPENAI_API_KEY: z.string().optional(),
  INSIGHTS_MODEL: z.string().optional()
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
