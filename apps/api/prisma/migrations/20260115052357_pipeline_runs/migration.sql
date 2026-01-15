-- AlterTable
ALTER TABLE "insights_docs" ADD COLUMN     "pipeline_run_id" TEXT;

-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics_pack" JSONB NOT NULL,
    "processed_ingest_count" INTEGER NOT NULL,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipeline_runs_created_at_idx" ON "pipeline_runs"("created_at");

-- CreateIndex
CREATE INDEX "insights_docs_pipeline_run_id_idx" ON "insights_docs"("pipeline_run_id");

-- AddForeignKey
ALTER TABLE "insights_docs" ADD CONSTRAINT "insights_docs_pipeline_run_id_fkey" FOREIGN KEY ("pipeline_run_id") REFERENCES "pipeline_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
