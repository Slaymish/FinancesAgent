# FinanceAgent

FinanceAgent turns daily Akahu bank transactions into a clean, opinionated finance dashboard.

- API: Fastify + Prisma (Postgres)
- Web: Next.js App Router
- Auth: NextAuth (GitHub) with demo data when signed out
- Scheduler: Cloud Scheduler hitting `/api/pipeline/run`

## What it does

- Daily sync → transactions + categories → metrics pack
- ML-assisted categorization with user-confirmed labels
- **Inbox**: Model-assisted transaction categorization with review workflow
- Trends for spend, savings, wants/essentials, and cashflow

## Inbox Feature

The Inbox provides an intelligent workflow for categorizing transactions:

### State Machine

Every transaction has exactly one inbox state:

1. **auto_classified**: Category applied automatically with high confidence
   - Applied when model prediction confidence ≥ threshold (default 0.85, source = model)
2. **needs_review**: Model suggests a category but confidence is below threshold
   - User must confirm or pick a different category
3. **unclassified**: Suggestion falls back to `Uncategorised`
   - User can confirm the fallback or pick a different category
4. **cleared**: User has confirmed/set the category

### Categorization Flow

Transaction processing:

1. **Model prediction** (ML-assisted)
   - Extract features (merchant, description tokens, amount bucket, direction, account)
   - Predict with user's trained model
   - If confidence ≥ threshold → auto_classified
   - If confidence < threshold → needs_review with suggestion
2. **No model available yet**
   - Suggestion defaults to `Uncategorised`

### Model Training

- **Training data**: Only transactions with `categoryConfirmed=true` (user explicitly confirmed)
- **Trigger**: Automatic after user category confirmations/edits, and also periodically during pipeline runs
- **Algorithm**: Multinomial logistic regression with L2 regularization
- **Features**: Feature hashing (4096 dimensions) of:
  - Merchant name (normalized)
  - Description tokens (lowercase)
  - Amount bucket (tiny/small/medium/large/huge)
  - Direction (in/out)
  - Account ID
- **Storage**: Model weights stored as JSON in `category_models` table per user

### Gamification

- **Streak**: Consecutive days with inbox cleared (showing confirmations)
- **Auto-classified %**: Percentage of transactions auto-categorized in last 7 days
- **To clear count**: Number of transactions in needs_review + unclassified states

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
- `PUT /api/categories` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `GET /api/transactions/summary` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `GET /api/transactions/categories` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `PUT /api/transactions/:id/category` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `GET /api/inbox` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `POST /api/inbox/:id/confirm` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `GET /api/inbox/stats` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)
- `POST /api/inbox/reprocess` (auth: `X-INTERNAL-API-KEY` + `X-USER-ID`)

## Config (API)

See `.env.example` for the full list. Common ones:

- `AKAHU_APP_TOKEN`
- `AKAHU_USER_TOKEN`
- `AKAHU_BASE_URL` (optional)
- `AKAHU_LOOKBACK_DAYS` (optional)
- `INTERNAL_API_KEY`
- `PIPELINE_TOKEN`
- `API_BASE_URL` (for the web app to call the API)
- `NEXTAUTH_SECRET` + `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` (web auth)
- `DATABASE_URL` (+ `DATABASE_DIRECT_URL` recommended)
- `NEXTAUTH_URL` must match your deployed web origin exactly in production

## Deploy

GCP deployment (Cloud Run + Cloud Scheduler + Neon Postgres + Vercel) is documented in `docs/DEPLOY_GCP.md`.
