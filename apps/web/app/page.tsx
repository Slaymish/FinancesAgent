import { PageHeader } from "./components/ui";
import { demoSummary } from "./demo-data";
import { formatCurrency, formatDateTime } from "./lib/format";
import { getSessionOrNull } from "./lib/session";
import { fetchUserApi } from "./lib/api-client";
import { DashboardTabs } from "./components/dashboard-tabs";

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
  const monthlyNet = pack?.trends?.monthlyNet12 ?? [];
  const topCategories = pack?.trends?.categorySpend30 ?? [];
  const latest = data.latestTransactions ?? [];

  return (
    <div className="section">
      <PageHeader
        title="Overview"
        description="10-second health check with deeper diagnostics when needed."
        meta={[
          { label: "Snapshot", value: formatDateTime(pack?.generatedAt) },
          { label: "Last 30 days", value: formatCurrency(totals.net30, { sign: true }) }
        ]}
      />

      <DashboardTabs
        totals={totals}
        byType={byType}
        monthlyNet={monthlyNet}
        topCategories={topCategories}
        latest={latest}
      />
    </div>
  );
}
