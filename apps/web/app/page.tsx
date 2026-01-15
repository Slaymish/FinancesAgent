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

export default async function HomePage() {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiBaseUrl}/api/pipeline/latest`);

  if (!res.ok) {
    return (
      <main>
        <h1>Dashboard</h1>
        <p>Failed to load from API: {res.status}</p>
      </main>
    );
  }

  const data = (await res.json()) as PipelineLatestResponse;
  const pack = data.latestRun?.metricsPack;

  const onTrack = pack?.onTrack as
    | {
        onTrack: boolean;
        targetWeightKg: number;
        targetDate: string;
        requiredSlopeKgPerDay: number;
        observedSlopeKgPerDay14: number;
      }
    | null
    | undefined;

  const levers = (pack?.levers ?? []) as string[];

  return (
    <main>
      <h1>Dashboard</h1>

      {!data.latestRun ? (
        <p>No pipeline runs yet.</p>
      ) : (
        <>
          <p>
            Latest run: {data.latestRun.id} ({data.latestRun.createdAt})
          </p>

          <h2>On track</h2>
          {onTrack ? (
            <pre>
              {JSON.stringify(
                {
                  onTrack: onTrack.onTrack,
                  targetWeightKg: onTrack.targetWeightKg,
                  targetDate: onTrack.targetDate,
                  requiredSlopeKgPerDay: onTrack.requiredSlopeKgPerDay,
                  observedSlopeKgPerDay14: onTrack.observedSlopeKgPerDay14
                },
                null,
                2
              )}
            </pre>
          ) : (
            <p>Goal not configured (set GOAL_TARGET_WEIGHT_KG + GOAL_TARGET_DATE in API env).</p>
          )}

          <h2>Score tiles</h2>
          <pre>
            {JSON.stringify(
              {
                weight: pack?.weight,
                nutrition: pack?.nutrition,
                training: pack?.training,
                sleep: pack?.sleep,
                recovery: pack?.recovery
              },
              null,
              2
            )}
          </pre>

          <h2>Key levers</h2>
          {levers.length ? <pre>{JSON.stringify(levers, null, 2)}</pre> : <p>(no levers)</p>}
        </>
      )}
    </main>
  );
}
