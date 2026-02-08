-- CreateEnum
CREATE TYPE "InboxState" AS ENUM ('auto_classified', 'needs_review', 'unclassified', 'cleared');

-- CreateEnum
CREATE TYPE "ClassificationSource" AS ENUM ('rule', 'model', 'user', 'none');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "category_confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "classification_source" "ClassificationSource" NOT NULL DEFAULT 'none',
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "inbox_state" "InboxState" NOT NULL DEFAULT 'unclassified',
ADD COLUMN     "suggested_category_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "model_auto_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Pacific/Auckland';

-- CreateTable
CREATE TABLE "category_models" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weights_json" JSONB NOT NULL,
    "training_label_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_models_user_id_updated_at_idx" ON "category_models"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "transactions_user_id_inbox_state_idx" ON "transactions"("user_id", "inbox_state");

-- AddForeignKey
ALTER TABLE "category_models" ADD CONSTRAINT "category_models_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
