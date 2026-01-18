import Link from "next/link";
import { Badge, Card, Grid, PageHeader, Stat } from "./components/ui";
import { demoPipelineLatest } from "./demo-data";
import { formatDateTime, formatDelta, formatMinutes, formatNumber, type DeltaTone } from "./lib/format";
import { getSessionOrNull } from "./lib/session";
import { fetchUserApi } from "./lib/api-client";

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

function GlanceSignal({
  title,
  value,
  hint,
  delta,
  link
}: {
  title: string;
  value: string;
  hint?: string;
  delta?: { text: string; tone: DeltaTone };
  link?: string;
}) {
  return (
    <div className="glance-block">
      <div className="glance-block__header">
        <h4 className="glance-title">{title}</h4>
        {delta ? <span className={`delta ${delta.tone === "neutral" ? "" : delta.tone}`.trim()}>{delta.text}</span> : null}
      </div>
      <div className="glance-value">{value}</div>
      {hint ? <p className="muted">{hint}</p> : null}
      {link ? (
        <Link className="chip" href={link}>
          View detail →
        </Link>
      ) : null}
    </div>
  );
}

function ChangeItem({
  title,
  detail,
  tone,
  link
}: {
  title: string;
  detail: string;
  tone?: DeltaTone;
  link?: string;
}) {
  const toneClass =
    tone === "positive" ? "good" : tone === "negative" ? "attention" : tone === "warn" ? "warn" : "";
  return (
    <li className="change-item">
      <div className="change-meta">
        <span className={`chip ${toneClass}`.trim()}>{tone === "negative" ? "Attention" : tone === "warn" ? "Caution" : "Update"}</span>
        {link ? (
          <Link className="chip" href={link}>
            Evidence
          </Link>
        ) : null}
      </div>
      <div className="stat-value">{title}</div>
      <p className="muted">{detail}</p>
    </li>
  );
}

function LeverCard({
  text,
  why,
  confidence
}: {
  text: string;
  why?: string;
  confidence?: string;
}) {
  return (
    <div className="lever-card">
      <h4 className="lever-title">{text}</h4>
      {why ? <div className="lever-why">{why}</div> : null}
      {confidence ? <span className="chip">{confidence}</span> : null}
    </div>
  );
}

