-- Drop indexes that will be replaced with user-scoped versions
DROP INDEX IF EXISTS "ingest_files_received_at_idx";
DROP INDEX IF EXISTS "ingest_files_source_checksum_key";
DROP INDEX IF EXISTS "insights_docs_created_at_idx";
DROP INDEX IF EXISTS "pipeline_runs_created_at_idx";
DROP INDEX IF EXISTS "sleep_sessions_dedupe_key_key";
DROP INDEX IF EXISTS "sleep_sessions_start_idx";
DROP INDEX IF EXISTS "workouts_source_id_key";
DROP INDEX IF EXISTS "workouts_start_idx";

-- Create user + auth tables
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "ingest_token_hash" TEXT NOT NULL,
    "ingest_token_preview" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "oauth_token_secret" TEXT,
    "oauth_token" TEXT,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- Seed a legacy user so existing data can be backfilled
INSERT INTO "users" ("id", "name", "email", "email_verified", "image", "ingest_token_hash", "ingest_token_preview", "created_at", "updated_at")
VALUES ('legacy-user', NULL, NULL, NULL, NULL, 'legacy-token-placeholder', '****', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Add user_id columns with a temporary default to backfill existing rows
ALTER TABLE "daily_nutrition" ADD COLUMN "user_id" TEXT DEFAULT 'legacy-user';
UPDATE "daily_nutrition" SET "user_id" = 'legacy-user' WHERE "user_id" IS NULL;
ALTER TABLE "daily_nutrition" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "daily_nutrition" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "daily_nutrition" DROP CONSTRAINT IF EXISTS "daily_nutrition_pkey";
ALTER TABLE "daily_nutrition" ADD CONSTRAINT "daily_nutrition_pkey" PRIMARY KEY ("user_id", "date");

ALTER TABLE "daily_vitals" ADD COLUMN "user_id" TEXT DEFAULT 'legacy-user';
UPDATE "daily_vitals" SET "user_id" = 'legacy-user' WHERE "user_id" IS NULL;
ALTER TABLE "daily_vitals" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "daily_vitals" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "daily_vitals" DROP CONSTRAINT IF EXISTS "daily_vitals_pkey";
ALTER TABLE "daily_vitals" ADD CONSTRAINT "daily_vitals_pkey" PRIMARY KEY ("user_id", "date");

ALTER TABLE "daily_weight" ADD COLUMN "user_id" TEXT DEFAULT 'legacy-user';
UPDATE "daily_weight" SET "user_id" = 'legacy-user' WHERE "user_id" IS NULL;
ALTER TABLE "daily_weight" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "daily_weight" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "daily_weight" DROP CONSTRAINT IF EXISTS "daily_weight_pkey";
ALTER TABLE "daily_weight" ADD CONSTRAINT "daily_weight_pkey" PRIMARY KEY ("user_id", "date");

ALTER TABLE "ingest_files" ADD COLUMN "user_id" TEXT DEFAULT 'legacy-user';
UPDATE "ingest_files" SET "user_id" = 'legacy-user' WHERE "user_id" IS NULL;
ALTER TABLE "ingest_files" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "ingest_files" ALTER COLUMN "user_id" DROP DEFAULT;

ALTER TABLE "insights_docs" ADD COLUMN "user_id" TEXT DEFAULT 'legacy-user';
UPDATE "insights_docs" SET "user_id" = 'legacy-user' WHERE "user_id" IS NULL;
ALTER TABLE "insights_docs" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "insights_docs" ALTER COLUMN "user_id" DROP DEFAULT;

ALTER TABLE "pipeline_runs" ADD COLUMN "user_id" TEXT DEFAULT 'legacy-user';
UPDATE "pipeline_runs" SET "user_id" = 'legacy-user' WHERE "user_id" IS NULL;
ALTER TABLE "pipeline_runs" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "pipeline_runs" ALTER COLUMN "user_id" DROP DEFAULT;

ALTER TABLE "sleep_sessions" ADD COLUMN "user_id" TEXT DEFAULT 'legacy-user';
UPDATE "sleep_sessions" SET "user_id" = 'legacy-user' WHERE "user_id" IS NULL;
ALTER TABLE "sleep_sessions" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "sleep_sessions" ALTER COLUMN "user_id" DROP DEFAULT;

ALTER TABLE "workouts" ADD COLUMN "user_id" TEXT DEFAULT 'legacy-user';
UPDATE "workouts" SET "user_id" = 'legacy-user' WHERE "user_id" IS NULL;
ALTER TABLE "workouts" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "workouts" ALTER COLUMN "user_id" DROP DEFAULT;

-- Recreate indexes with user scoping
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");
CREATE INDEX "ingest_files_user_id_received_at_idx" ON "ingest_files"("user_id", "received_at");
CREATE UNIQUE INDEX "ingest_files_user_id_source_checksum_key" ON "ingest_files"("user_id", "source", "checksum");
CREATE INDEX "insights_docs_user_id_created_at_idx" ON "insights_docs"("user_id", "created_at");
CREATE INDEX "pipeline_runs_user_id_created_at_idx" ON "pipeline_runs"("user_id", "created_at");
CREATE INDEX "sleep_sessions_user_id_start_idx" ON "sleep_sessions"("user_id", "start");
CREATE UNIQUE INDEX "sleep_sessions_user_id_dedupe_key_key" ON "sleep_sessions"("user_id", "dedupe_key");
CREATE INDEX "workouts_user_id_start_idx" ON "workouts"("user_id", "start");
CREATE UNIQUE INDEX "workouts_user_id_source_id_key" ON "workouts"("user_id", "source_id");

-- Add foreign keys
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingest_files" ADD CONSTRAINT "ingest_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_weight" ADD CONSTRAINT "daily_weight_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_nutrition" ADD CONSTRAINT "daily_nutrition_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sleep_sessions" ADD CONSTRAINT "sleep_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_vitals" ADD CONSTRAINT "daily_vitals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insights_docs" ADD CONSTRAINT "insights_docs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
