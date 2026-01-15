type InsightsLatestResponse = {
  latest:
    | {
        id: string;
        createdAt: string;
        markdown: string;
        diffFromPrev: string | null;
        pipelineRunId: string | null;
      }
    | null;
};

type InsightsHistoryResponse = {
  docs: Array<{
    id: string;
    createdAt: string;
    diffFromPrev: string | null;
    pipelineRunId: string | null;
  }>;
};

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";

  const [latestRes, historyRes] = await Promise.all([
    fetch(`${apiBaseUrl}/api/insights/latest`),
    fetch(`${apiBaseUrl}/api/insights/history`)
  ]);

  if (!latestRes.ok || !historyRes.ok) {
    return (
      <main>
        <h1>Insights</h1>
        <p>Failed to load insights from API.</p>
      </main>
    );
  }

  const latest = (await latestRes.json()) as InsightsLatestResponse;
  const history = (await historyRes.json()) as InsightsHistoryResponse;

  return (
    <main>
      <h1>Insights</h1>

      {!latest.latest ? (
        <p>No insights docs yet.</p>
      ) : (
        <>
          <p>
            Latest: {latest.latest.id} ({latest.latest.createdAt})
          </p>
          <h2>Document</h2>
          <pre>{latest.latest.markdown}</pre>

          <h2>Diff from previous</h2>
          <pre>{latest.latest.diffFromPrev ?? "(no diff)"}</pre>
        </>
      )}

      <h2>History</h2>
      <pre>{JSON.stringify(history.docs, null, 2)}</pre>
    </main>
  );
}
