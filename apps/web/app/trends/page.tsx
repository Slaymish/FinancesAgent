import type { ReactNode } from "react";
import Link from "next/link";
import { Card, PageHeader } from "../components/ui";
import { demoPipelineLatest } from "../demo-data";
import { formatDateTime, formatDelta, formatMinutes, formatNumber } from "../lib/format";
import { getSessionOrNull } from "../lib/session";
import { fetchUserApi } from "../lib/api-client";

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

type SeriesPoint<T> = { date: string } & T;

export const dynamic = "force-dynamic";

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <p className="muted">No data</p>;
  const width = 140;
  const height = 60;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="trend sparkline">
      <polyline points={points} />
    </svg>
  );
}

function TrendCard({
  title,
  subtitle,
  value,
  delta,
  hint,
  children
}: {
  title: string;
  subtitle?: string;
  value: string;
  delta?: { text: string; tone: "positive" | "negative" | "warn" | "neutral" };
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="stack">
        <div className="glance-block">
          <div className="glance-block__header">
            <div className="glance-value">{value}</div>
            {delta ? <span className={`delta ${delta.tone === "neutral" ? "" : delta.tone}`.trim()}>{delta.text}</span> : null}
          </div>
          {hint ? <p className="muted">{hint}</p> : null}
        </div>
        {children}
      </div>
    </Card>
  );
}

