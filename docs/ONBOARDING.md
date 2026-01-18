# HealthAgent Onboarding

This document is a practical guide to understanding how this repo works, where to start reading code, how to run it locally, and how the deployed pieces fit together.

## 0) What this system does (in one paragraph)

HealthAgent ingests daily Apple Health exports (currently via Health Auto Export JSON), stores the raw payloads (for audit/debug), parses them into a canonical Postgres schema, computes a compact “metrics pack”, and optionally uses an LLM to update a living insights Markdown document via unified diffs.

---

## 1) Repo map (where things live)

This is a PNPM workspace monorepo:

- `apps/api/` — Fastify API (TypeScript, ESM)
  - Entry points:
    - `apps/api/src/server.ts` — starts the HTTP server
    - `apps/api/src/app.ts` — registers routes
  - Routes:
    - `apps/api/src/routes/ingest.ts` — ingest endpoint + ingest status
    - `apps/api/src/routes/pipeline.ts` — pipeline runner + latest metrics
    - `apps/api/src/routes/insights.ts` — insights doc APIs
    - `apps/api/src/routes/dataQuality.ts` — “missing days” summary
  - Parsing:
    - `apps/api/src/parsers/healthAutoExport.ts` — real parser implementation
    - `apps/api/src/parsers/appleHealthStub.ts` — re-export used by pipeline
    - `apps/api/src/parsers/types.ts` — canonical parser output types
  - Insights:
    - `apps/api/src/insights/llm.ts` — calls OpenAI chat completions
    - `apps/api/src/insights/patch.ts` — applies unified diff patches
  - Storage:
    - `apps/api/src/storage/storage.ts` — storage abstraction for raw ingests
    - `apps/api/src/storage/localStorage.ts` — reads local raw files
    - `apps/api/src/storage/gcsStorage.ts` — reads/writes GCS raw files
  - DB:
    - `apps/api/prisma/schema.prisma` — canonical schema + table mappings
    - `apps/api/src/prisma.ts` — Prisma client

- `apps/web/` — Next.js App Router frontend
  - Pages:
    - `apps/web/app/page.tsx` — “Dashboard” (renders latest metrics)
    - `apps/web/app/metrics/page.tsx` — raw metrics pack JSON
    - `apps/web/app/trends/page.tsx` — time series (JSON for now)
    - `apps/web/app/insights/page.tsx` — latest insights doc + diff history
    - `apps/web/app/data-quality/page.tsx` — last ingest + missing days

- `packages/shared/` — placeholder package for shared types (currently empty)

- `storage/local/` — default local raw ingest storage (dev mode)

---

## 2) Runtime components (what runs where)

### Local development

- **API**: Fastify dev server (`apps/api`) listens on `API_PORT` (default `3001`).
- **Web**: Next.js dev server (`apps/web`) listens on `3000`.
- **Database**: Postgres 16 runs via `docker-compose.yml` (port `5432`).
- **Raw ingest storage**: local filesystem under `storage/local/`.

### Cloud (intended / documented path)

- **API**: Cloud Run (container built by Cloud Build)
- **Database**: External/serverless Postgres (e.g. Neon)
- **Raw ingest storage**: GCS bucket
- **Pipeline trigger**: Cloud Scheduler hits `/api/pipeline/run` daily
- **Web**: not explicitly deployed by this repo; simplest is Vercel (or any Next.js host) with `API_BASE_URL` pointing at Cloud Run.

See `DEPLOY_GCP.md` for the concrete commands.

---

## 3) End-to-end data flow (read this first)

### 3.1 Ingest (raw payload capture)

**HTTP:** `POST /api/ingest/apple-health`

**Implementation:** `apps/api/src/routes/ingest.ts`

What happens:

1. Auth via `X-INGEST-TOKEN` or `Authorization: Bearer <token>` (per-user token from the `/connect` page; legacy `INGEST_TOKEN` is only used for the seeded user).
2. The request body is accepted as `unknown` and serialized to JSON.
3. A SHA-256 checksum is computed over the raw JSON string.
4. The raw JSON is written to storage at:
   - Local: `storage/local/apple-health/<user_id>/<timestamp>_<checksum>.json`
   - GCS: `gs://<bucket>/apple-health/<user_id>/<timestamp>_<checksum>.json`
