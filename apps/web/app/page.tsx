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
    balance?: number | null;
    merchantName: string;
    descriptionRaw: string;
    category: string;
    categoryType: string;
  }>;
};

type ManualDataResponse = {
  data: ManualData | null;
};

type ManualAccount = {
  id: string;
  name: string;
  type: string;
  bucket: string;
  balance: number | "";
};

type ManualUpcomingExpense = {
  id: string;
  label: string;
  month: string;
  amount: number | "";
};

type ManualGoals = {
  emergencyTarget: number | "";
  tripTarget: number | "";
};

type ManualData = {
  accounts: ManualAccount[];
  upcomingExpenses: ManualUpcomingExpense[];
  savingsTargetRate: number | "";
  goals: ManualGoals;
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSessionOrNull();
  const isDemo = !session;

  let data: SummaryResponse;
  let manualData: ManualData | null = null;
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

    const manualRes = await fetchUserApi<ManualDataResponse>(session, "/api/manual-data");
    if (manualRes.ok && manualRes.data) {
      manualData = manualRes.data.data ?? null;
    }
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
      <PageHeader
        title="Overview"
        description={isDemo ? "Demo data preview. Sign in to see your real transactions." : "10-second health check with deeper diagnostics when needed."}
        meta={headerMeta}
      />

      <DashboardTabs
        totals={totals}
        byType={byType}
        monthlyNet={monthlyNet}
        topCategories={topCategories}
        latest={latest}
        isDemo={isDemo}
        initialManualData={manualData}
      />
    </div>
  );
}