function SeriesTable<T>({
  rows,
  columns
}: {
  rows: T[];
  columns: Array<{ label: string; render: (row: T) => ReactNode }>;
}) {
  return rows.length === 0 ? (
    <p className="muted">No data points recorded.</p>
  ) : (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.label}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TrendsPage() {
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
          <PageHeader title="Trends" description="See how core signals are moving so you can respond early." />
          <Card title="API unavailable">
            <p className="muted">Failed to load from API: {res.status}</p>
          </Card>
        </div>
      );
    }

    data = res.data;
  }
  const pack = data.latestRun?.metricsPack;

  const weightSeries = (pack?.trends?.weightSeries ?? []) as Array<SeriesPoint<{ weightKg: number }>>;
  const nutritionSeries = (pack?.trends?.nutritionSeries ?? []) as Array<SeriesPoint<{ calories: number | null; proteinG: number | null }>>;
  const sleepSeries = (pack?.trends?.sleepSeries ?? []) as Array<SeriesPoint<{ minutes: number }>>;
  const trainingSeries = (pack?.trends?.trainingSeries ?? []) as Array<SeriesPoint<{ minutes: number }>>;

  const weightSlope7 = pack?.weight?.slopeKgPerDay7;
  const weightSlope14 = pack?.weight?.slopeKgPerDay14;
  const calories7 = pack?.nutrition?.avgCalories7;
  const calories14 = pack?.nutrition?.avgCalories14;
  const protein7 = pack?.nutrition?.avgProteinG7;
  const sleepAvg7 = pack?.sleep?.avgSleepMin7;
  const sleepAvg14 = pack?.sleep?.avgSleepMin14;
  const trainingSessions7 = pack?.training?.sessions7;
  const trainingSessions14 = pack?.training?.sessions14;

  const summaryChips = [
    {
      label: "Weight momentum",
      value: weightSlope14 != null ? `${formatNumber(weightSlope14, 3)} kg/day (14d)` : "—",
      delta: formatDelta(weightSlope7, weightSlope14, "kg/day", { precision: 3, goodDirection: "down" })
    },
    {
      label: "Calories",
      value: calories7 != null ? `${formatNumber(calories7, 0)} kcal (7d)` : "—",
      delta: formatDelta(calories7, calories14, "kcal", { precision: 0, goodDirection: "down" })
    },
    {
      label: "Protein",
      value: protein7 != null ? `${formatNumber(protein7, 0)} g (7d)` : "—",
      delta: formatDelta(protein7, pack?.nutrition?.avgProteinG14, "g", { precision: 0, goodDirection: "up" })
    },
    {
      label: "Sleep",
      value: sleepAvg7 != null ? `${formatMinutes(sleepAvg7)} (7d)` : "—",
      delta: formatDelta(sleepAvg7, sleepAvg14, "min", { precision: 0, goodDirection: "up" })
    }
  ];

  return (
    <div className="section">
      <PageHeader
        title="Trends"
        description={isDemo ? "Demo view: sign in for your time series." : "Key trends with quick deltas."}
        meta={
          data.latestRun
            ? [{ label: "Last run", value: formatDateTime(data.latestRun.createdAt) }]
            : [{ label: "Pipeline", value: "Not run yet" }]
        }
      />

      {!data.latestRun ? (
        <Card title="No pipeline runs yet">
          <p className="muted">Trigger a run to start populating trend lines.</p>
        </Card>
      ) : (
        <>
          <Card title="Headline momentum" subtitle="Week-over-week deltas.">
            <div className="summary-strip">
              {summaryChips.map((chip) => (
                <span key={chip.label} className="summary-chip">
                  {chip.label}: {chip.value}{" "}
                  <span className="hint">
                    ({chip.delta.text})
                  </span>
                </span>
              ))}
            </div>
          </Card>

          <div className="grid cols-2">
            <TrendCard
              title="Weight"
              subtitle="Trend beats single weigh-ins."
              value={weightSlope14 != null ? `${formatNumber(weightSlope14, 3)} kg/day (14d)` : "No recent readings"}
              delta={formatDelta(weightSlope7, weightSlope14, "kg/day", { precision: 3, goodDirection: "down" })}
              hint="Weekly slope vs last week."
            >
              <Sparkline values={weightSeries.map((point) => point.weightKg).filter((value) => value != null)} />
              <details className="raw-toggle">
                <summary>View raw table</summary>
                <SeriesTable
                  rows={weightSeries}
                  columns={[
                    { label: "Date", render: (row) => new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) },
                    { label: "Weight (kg)", render: (row) => (row.weightKg != null ? row.weightKg.toFixed(2) : "—") }
                  ]}
                />
              </details>
            </TrendCard>

            <TrendCard
              title="Nutrition"
              subtitle="Keep weekly averages steady."
              value={calories7 != null ? `${formatNumber(calories7, 0)} kcal (7d)` : "No recent logs"}
              delta={formatDelta(calories7, calories14, "kcal", { precision: 0, goodDirection: "down" })}
              hint={protein7 != null ? `Protein ${formatNumber(protein7, 0)}g (7d).` : undefined}
            >
              <Sparkline
                values={nutritionSeries
                  .map((point) => point.calories)
                  .filter((value): value is number => value != null)}
              />
              <details className="raw-toggle">
                <summary>View raw table</summary>
                <SeriesTable
                  rows={nutritionSeries}
                  columns={[
                    { label: "Date", render: (row) => new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) },
                    { label: "Calories", render: (row) => (row.calories ?? "—").toString() },
                    { label: "Protein (g)", render: (row) => (row.proteinG ?? "—").toString() }
                  ]}
                />
              </details>
            </TrendCard>

            <TrendCard
              title="Sleep"
              subtitle="Consistency beats peaks."
              value={sleepAvg7 != null ? `${formatMinutes(sleepAvg7)} (7d)` : "No sleep captured"}
              delta={formatDelta(sleepAvg7, sleepAvg14, "min", { precision: 0, goodDirection: "up" })}
              hint="Keep nightly variance tight."
            >
              <Sparkline values={sleepSeries.map((point) => point.minutes).filter((value) => value != null)} />
              <details className="raw-toggle">
                <summary>View raw table</summary>
                <SeriesTable
                  rows={sleepSeries}
                  columns={[
                    { label: "Date", render: (row) => new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) },
                    { label: "Minutes", render: (row) => (row.minutes ?? "—").toString() }
                  ]}
                />
              </details>
            </TrendCard>

            <TrendCard
              title="Training"
              subtitle="Cadence and minutes."
              value={trainingSessions7 != null ? `${formatNumber(trainingSessions7, 0)} sessions (7d)` : "No training logged"}
              delta={formatDelta(trainingSessions7, trainingSessions14, "sessions", { precision: 0, goodDirection: "up" })}
              hint={pack?.training?.minutes7 ? `${formatMinutes(pack.training.minutes7)} total minutes.` : undefined}
            >
              <Sparkline values={trainingSeries.map((point) => point.minutes).filter((value) => value != null)} />
              <details className="raw-toggle">
                <summary>View raw table</summary>
                <SeriesTable
                  rows={trainingSeries}
                  columns={[
                    { label: "Date", render: (row) => new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) },
                    { label: "Minutes", render: (row) => (row.minutes ?? "—").toString() }
                  ]}
                />
              </details>
            </TrendCard>
          </div>

          <Card title="Debug details" subtitle="Raw metrics pack.">
            <details className="raw-toggle">
              <summary>View raw pack</summary>
              <pre className="code-block">{JSON.stringify(pack, null, 2)}</pre>
            </details>
            <Link className="chip" href="/metrics">
              Open Metrics →
            </Link>
          </Card>
        </>
      )}
    </div>
  );
}