5. An `ingest_files` row is inserted with `processed_at = NULL` and `user_id` set.

#### Health Auto Export (REST API) setup

In the Health Auto Export app, configure a REST export like:

- **Method**: `POST`
- **URL**: `https://YOUR_API_BASE_URL/api/ingest/apple-health`
- **Headers** (pick one):
  - `Authorization: Bearer <YOUR_PERSONAL_INGEST_TOKEN>`
  - OR `X-INGEST-TOKEN: <YOUR_PERSONAL_INGEST_TOKEN>`
- **Body**: raw JSON (the export file contents)

Notes:

- The API accepts large payloads (Fastify `bodyLimit` is 50MB), but daily exports are usually more reliable than multi-week uploads.
- Generate/regenerate your token from the web app at `/connect`.
- Confirm uploads via `GET /api/ingest/status` with `x-internal-api-key` + `x-user-id` headers.

### 3.2 Pipeline (parse → upsert → metrics → insights)

**HTTP:** `POST /api/pipeline/run`

**Implementation:** `apps/api/src/routes/pipeline.ts`

What happens:

1. Auth via `X-INTERNAL-API-KEY` + `X-USER-ID` (or `X-PIPELINE-TOKEN` + `X-USER-ID`).
2. Load all `ingest_files` for that user where `processed_at IS NULL`.
3. For each ingest file:
   - Read raw JSON from storage (`apps/api/src/storage/storage.ts`)
   - Parse into canonical rows via `parseAppleHealthExport` (currently re-exporting `parseHealthAutoExport`)
   - Upsert into canonical tables in a transaction
   - Mark the ingest file as processed (`processed_at = now()`)
4. Compute the **metrics pack** (7/14/28-day summaries + trend series).
5. Compute a goal projection (estimate when the target weight is reached at the current trend) if `GOAL_TARGET_WEIGHT_KG` is set.
6. Insert a `pipeline_runs` row with the metrics pack.
7. Update the living **insights doc**:
   - If there is no previous doc: create `# Insights\n\n`
   - Else:
     - If `INSIGHTS_ENABLED=true` and `OPENAI_API_KEY` + `INSIGHTS_MODEL` are configured: ask the model for a unified diff and apply it
     - Otherwise: skip insights generation (off-by-default)
   - When enabled, a new `insights_docs` row is inserted per pipeline run.

### 3.3 Read paths (what the web calls)

- `GET /api/pipeline/latest` — latest metrics pack (`apps/api/src/routes/pipeline.ts`)
- `GET /api/insights/latest` — latest insights doc (`apps/api/src/routes/insights.ts`)
- `GET /api/insights/history` — last 50 insight doc headers (`apps/api/src/routes/insights.ts`)
- `GET /api/data-quality/summary` — missing days across last 14 days (`apps/api/src/routes/dataQuality.ts`)

All read paths expect `x-internal-api-key` + `x-user-id` headers and return data scoped to that user.

---

## 4) Database schema (canonical tables)

Canonical health data is stored in Postgres via Prisma.

**Schema:** `apps/api/prisma/schema.prisma`

Key tables:

- `ingest_files` — metadata for each raw ingest payload
- `daily_weight` — one row per day (UTC midnight), `weight_kg`
- `daily_nutrition` — one row per day, calories + macros (nullable)
- `sleep_sessions` — sleep sessions with a `dedupe_key` to upsert
- `workouts` — workout sessions with optional `source_id` to upsert
- `daily_vitals` — resting HR + HRV by day
- `pipeline_runs` — stores `metrics_pack` JSON + processed ingest count
- `insights_docs` — versioned Markdown + optional diff + metrics_pack reference

Note: Prisma fields are camelCase; DB tables/columns map to snake_case using `@@map` / `@map`.

---

## 5) Local dev: quickstart (works today)

### 5.1 Prereqs

- Node.js 20+
- pnpm
- Docker

### 5.2 Install + DB

From repo root:

