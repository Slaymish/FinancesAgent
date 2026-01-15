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

export default async function DataQualityPage() {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiBaseUrl}/api/data-quality/summary`);

  if (!res.ok) {
    return (
      <main>
        <h1>Data quality</h1>
        <p>Failed to load from API: {res.status}</p>
      </main>
    );
  }

  const data = (await res.json()) as DataQualitySummaryResponse;

  return (
    <main>
      <h1>Data quality</h1>
      <p>
        Range: {data.range.start.slice(0, 10)} → {data.range.end.slice(0, 10)}
      </p>

      <h2>Last ingest</h2>
      <pre>{JSON.stringify(data.lastIngest, null, 2)}</pre>

      <h2>Last pipeline run</h2>
      <pre>{JSON.stringify(data.lastPipelineRun, null, 2)}</pre>

      <h2>Missing days (last 14 days)</h2>
      <pre>{JSON.stringify(data.missingDays, null, 2)}</pre>
    </main>
  );
}
