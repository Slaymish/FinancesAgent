# Deploy to GCP (Cloud Run + Cloud SQL + GCS + Cloud Scheduler)

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
  sqladmin.googleapis.com \
  cloudscheduler.googleapis.com \
  storage.googleapis.com
```

## 1) Create GCS bucket (raw ingest storage)

```bash
export BUCKET=health-agent-raw-YOUR_PROJECT_ID
export REGION=us-central1

gcloud storage buckets create gs://$BUCKET --location=$REGION
```

## 2) Create Cloud SQL Postgres

```bash
export INSTANCE=health-agent-pg
export DB=health_agent

gcloud sql instances create "$INSTANCE" \
  --database-version=POSTGRES_16 \
  --region="$REGION" \
  --edition=ENTERPRISE \
  --tier=db-custom-1-4096 \
  --storage-type=SSD \
  --storage-size=10

# run this next
gcloud sql databases create $DB --instance=$INSTANCE

gcloud sql users set-password postgres \
  --instance=$INSTANCE \
  --password='CHOOSE_A_STRONG_PASSWORD'
```

Connection name:

```bash
gcloud sql instances describe $INSTANCE --format='value(connectionName)'
```

- hamishapps:us-central1:health-agent-pg

## 3) Build and deploy API to Cloud Run

### Build image (Cloud Build)

```bash
gcloud builds submit --config cloudbuild-api.yaml --substitutions=_IMAGE=gcr.io/$PROJECT_ID/health-agent-api:latest
```

### Deploy

Set these env vars (pick strong random tokens):

- `INGEST_TOKEN` (used by exporter app)
- `PIPELINE_TOKEN` (used by Cloud Scheduler)

Do not commit real tokens/passwords into this repo. Use placeholders locally and set real values in Cloud Run.

You also need a Cloud SQL socket DATABASE_URL. Example:

```
postgresql://postgres:PASSWORD@/health_agent?host=/cloudsql/INSTANCE_CONNECTION_NAME&schema=public
```

Deploy command:

```bash
export SERVICE=health-agent-api
export IMAGE=gcr.io/$PROJECT_ID/health-agent-api:latest
export INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE --format='value(connectionName)')

gcloud run deploy $SERVICE \
  --image $IMAGE \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $INSTANCE_CONNECTION_NAME \
  --set-env-vars \
API_PORT=8080,STORAGE_PROVIDER=gcs,STORAGE_BUCKET=$BUCKET,INGEST_TOKEN=REPLACE_ME,PIPELINE_TOKEN=REPLACE_ME,DATABASE_URL='postgresql://postgres:PASSWORD@/health_agent?host=/cloudsql/'$INSTANCE_CONNECTION_NAME'&schema=public'
```

Grant the Cloud Run runtime service account permission to use the bucket (adjust SA if you use a custom one):

```bash
export RUN_SA=$(gcloud run services describe $SERVICE --region $REGION --format='value(spec.template.spec.serviceAccountName)')

gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member=serviceAccount:$RUN_SA \
  --role=roles/storage.objectAdmin
```

Run migrations locally against Cloud SQL (recommended via Cloud SQL Auth Proxy), or from a CI job.

## 4) Cloud Scheduler: daily pipeline run

Get the Cloud Run URL:

```bash
export API_URL=$(gcloud run services describe $SERVICE --region $REGION --format='value(status.url)')
```

Create a scheduler job that hits `/api/pipeline/run` with the header `X-PIPELINE-TOKEN`:

```bash
gcloud scheduler jobs create http health-agent-daily-pipeline \
  --location $REGION \
  --schedule "0 3 * * *" \
  --time-zone "UTC" \
  --uri "$API_URL/api/pipeline/run" \
  --http-method POST \
  --headers "X-PIPELINE-TOKEN=REPLACE_ME" \
  --attempt-deadline 10m
```

## 5) Point your exporter app at ingest

- Endpoint: `POST $API_URL/api/ingest/apple-health`
- Header: `X-INGEST-TOKEN: <INGEST_TOKEN>`

## Notes

- The API supports `STORAGE_PROVIDER=local` (dev) and `STORAGE_PROVIDER=gcs` (cloud).
- `/api/pipeline/run` is protected only when `PIPELINE_TOKEN` is set.
- Web deployment isn’t covered here; simplest is Vercel pointing at the API URL via `API_BASE_URL`.
