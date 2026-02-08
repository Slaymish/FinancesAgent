# Deploy to GCP (Cloud Run + Cloud Scheduler + Neon)

Low-cost path for the finance API.

## Quick path

1) Use Neon (or another serverless Postgres)
2) Build and deploy the API to Cloud Run
3) Add a Cloud Scheduler job for `/api/pipeline/run`

## Prereqs

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com cloudscheduler.googleapis.com
```

## Build + deploy

```bash
gcloud builds submit --config cloudbuild-api.yaml

export SERVICE=finance-agent-api
export REGION=australia-southeast1
export IMAGE=gcr.io/$PROJECT_ID/finance-agent-api:latest

gcloud run deploy $SERVICE \
  --image $IMAGE \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars \
API_PORT=8080,INTERNAL_API_KEY=REPLACE_ME,PIPELINE_TOKEN=REPLACE_ME,AKAHU_APP_TOKEN=REPLACE_ME,AKAHU_USER_TOKEN=REPLACE_ME,DATABASE_URL='REPLACE_WITH_NEON_URL'
```

## Daily pipeline job

```bash
export API_URL=$(gcloud run services describe $SERVICE --region $REGION --format='value(status.url)')

gcloud scheduler jobs create http finance-agent-daily-pipeline \
  --location $REGION \
  --schedule "0 3 * * *" \
  --time-zone "UTC" \
  --uri "$API_URL/api/pipeline/run" \
  --http-method POST \
  --headers "X-PIPELINE-TOKEN=REPLACE_ME,X-USER-ID=REPLACE_USER_ID" \
  --attempt-deadline 10m
```

## Notes

- Prefer Secret Manager for secrets.
- Web on Vercel must also have `DATABASE_URL` (and ideally `DATABASE_DIRECT_URL`) so Prisma migrations can run during build.
- Set `NEXTAUTH_URL` to the exact public web origin (for example `https://app.example.com`) to avoid OAuth state-cookie callback errors.
- Web build now runs `prisma migrate deploy` automatically before `next build`.
- Cloud SQL is supported but always-on; keep it off for low usage.
