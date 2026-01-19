import { Card, PageHeader, Stat } from "../components/ui";
import { demoPipelineLatest } from "../demo-data";
import { formatDateTime } from "../lib/format";
import { getSessionOrNull } from "../lib/session";
import { fetchUserApi } from "../lib/api-client";

type PipelineLatestResponse = {
  latestRun:
    | {
        id: string;
        createdAt: string;
        processedIngestCount: number;
        metricsPack: unknown;
      }
    | null;
};

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const session = await getSessionOrNull();
  const isDemo = !session;
  let data: PipelineLatestResponse;

  if (isDemo) {
    data = demoPipelineLatest as PipelineLatestResponse;
  } else {
    const res = await fetchUserApi<PipelineLatestResponse>(session, "/api/pipeline/latest");
    if (!res.ok || !res.data) {
      return (
        <div className="section">
          <PageHeader title="Latest metrics" description="Raw metrics pack direct from the pipeline run." />
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
        title="Latest metrics"
        description={
          isDemo
            ? "Demo view: sign in to inspect your metrics payload."
            : "Payload from the most recent run."
        }
      />

      {data.latestRun ? (
        <>
          <Card title="Run details" subtitle="Quick context.">
            <div className="grid cols-2">
              <Stat label="Run id" value={data.latestRun.id} />
              <Stat label="Created" value={formatDateTime(data.latestRun.createdAt)} />
              <Stat label="Processed ingests" value={data.latestRun.processedIngestCount ?? "—"} />
            </div>
          </Card>

          <Card title="Metrics pack" subtitle="Full payload.">
            <details className="code-details">
              <summary className="code-summary">View raw JSON</summary>
              <pre className="code-block">{JSON.stringify(data.latestRun.metricsPack, null, 2)}</pre>
            </details>
          </Card>
        </>
      ) : (
        <Card title="No pipeline runs yet">
          <p className="muted">Trigger a run to see the raw metrics payload.</p>
        </Card>
      )}
    </div>
  );
}
