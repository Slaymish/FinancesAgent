import { Card, Grid, PageHeader, Stat } from "../components/ui";
import { auth } from "../auth";
import { demoDataQuality } from "../demo-data";

type DataQualitySummaryResponse = {
  range: { start: string; end: string };
  lastIngest: { id: string; source: string; receivedAt: string; processedAt: string | null } | null;
  lastPipelineRun: { id: string; createdAt: string; processedIngestCount: number } | null;
  missingDays: {
    weight: string[];
    nutrition: string[];
    vitals: string[];
    sleep: string[];
    workouts: string[];
  };
};

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderMissing(label: string, items: string[]) {
  return (
    <div key={label} className="stack">
      <div className="section-title">{label}</div>
      {items.length === 0 ? (
        <span className="badge positive">Complete</span>
      ) : (
        <div className="list-inline">
          {items.map((day) => (
            <span key={day} className="pill warn">
              {day}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function DataQualityPage() {
  const session = await auth();
  const isDemo = !session;

  let data: DataQualitySummaryResponse;

  if (isDemo) {
    data = demoDataQuality as DataQualitySummaryResponse;
  } else {
    const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
    const res = await fetch(`${apiBaseUrl}/api/data-quality/summary`, { cache: "no-store" });

    if (!res.ok) {
      return (
        <div className="section">
          <PageHeader title="Data quality" description="Check if the data is fresh, complete, and ready for analysis." />
          <Card title="API unavailable">
            <p className="muted">Failed to load from API: {res.status}</p>
          </Card>
        </div>
      );
    }

    data = (await res.json()) as DataQualitySummaryResponse;
  }

  return (
    <div className="section">
      <PageHeader
        title="Data quality"
        description={isDemo ? "Demo view: sign in to see your own data checks." : "Freshness of ingests, pipeline coverage, and where gaps exist."}
        meta={[{ label: "Range", value: `${data.range.start.slice(0, 10)} → ${data.range.end.slice(0, 10)}` }]}
      />

      <Grid columns={2}>
        <Card title="Ingest freshness" subtitle="When the latest ingest arrived and finished processing.">
          {data.lastIngest ? (
            <div className="stack">
              <Stat label="Ingest id" value={data.lastIngest.id} hint={`Source: ${data.lastIngest.source}`} />
              <Stat label="Received" value={formatDate(data.lastIngest.receivedAt)} />
              <Stat label="Processed" value={formatDate(data.lastIngest.processedAt)} />
            </div>
          ) : (
            <p className="muted">No ingests have been received yet.</p>
          )}
        </Card>

        <Card title="Pipeline coverage" subtitle="Latest run and how many ingests it processed.">
          {data.lastPipelineRun ? (
            <div className="stack">
              <Stat label="Run id" value={data.lastPipelineRun.id} />
              <Stat label="Created" value={formatDate(data.lastPipelineRun.createdAt)} />
              <Stat label="Processed ingests" value={data.lastPipelineRun.processedIngestCount ?? "—"} />
            </div>
          ) : (
            <p className="muted">No pipeline runs yet.</p>
          )}
        </Card>
      </Grid>

      <Card title="Missing days" subtitle="Gaps over the last 14 days by category.">
        <div className="grid cols-2">
          {renderMissing("Weight", data.missingDays.weight)}
          {renderMissing("Nutrition", data.missingDays.nutrition)}
          {renderMissing("Sleep", data.missingDays.sleep)}
          {renderMissing("Workouts", data.missingDays.workouts)}
          {renderMissing("Vitals", data.missingDays.vitals)}
        </div>
      </Card>
    </div>
  );
}
