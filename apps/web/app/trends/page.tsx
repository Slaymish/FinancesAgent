import type { ReactNode } from "react";
import { Card, PageHeader } from "../components/ui";

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

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SeriesTable<T>({
  title,
  subtitle,
  rows,
  columns
}: {
  title: string;
  subtitle?: string;
  rows: T[];
  columns: Array<{ label: string; render: (row: T) => ReactNode }>;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      {rows.length === 0 ? (
        <p className="muted">No data points recorded.</p>
      ) : (
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
      )}
    </Card>
  );
}

export default async function TrendsPage() {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiBaseUrl}/api/pipeline/latest`);

  if (!res.ok) {
    return (
      <div className="section">
        <PageHeader title="Trends" description="See how core signals are moving so you can respond early." />
        <Card title="API unavailable">
          <p className="muted">Failed to load from API: {res.status}</p>
        </Card>
      </div>
    );
  }

  const data = (await res.json()) as PipelineLatestResponse;
  const pack = data.latestRun?.metricsPack;

  const weightSeries = (pack?.trends?.weightSeries ?? []) as Array<{ date: string; weightKg: number }>;
  const nutritionSeries = (pack?.trends?.nutritionSeries ?? []) as Array<{ date: string; calories: number | null; proteinG: number | null }>;
  const sleepSeries = (pack?.trends?.sleepSeries ?? []) as Array<{ date: string; minutes: number }>;
  const trainingSeries = (pack?.trends?.trainingSeries ?? []) as Array<{ date: string; minutes: number }>;

  return (
    <div className="section">
      <PageHeader
        title="Trends"
        description="Progress over time across weight, nutrition, sleep, and training."
        meta={
          data.latestRun
            ? [{ label: "Last run", value: new Date(data.latestRun.createdAt).toLocaleString() }]
            : [{ label: "Pipeline", value: "Not run yet" }]
        }
      />

      {!data.latestRun ? (
        <Card title="No pipeline runs yet">
          <p className="muted">Trigger a run to start populating trend lines.</p>
        </Card>
      ) : (
        <div className="grid cols-2">
          <SeriesTable
            title="Weight"
            subtitle="Daily readings and direction of change."
            rows={weightSeries}
            columns={[
              { label: "Date", render: (row) => formatDate(row.date) },
              { label: "Weight (kg)", render: (row) => row.weightKg?.toFixed(2) ?? "—" }
            ]}
          />

          <SeriesTable
            title="Nutrition"
            subtitle="Calories and protein logged each day."
            rows={nutritionSeries}
            columns={[
              { label: "Date", render: (row) => formatDate(row.date) },
              { label: "Calories", render: (row) => (row.calories ?? "—").toString() },
              { label: "Protein (g)", render: (row) => (row.proteinG ?? "—").toString() }
            ]}
          />

          <SeriesTable
            title="Sleep"
            subtitle="Total minutes in bed."
            rows={sleepSeries}
            columns={[
              { label: "Date", render: (row) => formatDate(row.date) },
              { label: "Minutes", render: (row) => row.minutes?.toString() ?? "—" }
            ]}
          />

          <SeriesTable
            title="Training"
            subtitle="Time spent training each day."
            rows={trainingSeries}
            columns={[
              { label: "Date", render: (row) => formatDate(row.date) },
              { label: "Minutes", render: (row) => row.minutes?.toString() ?? "—" }
            ]}
          />
        </div>
      )}
    </div>
  );
}
