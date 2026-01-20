CREATE TABLE "manual_finance_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_finance_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manual_finance_profiles_user_id_key" ON "manual_finance_profiles"("user_id");

ALTER TABLE "manual_finance_profiles" ADD CONSTRAINT "manual_finance_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
