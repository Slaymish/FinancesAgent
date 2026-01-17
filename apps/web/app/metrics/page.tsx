import { Card, PageHeader, Stat } from "../components/ui";

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

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function MetricsPage() {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiBaseUrl}/api/pipeline/latest`);

  if (!res.ok) {
    return (
      <div className="section">
        <PageHeader title="Latest metrics" description="Raw metrics pack direct from the pipeline run." />
        <Card title="API unavailable">
          <p className="muted">Failed to load from API: {res.status}</p>
        </Card>
      </div>
    );
  }

  const data = (await res.json()) as PipelineLatestResponse;

  return (
    <div className="section">
      <PageHeader title="Latest metrics" description="Everything emitted by the most recent run for debugging and exploration." />

      {data.latestRun ? (
        <>
          <Card title="Run details" subtitle="Quick context before diving into the payload.">
            <div className="grid cols-2">
              <Stat label="Run id" value={data.latestRun.id} />
              <Stat label="Created" value={formatDate(data.latestRun.createdAt)} />
              <Stat label="Processed ingests" value={data.latestRun.processedIngestCount ?? "—"} />
            </div>
          </Card>

          <Card title="Metrics pack">
            <pre className="code-block">{JSON.stringify(data.latestRun.metricsPack, null, 2)}</pre>
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
