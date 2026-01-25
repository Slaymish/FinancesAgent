-- AlterTable
ALTER TABLE "users" ADD COLUMN     "insights_system_prompt" TEXT;

-- CreateTable
CREATE TABLE "insights_docs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markdown" TEXT NOT NULL,
    "diff_from_prev" TEXT,
    "metrics_pack" JSONB,
    "pipeline_run_id" TEXT,

    CONSTRAINT "insights_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insights_docs_user_id_created_at_idx" ON "insights_docs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "insights_docs_pipeline_run_id_idx" ON "insights_docs"("pipeline_run_id");

-- AddForeignKey
ALTER TABLE "insights_docs" ADD CONSTRAINT "insights_docs_pipeline_run_id_fkey" FOREIGN KEY ("pipeline_run_id") REFERENCES "pipeline_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights_docs" ADD CONSTRAINT "insights_docs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
