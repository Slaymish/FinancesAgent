import { Card, PageHeader } from "../components/ui";
import { formatCurrency, formatDateTime } from "../lib/format";
import { DashboardTabs, type ManualData } from "../components/dashboard-tabs";
import { getFinancePageData } from "../lib/finance-page-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { data, manualData, isDemo, errorStatus } = await getFinancePageData();

  if (!data) {
    return (
      <div className="section">
        <PageHeader title="Dashboard" description="Understand your financial state quickly." />
        <Card title="API unavailable">
          <p className="muted">Failed to load from API: {errorStatus ?? "unknown"}</p>
        </Card>
      </div>
    );
  }

  const pack = data.metricsPack;
  const totals = pack?.totals ?? { income30: 0, expense30: 0, net30: 0 };
  const byType = pack?.byType30 ?? {};
  const monthlyNet = pack?.trends?.monthlyNet12 ?? [];
  const topCategories = pack?.trends?.categorySpend30 ?? [];
  const latest = data.latestTransactions ?? [];

  const headerMeta = [
    { label: "Snapshot", value: formatDateTime(pack?.generatedAt) },
    { label: "Last 30 days", value: formatCurrency(totals.net30, { sign: true }) }
  ];
  if (isDemo) {
    headerMeta.push({ label: "Mode", value: "Demo data" });
  }

  return (
    <div className="section">
      <PageHeader title="Dashboard" description="Understand your financial state quickly." meta={headerMeta} />
      <DashboardTabs
        totals={totals}
        byType={byType}
        monthlyNet={monthlyNet}
        topCategories={topCategories}
        latest={latest}
        isDemo={isDemo}
        initialManualData={manualData as ManualData | null}
        page="dashboard"
      />
    </div>
  );
}
