import { Card, PageHeader } from "../components/ui";
import { formatCurrency, formatDateTime } from "../lib/format";
import { getSessionOrNull } from "../lib/session";
import { fetchUserApi } from "../lib/api-client";

type SummaryResponse = {
  metricsPack: {
    generatedAt: string;
    totals: { income30: number; expense30: number; net30: number };
    byType30: Record<string, number>;
    trends: {
      categorySpend30: Array<{ category: string; amount: number; categoryType: string }>;
    };
  };
};

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.round((value / total) * 100));
}

export const dynamic = "force-dynamic";

export default async function MonthPage() {
  const session = await getSessionOrNull();

  if (!session?.user?.id) {
    return (
      <div className="section">
        <PageHeader title="Month" description="How this month is tracking." />
        <Card title="Sign in required">
          <p className="muted">Please sign in to view your monthly distribution.</p>
        </Card>
      </div>
    );
  }

  const res = await fetchUserApi<SummaryResponse>(session, "/api/transactions/summary");
  if (!res.ok || !res.data) {
    return (
      <div className="section">
        <PageHeader title="Month" description="How this month is tracking." />
        <Card title="API unavailable">
          <p className="muted">Failed to load monthly summary: {res.status}</p>
        </Card>
      </div>
    );
  }

  const pack = res.data.metricsPack;
  const totals = pack.totals;
  const categoryRows = [...(pack.trends.categorySpend30 ?? [])].sort((a, b) => b.amount - a.amount);
  const totalCategorySpend = categoryRows.reduce((sum, row) => sum + Math.max(0, row.amount), 0);

  return (
    <div className="section">
      <PageHeader
        title="Month"
        description="Distribution across categories for the last 30 days."
        meta={[{ label: "Updated", value: formatDateTime(pack.generatedAt) }]}
      />

      <Card title="Monthly snapshot">
        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <th>Income</th>
                <td>{formatCurrency(totals.income30)}</td>
              </tr>
              <tr>
                <th>Expenses</th>
                <td>{formatCurrency(totals.expense30)}</td>
              </tr>
              <tr>
                <th>Net</th>
                <td>{formatCurrency(totals.net30, { sign: true })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Category distribution">
        {categoryRows.length === 0 ? (
          <p className="muted">No categorized transactions yet for this period.</p>
        ) : (
          <div className="stack">
            {categoryRows.map((row) => {
              const share = pct(Math.max(0, row.amount), totalCategorySpend);
              return (
                <div key={`${row.category}-${row.categoryType}`}>
                  <div className="inbox-item-meta muted" style={{ justifyContent: "space-between" }}>
                    <span>
                      {row.category}
                      {row.categoryType ? ` (${row.categoryType})` : ""}
                    </span>
                    <span>
                      {formatCurrency(row.amount)} · {share}%
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    style={{
                      height: "8px",
                      width: "100%",
                      borderRadius: "999px",
                      background: "var(--surface-2)",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${share}%`,
                        background: "var(--accent)"
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

