type PipelineLatestResponse = {
  latestRun:
    | {
        id: string;
        createdAt: string;
        processedIngestCount: number;
        metricsPack: any;
      }
    | null;
};

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiBaseUrl}/api/pipeline/latest`);

  if (!res.ok) {
    return (
      <main>
        <h1>Trends</h1>
        <p>Failed to load from API: {res.status}</p>
      </main>
    );
  }

  const data = (await res.json()) as PipelineLatestResponse;
  const pack = data.latestRun?.metricsPack;

  const weightSeries = (pack?.trends?.weightSeries ?? []) as Array<{ date: string; weightKg: number }>;
  const nutritionSeries = (pack?.trends?.nutritionSeries ?? []) as Array<{ date: string; calories: number | null; proteinG: number | null }>;
  const sleepSeries = (pack?.trends?.sleepSeries ?? []) as Array<{ date: string; minutes: number }>;
  const trainingSeries = (pack?.trends?.trainingSeries ?? []) as Array<{ date: string; minutes: number }>;

  return (
    <main>
      <h1>Trends</h1>
      {!data.latestRun ? (
        <p>No pipeline runs yet.</p>
      ) : (
        <>
          <p>
            Run: {data.latestRun.id} ({data.latestRun.createdAt})
          </p>

          <h2>Weight</h2>
          <pre>{JSON.stringify(weightSeries, null, 2)}</pre>

          <h2>Nutrition (calories + protein)</h2>
          <pre>{JSON.stringify(nutritionSeries, null, 2)}</pre>

          <h2>Sleep (minutes)</h2>
          <pre>{JSON.stringify(sleepSeries, null, 2)}</pre>

          <h2>Training (minutes)</h2>
          <pre>{JSON.stringify(trainingSeries, null, 2)}</pre>
        </>
      )}
    </main>
  );
}
