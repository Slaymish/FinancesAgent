import { z } from "zod";

const envSchema = z.object({
  INGEST_TOKEN: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),

  PIPELINE_TOKEN: z.string().optional(),

  DATABASE_URL: z.string().min(1),

  STORAGE_PROVIDER: z.enum(["local", "s3", "gcs"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("storage/local"),
  STORAGE_BUCKET: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  INSIGHTS_MODEL: z.string().optional(),

  GOAL_TARGET_WEIGHT_KG: z.coerce.number().positive().optional(),
  GOAL_TARGET_DATE: z
    .string()
    .optional()
    .refine((v) => (v == null || v.trim() === "" ? true : !Number.isNaN(new Date(v).getTime())), {
      message: "must be a valid date string"
    })
})
  .refine(
    (v) => (v.STORAGE_PROVIDER === "gcs" ? typeof v.STORAGE_BUCKET === "string" && v.STORAGE_BUCKET.length > 0 : true),
    {
      message: "STORAGE_BUCKET is required when STORAGE_PROVIDER=gcs",
      path: ["STORAGE_BUCKET"]
    }
  );

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
