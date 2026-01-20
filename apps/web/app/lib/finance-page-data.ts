import { demoSummary } from "../demo-data";
import { getSessionOrNull } from "./session";
import { fetchUserApi } from "./api-client";
import type { ManualData } from "../components/dashboard-tabs";

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

export type FinancePageData = {
  data?: SummaryResponse;
  manualData: ManualData | null;
  isDemo: boolean;
  errorStatus?: number;
};

export async function getFinancePageData(): Promise<FinancePageData> {
  const session = await getSessionOrNull();
  const isDemo = !session;

  if (isDemo) {
    return {
      data: demoSummary as SummaryResponse,
      manualData: null,
      isDemo
    };
  }

  const res = await fetchUserApi<SummaryResponse>(session, "/api/transactions/summary");
  if (!res.ok || !res.data) {
    return { data: undefined, manualData: null, isDemo, errorStatus: res.status };
  }

  const manualRes = await fetchUserApi<ManualDataResponse>(session, "/api/manual-data");
  const manualData = manualRes.ok && manualRes.data ? manualRes.data.data ?? null : null;

  return { data: res.data, manualData, isDemo };
}
