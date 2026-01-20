import { LineChart, TrendingUp } from "lucide-react";
import { Card, PageHeader } from "../components/ui";
import { SparkBars } from "../components/charts";
import { demoSummary } from "../demo-data";
import { formatCurrency } from "../lib/format";
import { getSessionOrNull } from "../lib/session";
import { fetchUserApi } from "../lib/api-client";

type SummaryResponse = {
  metricsPack: {
    trends: {
      dailySpend30: Array<{ date: string; spend: number }>;
      monthlyNet12: Array<{ month: string; income: number; expense: number; net: number }>;
      categorySpend30: Array<{ category: string; amount: number; categoryType: string }>;
    };
  };
};

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
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
          <PageHeader title="Trends" description="Longer-term trends in cashflow and categories." />
          <Card title="API unavailable">
            <p className="muted">Failed to load from API: {res.status}</p>
          </Card>
        </div>
      );
    }
    data = res.data;
  }

  const monthly = data.metricsPack.trends.monthlyNet12 ?? [];
  const categories = data.metricsPack.trends.categorySpend30 ?? [];

  return (
    <div className="section">
      <PageHeader title="Trends" description="Longer-term trends in cashflow and categories." />

      <Card title="Net over 12 months" subtitle="Income minus spend" icon={<LineChart />}>
        <div className="trend-rows">
          {monthly.map((month) => (
            <div key={month.month} className="trend-row">
              <div className="trend-label">{month.month}</div>
              <SparkBars
                data={[
                  { value: month.income, label: `${month.month}-income` },
                  { value: -month.expense, label: `${month.month}-expense` },
                  { value: month.net, label: `${month.month}-net` }
                ]}
                height={80}
                renderLabel={(value) => formatCurrency(value)}
              />
              <div className="trend-net">{formatCurrency(month.net, { sign: true })}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Top categories (30d)" subtitle="Where the money goes" icon={<TrendingUp />}>
        <ol className="category-list">
          {categories.map((item) => (
            <li key={item.category} className="category-row">
              <div>
                <div className="category-name">{item.category}</div>
                <div className="muted small">{item.categoryType}</div>
              </div>
              <div className="category-amount">{formatCurrency(-item.amount)}</div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
