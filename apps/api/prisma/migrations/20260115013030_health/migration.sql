-- CreateTable
CREATE TABLE "IngestFile" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "IngestFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWeight" (
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DailyWeight_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "DailyNutrition" (
    "date" TIMESTAMP(3) NOT NULL,
    "calories" INTEGER,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "fibreG" DOUBLE PRECISION,
    "alcoholG" DOUBLE PRECISION,

    CONSTRAINT "DailyNutrition_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "quality" TEXT,

    CONSTRAINT "SleepSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "distanceKm" DOUBLE PRECISION,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "avgPace" DOUBLE PRECISION,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyVitals" (
    "date" TIMESTAMP(3) NOT NULL,
    "restingHr" INTEGER,
    "hrv" DOUBLE PRECISION,

    CONSTRAINT "DailyVitals_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "InsightsDoc" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markdown" TEXT NOT NULL,
    "diffFromPrev" TEXT,
    "metricsPack" JSONB,

    CONSTRAINT "InsightsDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestFile_receivedAt_idx" ON "IngestFile"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestFile_source_checksum_key" ON "IngestFile"("source", "checksum");

-- CreateIndex
CREATE INDEX "SleepSession_start_idx" ON "SleepSession"("start");

-- CreateIndex
CREATE INDEX "Workout_start_idx" ON "Workout"("start");

-- CreateIndex
CREATE INDEX "InsightsDoc_createdAt_idx" ON "InsightsDoc"("createdAt");
