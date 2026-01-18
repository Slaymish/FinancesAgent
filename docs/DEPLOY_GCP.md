# Deploy to GCP (Cloud Run + Postgres + GCS + Cloud Scheduler)

This repo is set up to deploy the API to Cloud Run and store raw ingests in GCS.

## Prereqs

- `gcloud` installed and authenticated
- A GCP project selected

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Enable required APIs:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  storage.googleapis.com
```

If you choose **Option B (Cloud SQL)**, you will also need:

```bash
gcloud services enable sqladmin.googleapis.com
```

## 1) Create GCS bucket (raw ingest storage)

```bash
export BUCKET=health-agent-raw-YOUR_PROJECT_ID
# If your database is in APAC (e.g. Neon ap-southeast-2), using an AU region reduces latency/egress.
export REGION=australia-southeast1

gcloud storage buckets create gs://$BUCKET --location=$REGION
```

## 2) Choose your Postgres

This repo uses Postgres via Prisma. You have two options:

- **Option B (managed on GCP): Cloud SQL Postgres** (easy, but can be surprisingly expensive if left running)
- **Option C (budget-friendly): external/serverless Postgres** (avoids “always-on Cloud SQL VM” costs)

If your goal is **<$10/month** and you only ingest once a day, Option C is usually the best fit.

### Option C (recommended for low budget): external/serverless Postgres

Use a Postgres provider that supports **connection pooling** (often via a “pooled” connection string / PgBouncer endpoint). Prisma works best with a pooled endpoint when your compute can scale.

What you need from the provider:

- A Postgres database
- A **pooled** connection string (preferred)
- A **direct** connection string (sometimes required for migrations)

Set these as env vars (names are up to you; the API only requires `DATABASE_URL`):

- `DATABASE_URL` = pooled URL (recommended for runtime)
- `DATABASE_DIRECT_URL` = direct URL (recommended for migrations), if your provider gives one

Then run migrations from your machine:

```bash
# Example:
# export DATABASE_URL='postgresql://...'
# export DATABASE_DIRECT_URL='postgresql://...'
pnpm --filter @health-agent/api prisma:deploy
```

Deploying to Cloud Run (no Cloud SQL attachment):

```bash
export SERVICE=health-agent-api
export IMAGE=gcr.io/$PROJECT_ID/health-agent-api:latest

gcloud run deploy $SERVICE \
  --image $IMAGE \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars \
API_PORT=8080,STORAGE_PROVIDER=gcs,STORAGE_BUCKET=$BUCKET,INGEST_TOKEN=REPLACE_ME,PIPELINE_TOKEN=REPLACE_ME,INSIGHTS_ENABLED=false,DATABASE_URL='REPLACE_WITH_PROVIDER_URL'
```

Note: avoid putting secrets directly in command history. For production, prefer Secret Manager + `--set-secrets`.

Insights are off-by-default. If you want LLM insights, set `INSIGHTS_ENABLED=true` and provide `OPENAI_API_KEY` + `INSIGHTS_MODEL`.

When deploying the Cloud Run service, you will **not** use `--add-cloudsql-instances` and you will set `DATABASE_URL` to the provider URL.

### Option B: Cloud SQL Postgres

Cloud SQL is supported but is intentionally **not** the default path (it’s easy to pay for 24/7 instance uptime). See **Appendix: Cloud SQL (Option B)** at the bottom of this doc.

## 3) Build and deploy API to Cloud Run

### Build image (Cloud Build)

```bash
gcloud builds submit --config cloudbuild-api.yaml
```

This will push:

- `gcr.io/$PROJECT_ID/health-agent-api:$BUILD_ID`
- `gcr.io/$PROJECT_ID/health-agent-api:latest`

### Deploy

Set these env vars (pick strong random tokens):

- `INTERNAL_API_KEY` (shared between API and web; required on all reads)
- `INGEST_TOKEN` (optional legacy fallback; new users get per-user tokens from the web app)
- `PIPELINE_TOKEN` (used by Cloud Scheduler)

Do not commit real tokens/passwords into this repo. Use placeholders locally and set real values in Cloud Run.

Note: `gcloud run services describe ... --format='value(...env)'` will print your secrets in plaintext. Avoid pasting that output into docs/chats. If secrets are exposed, rotate them.

Deploy command (Option C / external Postgres):

```bash
export SERVICE=health-agent-api
export IMAGE=gcr.io/$PROJECT_ID/health-agent-api:latest

gcloud run deploy $SERVICE \
  --image $IMAGE \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars \
API_PORT=8080,STORAGE_PROVIDER=gcs,STORAGE_BUCKET=$BUCKET,INGEST_TOKEN=REPLACE_ME,INTERNAL_API_KEY=REPLACE_ME,PIPELINE_TOKEN=REPLACE_ME,INSIGHTS_ENABLED=false,DATABASE_URL='REPLACE_WITH_PROVIDER_URL'
```

### Low-cost Cloud Run settings (recommended)

To keep Cloud Run costs near-zero when idle:

- Set **min instances = 0**
- Consider setting **max instances = 1** (helps protect your Postgres from too many concurrent connections)

You can also apply these settings independently later:

```bash
gcloud run deploy $SERVICE --region $REGION --min-instances 0 --max-instances 1
```

For production, prefer storing `INGEST_TOKEN`, `PIPELINE_TOKEN`, and `DATABASE_URL` in Secret Manager and mounting them as env vars via `--set-secrets` instead of `--set-env-vars`.

Grant the Cloud Run runtime service account permission to use the bucket (adjust SA if you use a custom one):

```bash
export RUN_SA=$(gcloud run services describe $SERVICE --region $REGION --format='value(spec.template.spec.serviceAccountName)')

gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=serviceAccount:$RUN_SA \
  --role=roles/storage.objectAdmin

```

## 4) Configure Health Auto Export (REST push)

Once your API is deployed, set up your exporter (Health Auto Export app or Apple Shortcut) to POST the JSON export to:

- `https://YOUR_CLOUD_RUN_URL/api/ingest/apple-health`

Auth headers (pick one):

- `Authorization: Bearer <INGEST_TOKEN>`
- OR `X-INGEST-TOKEN: <INGEST_TOKEN>`

Troubleshooting tips:

- If uploads fail for very large date ranges, switch to daily exports (the API allows up to ~50MB, but mobile networks/timeouts are the usual limit).
- Check `GET /api/ingest/status` to confirm the last ingest arrived.

## 5) Cloud Scheduler: daily pipeline run

Get the Cloud Run URL:

```bash
export API_URL=$(gcloud run services describe $SERVICE --region $REGION --format='value(status.url)')
```

Create a scheduler job that hits `/api/pipeline/run` with `X-PIPELINE-TOKEN` **and** `X-USER-ID` (one job per user; you can also use `X-INTERNAL-API-KEY` instead of `X-PIPELINE-TOKEN` if you prefer):

```bash
gcloud scheduler jobs create http health-agent-daily-pipeline \
  --location $REGION \
  --schedule "0 3 * * *" \
  --time-zone "UTC" \
  --uri "$API_URL/api/pipeline/run" \
  --http-method POST \
  --headers "X-PIPELINE-TOKEN=REPLACE_ME,X-USER-ID=REPLACE_USER_ID" \
  --attempt-deadline 10m
```

## Notes

- The API supports `STORAGE_PROVIDER=local` (dev) and `STORAGE_PROVIDER=gcs` (cloud).
- `/api/pipeline/run` requires `x-user-id` plus either `x-internal-api-key` or `x-pipeline-token`.
- Web deployment isn’t covered here; simplest is Vercel pointing at the API URL via `API_BASE_URL`.
- If you only upload once a day, Cloud Run + Scheduler + external Postgres typically stays very cheap; your largest variable cost is usually LLM usage if `OPENAI_API_KEY` is enabled.

---

## Appendix: Cloud SQL (Option B)

Cloud SQL works, but is often not a good fit for a strict hobby budget because it’s easy to pay for 24/7 instance uptime.

### Create Cloud SQL instance

```bash
export INSTANCE=health-agent-pg
export DB=health_agent

gcloud services enable sqladmin.googleapis.com

gcloud sql instances create "$INSTANCE" \
  --database-version=POSTGRES_16 \
  --region="$REGION" \
  --edition=ENTERPRISE \
  --tier=db-custom-1-4096 \
  --storage-type=SSD \
  --storage-size=10

gcloud sql databases create $DB --instance=$INSTANCE

gcloud sql users set-password postgres \
  --instance=$INSTANCE \
  --password='CHOOSE_A_STRONG_PASSWORD'

export INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE --format='value(connectionName)')
echo "$INSTANCE_CONNECTION_NAME"
```

### Deploy Cloud Run with Cloud SQL attachment

Cloud SQL socket `DATABASE_URL` example:

`postgresql://postgres:PASSWORD@/health_agent?host=/cloudsql/INSTANCE_CONNECTION_NAME&schema=public`

```bash
gcloud run deploy $SERVICE \
  --image $IMAGE \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $INSTANCE_CONNECTION_NAME \
  --set-env-vars \
API_PORT=8080,STORAGE_PROVIDER=gcs,STORAGE_BUCKET=$BUCKET,INGEST_TOKEN=REPLACE_ME,PIPELINE_TOKEN=REPLACE_ME,DATABASE_URL='postgresql://postgres:PASSWORD@/health_agent?host=/cloudsql/'$INSTANCE_CONNECTION_NAME'&schema=public'
```

### Run migrations (Cloud SQL Auth Proxy)

Before running the proxy, ensure you have Application Default Credentials (ADC) set up (this is separate from `gcloud auth login`):

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project $PROJECT_ID
```

Your user (or service account) also needs `roles/cloudsql.client` on the project.

```bash
export PROXY_PORT=5433
cloud-sql-proxy "$INSTANCE_CONNECTION_NAME" --port $PROXY_PORT
```

In another terminal:

```bash
read -s CLOUDSQL_POSTGRES_PASSWORD?"Cloud SQL postgres password: " && echo
export DATABASE_URL="postgresql://postgres:$CLOUDSQL_POSTGRES_PASSWORD@localhost:$PROXY_PORT/health_agent?schema=public"
pnpm --filter @health-agent/api prisma:deploy
```
