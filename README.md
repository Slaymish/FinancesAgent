# FinanceAgent

FinanceAgent turns daily Akahu bank transactions into a clean, opinionated finance dashboard.

- API: Fastify + Prisma (Postgres)
- Web: Next.js App Router
- Auth: NextAuth (GitHub) with demo data when signed out
- Scheduler: Cloud Scheduler hitting `/api/pipeline/run`

## What it does

- Daily sync → transactions + categories → metrics pack
- Category rules managed in the UI (pattern + field + amount conditions)
- Trends for spend, savings, wants/essentials, and cashflow

## Repo layout

- `apps/api` — Fastify API + Prisma
- `apps/web` — Next.js frontend

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

## Key endpoints

- `POST /api/pipeline/run` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`, or `X-PIPELINE-TOKEN` + `X-USER-ID`)
- `GET /api/pipeline/latest` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `GET /api/categories` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `POST /api/categories` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `GET /api/transactions/summary` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)

## Config (API)

See `.env.example` for the full list. Common ones:

- `AKAHU_APP_TOKEN`
- `AKAHU_USER_TOKEN`
- `INTERNAL_API_KEY`
- `PIPELINE_TOKEN`
- `API_BASE_URL` (for the web app to call the API)
- `NEXTAUTH_SECRET` + `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` (web auth)
- `DATABASE_URL`

## Deploy

GCP deployment (Cloud Run + Cloud Scheduler + Neon Postgres + Vercel) is documented in `docs/DEPLOY_GCP.md`.