```bash
pnpm i
pnpm db:up
pnpm db:generate
pnpm db:migrate
```

### 5.3 Environment variables (important)

The API loads dotenv from **`apps/api/.env`** (not the repo root).

Create it from the template:

```bash
cp .env.example apps/api/.env
```

Defaults are already set for local Postgres + local raw storage.
To enable LLM-backed insights, set `INSIGHTS_ENABLED=true` and fill in `OPENAI_API_KEY` + `INSIGHTS_MODEL` (e.g. `gpt-4o-mini`) in `apps/api/.env`. Keep the key server-side; the Next.js app never needs it.

### 5.4 Run dev servers

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/health

If you want the web to hit a non-default API URL, set `API_BASE_URL` for the web app (example: create `apps/web/.env.local`).

---

## 6) Useful scripts (fast ways to understand behavior)

### Seed + run pipeline on the bundled sample export

```bash
pnpm --filter @health-agent/api seed:sample
```

This:

- writes `HealthAutoExport-2026-01-01-2026-01-15.json` into local storage
- upserts canonical rows
- generates a pipeline run (and a first insights doc)

### Parser smoke / quick check

```bash
pnpm --filter @health-agent/api parse:test
```

---

## 7) Deployment (GCP)

The repo documents deploying the API to GCP with these pieces:

- **Cloud Build** builds `apps/api/Dockerfile` using `cloudbuild-api.yaml`
- **Cloud Run** runs the API container
- **Serverless/external Postgres** hosts Postgres (recommended for <$10/mo)
- **GCS** stores raw ingest JSON

See `DEPLOY_GCP.md` for the concrete commands and the low-cost “Option C” path.
- **Cloud Scheduler** triggers `/api/pipeline/run` daily

Start here:

- `DEPLOY_GCP.md`

Key notes:

- Cloud Run container sets `API_PORT=8080` (see `apps/api/Dockerfile`).
- When deploying, set real values for `INTERNAL_API_KEY`, `INGEST_TOKEN` (legacy), `PIPELINE_TOKEN` (if used), `DATABASE_URL`, `NEXTAUTH_SECRET`, and GitHub OAuth creds.
- Prefer Secret Manager (`--set-secrets`) over `--set-env-vars` for secrets.
- Grant the Cloud Run service account bucket permissions (object admin) for raw storage.

Web deployment is not scripted in this repo. The simplest path is Vercel; point it at your Cloud Run base URL via `API_BASE_URL`.

---

## 8) “Start reading here” (recommended path)

If you’re new to the codebase, this is the fastest order to build a mental model:

1. `apps/api/src/app.ts` — route registration
2. `apps/api/src/routes/ingest.ts` — ingest auth + raw storage + ingest_files
3. `apps/api/src/routes/pipeline.ts` — the whole pipeline and metrics pack
4. `apps/api/src/parsers/healthAutoExport.ts` — how raw export becomes canonical rows
5. `apps/api/prisma/schema.prisma` — canonical data model
6. `apps/web/app/page.tsx` — how the UI reads the metrics pack
7. `DEPLOY_GCP.md` — how the cloud pieces connect

---

## 9) Common gotchas

- **Dotenv location**: API reads `apps/api/.env` via `apps/api/src/dotenv.ts`.
- **Storage providers**:
  - `local` and `gcs` are implemented.
- **ESM imports**: API is ESM (`"type": "module"`), so internal TS imports include `.js` extensions.
- **Time handling**:
  - Daily tables use UTC-midnight dates.
  - Sleep/workouts store datetimes; “missing day” checks normalize to UTC days.

---

## 10) Where to make changes (common tasks)

- Add/adjust canonical schema: edit `apps/api/prisma/schema.prisma` then run `pnpm db:migrate`.
- Support a new export format: implement a new parser in `apps/api/src/parsers/` and wire it in via `apps/api/src/parsers/appleHealthStub.ts`.
- Add metrics: update `computeMetricsPack()` in `apps/api/src/routes/pipeline.ts`.
- Change ingest auth or headers: `apps/api/src/routes/ingest.ts`.
- Change LLM behavior/prompt: `apps/api/src/insights/llm.ts`.
