/*
  Warnings:

  - You are about to drop the `DailyNutrition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DailyVitals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DailyWeight` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IngestFile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InsightsDoc` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SleepSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Workout` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "DailyNutrition";

-- DropTable
DROP TABLE "DailyVitals";

-- DropTable
DROP TABLE "DailyWeight";

-- DropTable
DROP TABLE "IngestFile";

-- DropTable
DROP TABLE "InsightsDoc";

-- DropTable
DROP TABLE "SleepSession";

-- DropTable
DROP TABLE "Workout";

-- CreateTable
CREATE TABLE "ingest_files" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "ingest_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_weight" (
    "date" TIMESTAMP(3) NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "daily_weight_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "daily_nutrition" (
    "date" TIMESTAMP(3) NOT NULL,
    "calories" INTEGER,
    "protein_g" DOUBLE PRECISION,
    "carbs_g" DOUBLE PRECISION,
    "fat_g" DOUBLE PRECISION,
    "fibre_g" DOUBLE PRECISION,
    "alcohol_g" DOUBLE PRECISION,

    CONSTRAINT "daily_nutrition_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "sleep_sessions" (
    "id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "quality" TEXT,

    CONSTRAINT "sleep_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "distance_km" DOUBLE PRECISION,
    "avg_hr" INTEGER,
    "max_hr" INTEGER,
    "avgPace" DOUBLE PRECISION,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_vitals" (
    "date" TIMESTAMP(3) NOT NULL,
    "resting_hr" INTEGER,
    "hrv" DOUBLE PRECISION,

    CONSTRAINT "daily_vitals_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "insights_docs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markdown" TEXT NOT NULL,
    "diff_from_prev" TEXT,
    "metrics_pack" JSONB,

    CONSTRAINT "insights_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingest_files_received_at_idx" ON "ingest_files"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "ingest_files_source_checksum_key" ON "ingest_files"("source", "checksum");

-- CreateIndex
CREATE INDEX "sleep_sessions_start_idx" ON "sleep_sessions"("start");

-- CreateIndex
CREATE INDEX "workouts_start_idx" ON "workouts"("start");

-- CreateIndex
CREATE INDEX "insights_docs_created_at_idx" ON "insights_docs"("created_at");
