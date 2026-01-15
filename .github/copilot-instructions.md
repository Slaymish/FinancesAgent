# Copilot instructions (HealthAgent)

## Repo shape
- PNPM workspace monorepo: `apps/api` (Fastify + Prisma) and `apps/web` (Next.js App Router).
- Canonical health data lives in Postgres via Prisma; raw ingest payloads are stored separately (currently local disk).

## Core data flow (the important mental model)
- Ingest: `POST /api/ingest/apple-health` → auth via `X-INGEST-TOKEN` → write raw JSON to storage → insert `ingest_files` row.
  - Implementation: `apps/api/src/routes/ingest.ts`.
- Pipeline: `POST /api/pipeline/run` → loads all `ingest_files` with `processed_at IS NULL` → reads raw JSON from storage → parses into canonical rows → upserts canonical tables → marks ingest processed → computes metrics pack → persists `pipeline_runs` + seeds first `insights_docs`.
  - Implementation: `apps/api/src/routes/pipeline.ts`.
- Web reads metrics from API: `GET /api/pipeline/latest` and renders JSON.
  - Implementation: `apps/web/app/metrics/page.tsx`.

## Local dev workflows (use these commands)
- Install: `pnpm i`
- Start Postgres: `pnpm db:up` (uses `docker-compose.yml`)
- Prisma:
  - Generate client: `pnpm db:generate`
  - Run migrations: `pnpm db:migrate`
- Run services:
  - API dev server (port from env, default 3001): `pnpm --filter @health-agent/api dev`
  - Web dev server (port 3000): `pnpm --filter @health-agent/web dev`
- Seed + run pipeline on the bundled sample export:
  - `pnpm --filter @health-agent/api seed:sample` (stores a file + calls `/api/pipeline/run` internally)
- Parser smoke: `pnpm --filter @health-agent/api parse:test`

## Environment + config conventions (easy to get wrong)
- The API loads dotenv from `apps/api/.env` (see `apps/api/src/dotenv.ts`). Keep required vars in sync with `apps/api/src/env.ts`.
  - Start from the template at `.env.example` and copy to `apps/api/.env`.
- Local storage mode is the only implemented provider right now:
  - `STORAGE_PROVIDER=local`
  - `STORAGE_LOCAL_DIR=storage/local` → writes under `storage/local/apple-health/...`
- The web app expects `API_BASE_URL` (defaults to `http://localhost:3001`) in `apps/web` env (e.g. `apps/web/.env.local`) if you need to point it elsewhere.

## Project-specific coding conventions
- API is ESM (`"type": "module"`), so TS imports use `.js` extensions (e.g. `./routes/ingest.js`). Preserve this.
- Prisma models map to snake_case tables/columns using `@@map`/`@map` in `apps/api/prisma/schema.prisma`; code uses camelCase fields.
- Parsing contracts:
  - Parser output is `CanonicalRows` in `apps/api/src/parsers/types.ts`.
  - Primary parser is `apps/api/src/parsers/healthAutoExport.ts` and is currently re-exported as `parseAppleHealthExport` via `apps/api/src/parsers/appleHealthStub.ts`.
  - Prefer returning partial data + `warnings[]` over throwing for missing metrics.

## Extending the system (where to make changes)
- Add/adjust canonical DB fields: edit `apps/api/prisma/schema.prisma` → run `pnpm db:migrate`.
- Add support for new export formats or metrics: extend `apps/api/src/parsers/healthAutoExport.ts` (and keep the output shape stable).
- Add new API routes: register them in `apps/api/src/app.ts`.
