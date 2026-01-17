import { Badge, Card, Grid, PageHeader, Stat } from "./components/ui";

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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function describe(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default async function HomePage() {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiBaseUrl}/api/pipeline/latest`);

  if (!res.ok) {
    return (
      <div className="section">
        <PageHeader title="Dashboard" description="Signals that show whether the plan is working and where to focus." />
        <Card title="API unavailable">
          <p className="muted">Failed to load from API: {res.status}</p>
        </Card>
      </div>
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

  const scoreTiles = [
    { label: "Weight", value: pack?.weight },
    { label: "Nutrition", value: pack?.nutrition },
    { label: "Training", value: pack?.training },
    { label: "Sleep", value: pack?.sleep },
    { label: "Recovery", value: pack?.recovery }
  ];

  return (
    <div className="section">
      <PageHeader
        title="Dashboard"
        description="Latest read on whether the plan is on track, how the inputs look, and the levers to pull next."
        meta={
          data.latestRun
            ? [{ label: "Last run", value: formatDate(data.latestRun.createdAt) }]
            : [{ label: "Pipeline", value: "Not run yet" }]
        }
      />

      {!data.latestRun ? (
        <Card title="No pipeline runs yet">
          <p className="muted">Ingest data and trigger a pipeline run to start seeing health signals.</p>
        </Card>
      ) : (
        <>
          <Grid columns={2}>
            <Card
              title="Latest pipeline run"
              subtitle="Quick check that ingestion and processing are flowing."
              action={<Badge tone="neutral">Run {data.latestRun.id}</Badge>}
            >
              <div className="stack">
                <Stat label="Created" value={formatDate(data.latestRun.createdAt)} />
                <Stat label="Processed ingest files" value={data.latestRun.processedIngestCount ?? "—"} />
              </div>
            </Card>

            <Card
              title="Goal tracking"
              subtitle="Compares the plan to current trend so we can adjust early."
              action={
                onTrack ? (
                  <Badge tone={onTrack.onTrack ? "positive" : "negative"}>
                    {onTrack.onTrack ? "On track" : "Off track"}
                  </Badge>
                ) : (
                  <Badge tone="neutral">No goal set</Badge>
                )
              }
            >
              {onTrack ? (
                <div className="stack">
                  <Stat label="Target" value={`${onTrack.targetWeightKg} kg by ${onTrack.targetDate}`} />
                  <Stat
                    label="Required slope"
                    hint="Expected rate to hit the target"
                    value={`${onTrack.requiredSlopeKgPerDay.toFixed(3)} kg/day`}
                  />
                  <Stat
                    label="Observed slope (14d)"
                    hint="Current trend based on the last two weeks"
                    value={`${onTrack.observedSlopeKgPerDay14.toFixed(3)} kg/day`}
                  />
                </div>
              ) : (
                <p className="muted">
                  Goal not configured. Set <code>GOAL_TARGET_WEIGHT_KG</code> and <code>GOAL_TARGET_DATE</code> in the API
                  environment.
                </p>
              )}
            </Card>
          </Grid>

          <Card title="Score tiles" subtitle="High-level health inputs and readiness at a glance.">
            <Grid columns={3}>
              {scoreTiles.map((tile) => (
                <Stat key={tile.label} label={tile.label} value={describe(tile.value)} />
              ))}
            </Grid>
          </Card>

          <Card title="Key levers" subtitle="Actions that matter most right now.">
            {levers.length ? (
              <div className="list-inline">
                {levers.map((lever) => (
                  <span key={lever} className="pill">
                    {lever}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">No levers were identified for this run.</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
