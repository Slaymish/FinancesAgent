1) Repo + scaffolding
- [x] Create monorepo (`pnpm workspaces`)
- [x] Add `apps/api` (Fastify + TS) + `apps/web` (Next.js + TS)
- [x] Add `packages/shared` for shared types

2) Database + migrations
- [x] Stand up Postgres (Docker local)
- [x] Add Prisma schema + migrations
- [x] Create canonical tables: `ingest_files`, `daily_weight`, `daily_nutrition`, `workouts`, `sleep_sessions`, `daily_vitals`, `insights_docs`

3) Ingestion endpoint (Apple Health → you)
- [x] Implement `POST /api/ingest/apple-health`
- [x] Authenticate via `X-INGEST-TOKEN`
- [x] Store raw payload to object storage (or local disk for dev)
- [x] Insert an `ingest_files` row
- [x] Basic “last ingest status” endpoint for the UI

4) Parser + normaliser
- [x] Write a parser that turns the export format into canonical rows
- [x] Upsert logic (idempotent) so reprocessing doesn’t duplicate rows
- [x] Unit tests for parsing (one sample file)

5) Daily pipeline job
- [x] Implement `POST /api/pipeline/run`
- [x] Load unprocessed ingest files → parse → upsert → mark processed
- [x] Compute the metrics pack for last 7/14/28 days
- [x] Persist metrics pack (JSON blob tied to a run)

6) Insights doc diff writer (LLM)
- [x] Store an initial baseline `insights.md` in DB
- [x] Provide the model: previous doc + metrics pack
- [x] Require output as **unified diff**
- [x] Apply patch server-side, store new doc version + diff

7) Frontend (the “useful” screens)
- [x] Dashboard: on-track card + score tiles + key levers
- [x] Trends page (weight, calories/protein, sleep, training volume)
- [x] Insights page: latest doc + diff history
- [x] Data quality page: last ingest + missing days

8) Cloud deploy (daily automatic)
- [x] Deploy API to Cloud Run (or equivalent)
- [x] Add object storage bucket
- [x] Add hosted Postgres
- [x] Add daily scheduler to hit `/api/pipeline/run`
- [x] Point Health exporter app at your ingest endpoint

9) Tighten correctness
- [x] Add “numbers used” section under the insights doc
- [x] Add sanity checks: impossible calories, negative sleep, workout duplicates
- [ ] Add alerts: “no ingest in 36h” (optional)

10) Iterate on leverage + on-track logic
- [x] Define goal target weight + target date
- [x] Implement required weight-loss slope + compare to observed trend slope
- [x] Improve lever selection rules (always 3 max, always actionable)
