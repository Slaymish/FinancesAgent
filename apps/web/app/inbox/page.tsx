import { Card, PageHeader } from "../components/ui";
import { InboxList } from "./inbox-list";
import { InboxStats } from "./inbox-stats";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth";

export const dynamic = "force-dynamic";

async function getInboxData(userId: string) {
  try {
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3001";
    const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";

    const [transactionsRes, statsRes] = await Promise.all([
      fetch(`${apiBaseUrl}/api/inbox`, {
        headers: {
          "X-INTERNAL-API-KEY": internalApiKey,
          "X-USER-ID": userId
        },
        cache: "no-store"
      }),
      fetch(`${apiBaseUrl}/api/inbox/stats`, {
        headers: {
          "X-INTERNAL-API-KEY": internalApiKey,
          "X-USER-ID": userId
        },
        cache: "no-store"
      })
    ]);

    if (!transactionsRes.ok || !statsRes.ok) {
      return null;
    }

    const transactions = await transactionsRes.json();
    const stats = await statsRes.json();

    return { transactions, stats };
  } catch (error) {
    console.error("Failed to fetch inbox data:", error);
    return null;
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

  const data = await getInboxData(session.user.id);

  if (!data) {
    return (
      <div className="section">
        <PageHeader title="Inbox" description="Review and confirm transaction categories." />
        <Card title="API unavailable">
          <p className="muted">Failed to load inbox data from API.</p>
        </Card>
      </div>
    );
  }

  const { transactions, stats } = data;

  return (
    <div className="section">
      <PageHeader
        title="Inbox"
        description="Review and confirm transaction categories."
        meta={[{ label: "To clear", value: stats.toClearCount.toString() }]}
      />

      <InboxStats stats={stats.ok ? stats : null} />

      <Card title="Transactions to Review">
        {transactions.ok && transactions.transactions.length > 0 ? (
          <InboxList transactions={transactions.transactions} userId={session.user.id} />
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
