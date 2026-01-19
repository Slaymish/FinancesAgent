import { Badge, Card, Grid, PageHeader, Stat } from "../components/ui";
import { demoDataQuality } from "../demo-data";
import { formatDateTime } from "../lib/format";
import { getSessionOrNull } from "../lib/session";
import { fetchUserApi } from "../lib/api-client";

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

function renderMissing(label: string, items: string[]) {
  return (
    <div key={label} className="stack">
      <div className="section-title">{label}</div>
      {items.length === 0 ? (
        <Badge tone="positive">Complete</Badge>
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
  const session = await getSessionOrNull();
  const isDemo = !session;

  let data: DataQualitySummaryResponse;

  if (isDemo) {
    data = demoDataQuality as DataQualitySummaryResponse;
  } else {
    const res = await fetchUserApi<DataQualitySummaryResponse>(session, "/api/data-quality/summary");

    if (!res.ok || !res.data) {
      return (
        <div className="section">
          <PageHeader title="Data quality" description="Check if the data is fresh, complete, and ready for analysis." />
          <Card title="API unavailable">
            <p className="muted">Failed to load from API: {res.status}</p>
          </Card>
        </div>
      );
    }

    data = res.data;
  }

  return (
    <div className="section">
      <PageHeader
        title="Data quality"
        description={isDemo ? "Demo view: sign in for your data checks." : "Freshness, coverage, and gaps."}
        meta={[{ label: "Range", value: `${data.range.start.slice(0, 10)} → ${data.range.end.slice(0, 10)}` }]}
      />

      <Grid columns={2}>
        <Card title="Ingest freshness" subtitle="Latest ingest timing.">
          {data.lastIngest ? (
            <div className="stack">
              <Stat label="Ingest id" value={data.lastIngest.id} hint={`Source: ${data.lastIngest.source}`} />
              <Stat label="Received" value={formatDateTime(data.lastIngest.receivedAt)} />
              <Stat label="Processed" value={formatDateTime(data.lastIngest.processedAt)} />
            </div>
          ) : (
            <p className="muted">No ingests have been received yet.</p>
          )}
        </Card>

        <Card title="Pipeline coverage" subtitle="Latest run and ingests processed.">
          {data.lastPipelineRun ? (
            <div className="stack">
              <Stat label="Run id" value={data.lastPipelineRun.id} />
              <Stat label="Created" value={formatDateTime(data.lastPipelineRun.createdAt)} />
              <Stat label="Processed ingests" value={data.lastPipelineRun.processedIngestCount ?? "—"} />
            </div>
          ) : (
            <p className="muted">No pipeline runs yet.</p>
          )}
        </Card>
      </Grid>

      <Card title="Missing days" subtitle="Gaps in the last 14 days.">
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
