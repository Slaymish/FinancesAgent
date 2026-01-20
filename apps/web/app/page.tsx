import { ArrowDownRight, ArrowUpRight, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { Card, Grid, PageHeader, Stat } from "./components/ui";
import { SparkBars, SparkLine } from "./components/charts";
import { demoSummary } from "./demo-data";
import { formatCurrency, formatDateTime } from "./lib/format";
import { getSessionOrNull } from "./lib/session";
import { fetchUserApi } from "./lib/api-client";

type SummaryResponse = {
  metricsPack: {
    generatedAt: string;
    totals: { income30: number; expense30: number; net30: number };
    byType30: Record<string, number>;
    trends: {
      dailySpend30: Array<{ date: string; spend: number }>;
      monthlyNet12: Array<{ month: string; income: number; expense: number; net: number }>;
      categorySpend30: Array<{ category: string; amount: number; categoryType: string }>;
    };
  };
  latestTransactions: Array<{
    id: string;
    date: string;
    accountName: string;
    amount: number;
    merchantName: string;
    descriptionRaw: string;
    category: string;
    categoryType: string;
  }>;
};

export const dynamic = "force-dynamic";

function formatTypeLabel(type: string) {
  if (!type) return "Uncategorised";
  if (type === "essential") return "Essentials";
  if (type === "want") return "Wants";
  if (type === "saving") return "Savings";
  return type.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function HomePage() {
  const session = await getSessionOrNull();
  const isDemo = !session;

  let data: SummaryResponse;
  if (isDemo) {
    data = demoSummary as SummaryResponse;
  } else {
    const res = await fetchUserApi<SummaryResponse>(session, "/api/transactions/summary");
    if (!res.ok || !res.data) {
      return (
        <div className="section">
          <PageHeader title="Dashboard" description="Daily cashflow, category mix, and momentum." />
          <Card title="API unavailable">
            <p className="muted">Failed to load from API: {res.status}</p>
          </Card>
        </div>
      );
    }
    data = res.data;
  }

  const pack = data.metricsPack;
  const totals = pack?.totals ?? { income30: 0, expense30: 0, net30: 0 };
  const byType = pack?.byType30 ?? {};
  const dailySpend = pack?.trends?.dailySpend30 ?? [];
  const monthlyNet = pack?.trends?.monthlyNet12 ?? [];
  const topCategories = pack?.trends?.categorySpend30 ?? [];
  const latest = data.latestTransactions ?? [];

  return (
    <div className="section">
      <PageHeader
        title="Dashboard"
        description="Daily cashflow, category mix, and momentum."
        meta={[
          { label: "Snapshot", value: formatDateTime(pack?.generatedAt) },
          { label: "Last 30 days", value: formatCurrency(totals.net30, { sign: true }) }
        ]}
      />

      <Grid columns={3}>
        <Card title="Income (30d)" icon={<ArrowUpRight />}>
          <Stat label="Total" value={formatCurrency(totals.income30)} hint="Cleared inflows only." />
        </Card>
        <Card title="Spend (30d)" icon={<ArrowDownRight />}>
          <Stat label="Total" value={formatCurrency(-totals.expense30)} hint="Transfers excluded." />
        </Card>
        <Card title="Net (30d)" icon={<TrendingUp />}>
          <Stat label="Net" value={formatCurrency(totals.net30, { sign: true })} hint="Income minus spend." />
        </Card>
      </Grid>

      <Grid columns={2}>
        <Card
          title="Daily Spend"
          subtitle="Last 30 days"
          icon={<Wallet />}
          action={<span className="chip">Trend</span>}
        >
          <SparkBars data={dailySpend.map((d) => ({ value: d.spend, label: d.date }))} />
        </Card>
        <Card
          title="Monthly Net"
          subtitle="Last 12 months"
          icon={<TrendingUp />}
          action={<span className="chip">Momentum</span>}
        >
          <SparkLine data={monthlyNet.map((d) => ({ value: d.net }))} />
          <div className="chart-legend">
            {monthlyNet.slice(-3).map((month) => (
              <div key={month.month} className="pill muted">
                <span className="section-title">{month.month}</span>
                <span>{formatCurrency(month.net, { sign: true })}</span>
              </div>
            ))}
          </div>
        </Card>
      </Grid>

      <Grid columns={2}>
        <Card title="Category mix" subtitle="Last 30 days" icon={<PiggyBank />}>
          <div className="pill-grid">
            {Object.entries(byType).length === 0 ? (
              <p className="muted">No spending data yet.</p>
            ) : (
              Object.entries(byType).map(([type, amount]) => (
                <div key={type} className="pill">
                  <span className="section-title">{formatTypeLabel(type)}</span>
                  <span>{formatCurrency(-amount)}</span>
                </div>
              ))
            )}
          </div>
          <div className="divider" />
          <ol className="category-list">
            {topCategories.map((item) => (
              <li key={item.category} className="category-row">
                <div>
                  <div className="category-name">{item.category}</div>
                  <div className="muted small">{formatTypeLabel(item.categoryType)}</div>
                </div>
                <div className="category-amount">{formatCurrency(-item.amount)}</div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Latest transactions" subtitle="Most recent activity">
          <div className="transactions">
            {latest.length === 0 ? (
              <p className="muted">No transactions yet. Run a sync to get started.</p>
            ) : (
              latest.slice(0, 10).map((tx) => (
                <div key={tx.id} className="transaction-row">
                  <div>
                    <div className="transaction-title">{tx.merchantName || tx.descriptionRaw}</div>
                    <div className="muted small">{tx.category || "Uncategorised"}</div>
                  </div>
                  <div className="transaction-meta">
                    <div className={`amount ${tx.amount < 0 ? "negative" : "positive"}`}>
                      {formatCurrency(tx.amount, { sign: true })}
                    </div>
                    <div className="muted small">{new Date(tx.date).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </Grid>
    </div>
  );
}