export default async function HomePage() {
  const session = await getSessionOrNull();
  const isDemo = !session;

  let data: PipelineLatestResponse;
  if (isDemo) {
    data = demoPipelineLatest;
  } else {
    const res = await fetchUserApi<PipelineLatestResponse>(session, "/api/pipeline/latest");
    if (!res.ok || !res.data) {
      return (
        <div className="section">
          <PageHeader title="Status" description="Signals that show whether the plan is working and where to focus next." />
          <Card title="API unavailable">
            <p className="muted">Failed to load from API: {res.status}</p>
          </Card>
        </div>
      );
    }
    data = res.data;
  }

  const pack = data.latestRun?.metricsPack;

  const goalProjection = pack?.goalProjection as
    | {
        targetWeightKg: number;
        latestWeightKg: number;
        deltaToGoalKg: number;
        observedSlopeKgPerDay14: number;
        observedSlopeKgPerWeek?: number;
        projectedDaysToGoal: number | null;
        projectedDate: string | null;
        trend: "toward" | "away" | "flat" | "at-goal";
      }
    | null
    | undefined;

  const levers = (pack?.levers ?? []) as string[];

  const weightSlope7 = pack?.weight?.slopeKgPerDay7;
  const weightSlope14 = pack?.weight?.slopeKgPerDay14;
  const calories7 = pack?.nutrition?.avgCalories7;
  const calories14 = pack?.nutrition?.avgCalories14;
  const protein7 = pack?.nutrition?.avgProteinG7;
  const protein14 = pack?.nutrition?.avgProteinG14;
  const sleep7 = pack?.sleep?.avgSleepMin7;
  const sleep14 = pack?.sleep?.avgSleepMin14;
  const trainingSessions7 = pack?.training?.sessions7;
  const trainingSessions14 = pack?.training?.sessions14;
  const trainingMinutes7 = pack?.training?.minutes7;

  const confidenceNotes: string[] = [];
  if (sleep7 == null || sleep14 == null) {
    confidenceNotes.push("Sleep data missing; recovery trends may be unreliable.");
  }
  if (calories7 == null || protein7 == null) {
    confidenceNotes.push("Nutrition logging incomplete; calorie/protein signals may be soft.");
  }
  if (trainingSessions7 == null) {
    confidenceNotes.push("Training data missing this week; cadence may be undercounted.");
  }

  const projectionReachable = goalProjection?.projectedDate != null;
  const projectionTone: DeltaTone =
    goalProjection && (goalProjection.trend === "toward" || goalProjection.trend === "at-goal") ? "positive" : goalProjection ? "negative" : "neutral";
  const projectedDateLabel =
    goalProjection && goalProjection.projectedDate
      ? formatDateTime(goalProjection.projectedDate, { dateStyle: "medium" })
      : null;
  const projectionHint = goalProjection
    ? goalProjection.trend === "at-goal"
      ? `Goal met at ${goalProjection.targetWeightKg} kg.`
      : projectionReachable
        ? `Est. ${goalProjection.targetWeightKg} kg by ${projectedDateLabel}.`
        : `Current pace won't reach ${goalProjection.targetWeightKg} kg (trend ${goalProjection.trend}).`
    : "Set a target weight to see a projection.";

  const headlineSignals = [
    {
      title: "Weight trend",
      value: weightSlope14 != null ? `${formatNumber(weightSlope14, 3)} kg/day (14d)` : "No recent readings",
      delta: formatDelta(weightSlope7, weightSlope14, "kg/day", {
        precision: 3,
        goodDirection: "down"
      }),
      hint: projectionHint,
      link: "/trends"
    },
    {
      title: "Calorie adherence",
      value: calories7 != null ? `${formatNumber(calories7, 0)} avg kcal (7d)` : "No recent logs",
      delta: formatDelta(calories7, calories14, "kcal", {
        precision: 0,
        goodDirection: "down"
      }),
      hint: protein7 != null ? `Protein ${formatNumber(protein7, 0)}g (7d).` : undefined,
      link: "/trends"
    },
    {
      title: "Sleep consistency",
      value: sleep7 != null ? `${formatMinutes(sleep7)} avg (7d)` : "No sleep captured",
      delta: formatDelta(sleep7, sleep14, "min", {
        precision: 0,
        goodDirection: "up"
      }),
      hint: "Keep nightly variance tight to steady hunger and recovery.",
      link: "/trends"
    },
    {
      title: "Training cadence",
      value: trainingSessions7 != null ? `${formatNumber(trainingSessions7, 0)} sessions (7d)` : "No training logged",
      delta: formatDelta(trainingSessions7, trainingSessions14, "sessions", {
        precision: 0,
        goodDirection: "up"
      }),
      hint: trainingMinutes7 != null ? `${formatMinutes(trainingMinutes7)} total minutes.` : undefined,
      link: "/trends"
    }
  ];

  const changeSummary: Array<{ title: string; detail: string; tone: DeltaTone; link?: string }> = [
    {
      title: "Direction of change",
      detail:
        weightSlope14 != null
          ? goalProjection
            ? goalProjection.trend === "at-goal"
              ? `Goal met; 14d slope ${formatNumber(weightSlope14, 3)} kg/day.`
              : projectionReachable
                ? `14d slope ${formatNumber(weightSlope14, 3)} kg/day → ${goalProjection.targetWeightKg} kg by ${projectedDateLabel}.`
                : `14d slope ${formatNumber(weightSlope14, 3)} kg/day is ${
                    goalProjection.trend === "away" ? "moving away from" : "flat toward"
                  } ${goalProjection.targetWeightKg} kg.`
            : `14d weight slope ${formatNumber(weightSlope14, 3)} kg/day; set a goal weight for a projection.`
          : "No weight slope available.",
      tone: goalProjection ? projectionTone : "neutral",
      link: "/trends"
    },
    {
      title: "Nutrition shift",
      detail:
        calories7 != null && calories14 != null
          ? `Calories ${formatNumber(calories7, 0)} vs ${formatNumber(calories14, 0)} last week; protein ${
              protein7 != null ? `${formatNumber(protein7, 0)}g` : "—"
            }`
          : "No recent calorie/protein data.",
      tone: "warn",
      link: "/trends"
    },
    {
      title: "Recovery + sleep",
      detail:
        sleep7 != null && sleep14 != null
          ? `Sleep ${formatMinutes(sleep7)} vs ${formatMinutes(sleep14)} last week.`
          : "Sleep data missing; adjust expectations.",
      tone: sleep7 != null && sleep14 != null && sleep7 < sleep14 ? "warn" : "neutral",
      link: "/trends"
    }
  ];

  const leverCards = levers.slice(0, 3).map((lever) => ({
    text: lever,
    why: "Highest impact lever identified from the latest run.",
    confidence: "Confidence: medium"
  }));

  const synthesizedStatus = goalProjection
    ? goalProjection.trend === "at-goal"
      ? `Goal met at ${goalProjection.targetWeightKg} kg. Hold steady to maintain.`
      : projectionReachable
        ? `On current 14d pace (${formatNumber(goalProjection.observedSlopeKgPerDay14, 3)} kg/day), projected to hit ${goalProjection.targetWeightKg} kg around ${projectedDateLabel}.`
        : `Current trend (${formatNumber(goalProjection.observedSlopeKgPerDay14, 3)} kg/day) is ${
            goalProjection.trend === "away" ? "moving away from" : "flat toward"
          } the ${goalProjection.targetWeightKg} kg goal.`
    : "Set a target weight to get a projected arrival date.";

  const goalBadge = goalProjection
    ? goalProjection.trend === "at-goal"
      ? { label: "Goal met", tone: "positive" as const }
      : projectionReachable
        ? { label: "On pace", tone: "positive" as const }
        : { label: goalProjection.trend === "away" ? "Off pace" : "No momentum", tone: "negative" as const }
    : { label: "No goal set", tone: "neutral" as const };

  return (
    <div className="section">
      <PageHeader
        title="Status"
        description={
          isDemo
            ? "Demo view: quick read on direction, key levers, and where to focus this week."
            : "Quick synthesis of whether the plan is working, what shifted, and the one or two levers to pull next."
        }
        meta={
          data.latestRun
            ? [{ label: "Last run", value: formatDateTime(data.latestRun.createdAt) }]
            : [{ label: "Pipeline", value: "Not run yet" }]
        }
      />

      {!data.latestRun ? (
        <Card title="No pipeline runs yet" subtitle="We need a run to generate signals.">
          <div className="stack">
            <p className="muted">Ingest data and trigger a pipeline run to start seeing health signals.</p>
            <div className="list-inline">
              <Link className="button" href="/data-quality">
                Check data flow
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {confidenceNotes.length ? (
            <Card title="Confidence" subtitle="Where signals may be soft.">
              <div className="stack">
                {confidenceNotes.map((note) => (
                  <div key={note} className="callout warn">
                    {note}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Grid columns={2}>
            <Card
              title="Status"
              subtitle="Goal progress and the projected timeline."
              action={<Badge tone={goalBadge.tone}>{goalBadge.label}</Badge>}
            >
              <div className="stack">
                <div className="stat-value">{synthesizedStatus}</div>
                {goalProjection ? (
                  <div className="summary-strip">
                    <span className="chip">Pace (14d): {formatNumber(goalProjection.observedSlopeKgPerDay14, 3)} kg/day</span>
                    <span className="chip">
                      Projection: {projectionReachable ? `${projectedDateLabel} (${goalProjection.projectedDaysToGoal ?? "—"}d)` : "Not at this pace"}
                    </span>
                    <span className="chip">Delta: {formatNumber(goalProjection.deltaToGoalKg, 2)} kg to {goalProjection.targetWeightKg} kg</span>
                  </div>
                ) : (
                  <p className="muted">
                    Add <code>GOAL_TARGET_WEIGHT_KG</code> to the API environment to enable projected timelines.
                  </p>
                )}
              </div>
            </Card>

            <Card
              title="System health"
              subtitle="Quick check that ingestion and processing are flowing."
              action={<Badge tone="neutral">Run {data.latestRun.id}</Badge>}
            >
              <div className="stack">
                <Stat label="Created" value={formatDateTime(data.latestRun.createdAt)} />
                <Stat label="Processed ingest files" value={data.latestRun.processedIngestCount ?? "—"} />
                <details className="raw-toggle">
                  <summary>Raw meta</summary>
                  <p className="muted">Generated at: {formatDateTime(pack?.generatedAt ?? null)}</p>
                  <p className="muted">Pipeline id: {data.latestRun.id}</p>
                </details>
              </div>
            </Card>
          </Grid>

          <Card title="Headline signals" subtitle="Glanceable read on trend and goal projection; details live in Trends.">
            <div className="glance-grid">
              {headlineSignals.map((signal) => (
                <GlanceSignal key={signal.title} title={signal.title} value={signal.value} hint={signal.hint} delta={signal.delta} link={signal.link} />
              ))}
            </div>
          </Card>

          <Card title="What changed since last week" subtitle="Changes from last week with links to evidence.">
            <ul className="change-list">
              {changeSummary.map((item) => (
                <ChangeItem key={item.title} title={item.title} detail={item.detail} tone={item.tone} link={item.link} />
              ))}
            </ul>
          </Card>

          <Card title="Key levers" subtitle="Actions that matter most right now.">
            {leverCards.length ? (
              <div className="lever-grid">
                {leverCards.map((lever) => (
                  <LeverCard key={lever.text} text={lever.text} why={lever.why} confidence={lever.confidence} />
                ))}
              </div>
            ) : (
              <p className="muted">No levers were identified for this run.</p>
            )}
          </Card>

          <Card title="Diagnostics" subtitle="Evidence and debugging paths.">
            <div className="list-inline">
              <Link className="button" href="/trends">
                Trends
              </Link>
              <Link className="button" href="/data-quality">
                Data quality
              </Link>
              <Link className="button" href="/metrics">
                Raw metrics
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
