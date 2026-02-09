import { Card, PageHeader } from "../components/ui";
import { InboxList } from "./inbox-list";
import { InboxStats } from "./inbox-stats";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import { fetchUserApi } from "../lib/api-client";
import type { Session } from "next-auth";

export const dynamic = "force-dynamic";

type InboxResponse = {
  ok: boolean;
  transactions: Array<{
    id: string;
    date: string;
    merchantName: string;
    descriptionRaw: string;
    amount: number;
    category: string;
    inboxState: string;
    suggestedCategoryId: string | null;
    confidence: number | null;
  }>;
};

type InboxStatsResponse = {
  ok: boolean;
  toClearCount: number;
  streak: number;
  autoClassifiedPercent: number;
};

type CategoriesResponse = {
  ok: boolean;
  categories: Array<{ category: string }>;
};

async function getInboxData(session: Session | null) {
  if (!session?.user?.id) return { data: null, errorStatus: 401 };

  try {
    const [transactionsRes, statsRes, categoriesRes] = await Promise.all([
      fetchUserApi<InboxResponse>(session, "/api/inbox"),
      fetchUserApi<InboxStatsResponse>(session, "/api/inbox/stats"),
      fetchUserApi<CategoriesResponse>(session, "/api/transactions/categories?limit=1")
    ]);

    if (!transactionsRes.ok || !transactionsRes.data) {
      return { data: null, errorStatus: transactionsRes.status };
    }
    if (!statsRes.ok || !statsRes.data) {
      return { data: null, errorStatus: statsRes.status };
    }

    const knownCategories =
      categoriesRes.ok && categoriesRes.data
        ? categoriesRes.data.categories.map((row) => row.category)
        : [];

    return {
      data: { transactions: transactionsRes.data, stats: statsRes.data, knownCategories },
      errorStatus: undefined
    };
  } catch (error) {
    console.error("Failed to fetch inbox data:", error);
    return { data: null, errorStatus: 500 };
  }
}

export default async function InboxPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <div className="section">
        <PageHeader title="Inbox" description="Review and confirm transaction categories." />
        <Card title="Sign in required">
          <p className="muted">Please sign in to view your inbox.</p>
        </Card>
      </div>
    );
  }

  const { data, errorStatus } = await getInboxData(session);

  if (!data) {
    return (
      <div className="section">
        <PageHeader title="Inbox" description="Review and confirm transaction categories." />
        <Card title="API unavailable">
          <p className="muted">Failed to load inbox data from API: {errorStatus ?? "unknown"}</p>
        </Card>
      </div>
    );
  }

  const { transactions, stats, knownCategories } = data;

  return (
    <div className="section">
        <PageHeader
          title="Inbox"
          description="Review and confirm transaction categories."
          meta={[{ label: "To clear", value: stats?.toClearCount?.toString() || "0" }]}
      />

      <InboxStats stats={stats} />

      <Card title="Transactions to Review">
        {transactions.transactions && transactions.transactions.length > 0 ? (
          <InboxList transactions={transactions.transactions} knownCategories={knownCategories} />
        ) : (
          <div className="empty-state">
            <p>🎉 Your inbox is clear!</p>
            <p className="muted">All transactions have been categorized.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
