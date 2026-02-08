import Link from "next/link";
import { Card, PageHeader } from "../components/ui";

export default function InsightsPage() {
  return (
    <div className="section">
      <PageHeader title="Insights" description="Simplified mode is active." />
      <Card title="Inbox-first workflow">
        <p className="muted">Insights views have been minimized. Classify transactions from the Inbox.</p>
        <p>
          <Link className="button" href="/inbox">
            Open Inbox
          </Link>
        </p>
      </Card>
    </div>
  );
}
