import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
const skipDeploy = process.env.PRISMA_SKIP_MIGRATE_DEPLOY === "1";

if (skipDeploy) {
  console.log("[db] Skipping prisma migrate deploy (PRISMA_SKIP_MIGRATE_DEPLOY=1).");
  process.exit(0);
}

if (!databaseUrl) {
  console.log("[db] DATABASE_URL is not set; skipping prisma migrate deploy.");
  process.exit(0);
}

const env = {
  ...process.env,
  DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL ?? databaseUrl
};

console.log("[db] Running prisma migrate deploy before web build...");

const result = spawnSync("pnpm", ["--filter", "@finance-agent/api", "prisma:deploy"], {
  stdio: "inherit",
  env
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

