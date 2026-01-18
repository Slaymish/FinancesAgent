# HealthAgent

HealthAgent ingests daily Apple Health exports (e.g. Health Auto Export JSON), stores raw payloads for audit/debug, parses into a canonical Postgres schema, computes a compact metrics pack, and (optionally) updates a living insights Markdown document via unified diff patches.

- API: Fastify + Prisma (Postgres)
- Web: Next.js App Router
- Raw storage: local disk (dev) or GCS (cloud)
- Auth: NextAuth (GitHub) with per-user ingest tokens and user-scoped data

For a deeper “how it works” walkthrough, see [ONBOARDING.md](docs/ONBOARDING.md).

## Repo layout

- `apps/api` — Fastify API + Prisma
- `apps/web` — Next.js frontend
- `storage/local` — local raw ingest storage (dev)

## Run locally

Prereqs: Node 20+, pnpm, Docker.

```bash
pnpm i
pnpm db:up
pnpm db:generate
pnpm db:migrate

cp .env.example apps/api/.env
cp .env.example .env
pnpm dev
```

- API: http://localhost:3001/health
- Web: http://localhost:3000

Tip: the API loads dotenv from `apps/api/.env`.
Make sure `INTERNAL_API_KEY` matches in both `.env` files and set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` to enable sign-in.

## Key endpoints

- `POST /api/ingest/apple-health` (auth: per-user `X-INGEST-TOKEN` or `Authorization: Bearer <token>`)
- `POST /api/pipeline/run` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`, or `X-PIPELINE-TOKEN` + `X-USER-ID`)
- `GET /api/pipeline/latest` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `GET /api/insights/latest` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `GET /api/data-quality/summary` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)

## Config (API)

See `.env.example` for the full list. Common ones:

- `INGEST_TOKEN`
- `INTERNAL_API_KEY`
- `API_BASE_URL` (for the web app to call the API)
- `NEXTAUTH_SECRET` + `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` (web auth)
- `DATABASE_URL`
- `STORAGE_PROVIDER=local|gcs` (+ `STORAGE_LOCAL_DIR` or `STORAGE_BUCKET`)
- `INSIGHTS_ENABLED` (optional, default false)
- `OPENAI_API_KEY` + `INSIGHTS_MODEL` (optional; only used when `INSIGHTS_ENABLED=true`)
- `GOAL_TARGET_WEIGHT_KG` (optional; enables projected timeline to goal)

## Enable LLM insights

- Copy `.env.example` to `apps/api/.env` and set `INSIGHTS_ENABLED=true`.
- Add your OpenAI key to `OPENAI_API_KEY` and choose a chat-completions model for `INSIGHTS_MODEL` (e.g. `gpt-4o-mini`) in `apps/api/.env`.
- Keep the key server-side only; the web app never needs it. Trigger insights generation by running the pipeline (`POST /api/pipeline/run` with `x-internal-api-key` + `x-user-id` headers, or use `pnpm --filter @health-agent/api seed:sample` locally).

## Deploy

GCP deployment (Cloud Run + GCS + Cloud Scheduler + external/serverless Postgres like Neon) is documented in [DEPLOY_GCP.md](docs/DEPLOY_GCP.md).

## Budget mode (<$10/month)

Cloud SQL is convenient, but it’s easy to accidentally pay for **24/7 instance uptime** even if you’re not using the app. If you want to keep this project under a strict hobby budget, prefer one of these approaches:

### Option A (cheapest): no cloud, run locally

- Use the local Postgres via `pnpm db:up` and keep `STORAGE_PROVIDER=local`.
- Run the API/web only when you need them (`pnpm dev`) and run the pipeline on demand.
- Cost: effectively $0 (aside from your own machine).

### Option B: one small VPS running everything

- Run Postgres + API + web on a single small VM with Docker.
- Use local disk for raw storage.
- This avoids managed database pricing, at the cost of you owning updates/backups.

### Option C: serverless Postgres + pay-per-use compute

- Keep Postgres on a serverless/free-tier provider (set `DATABASE_URL` accordingly).
- Run API/web on a pay-per-use/free-tier host.
- This keeps “always-on database VM” costs out of your bill while preserving a Postgres backend for Prisma.

If you choose to use Cloud SQL on GCP anyway, set a Billing budget/alert and double-check whether your instance is HA/regional and whether automated backups/retention are enabled.
