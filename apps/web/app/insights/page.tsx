import { Badge, Card, PageHeader } from "../components/ui";
import { auth } from "../auth";
import { demoInsightsHistory, demoInsightsLatest } from "../demo-data";

type InsightsLatestResponse = {
  latest:
    | {
        id: string;
        createdAt: string;
        markdown: string;
        diffFromPrev: string | null;
        pipelineRunId: string | null;
      }
    | null;
};

type InsightsHistoryResponse = {
  docs: Array<{
    id: string;
    createdAt: string;
    diffFromPrev: string | null;
    pipelineRunId: string | null;
  }>;
};

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function InsightsPage() {
  const session = await auth();
  const isDemo = !session;

  let latest: InsightsLatestResponse;
  let history: InsightsHistoryResponse;

  if (isDemo) {
    latest = demoInsightsLatest as InsightsLatestResponse;
    history = demoInsightsHistory as InsightsHistoryResponse;
  } else {
    const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";

    const [latestRes, historyRes] = await Promise.all([
      fetch(`${apiBaseUrl}/api/insights/latest`, { cache: "no-store" }),
      fetch(`${apiBaseUrl}/api/insights/history`, { cache: "no-store" })
    ]);

    if (!latestRes.ok || !historyRes.ok) {
      return (
        <div className="section">
          <PageHeader title="Insights" description="Weekly synthesis of what changed, why, and what to do next." />
          <Card title="API unavailable">
            <p className="muted">Failed to load insights from API.</p>
          </Card>
        </div>
      );
    }

    latest = (await latestRes.json()) as InsightsLatestResponse;
    history = (await historyRes.json()) as InsightsHistoryResponse;
  }

  return (
    <div className="section">
      <PageHeader
        title="Insights"
        description={isDemo ? "Demo view: sign in to see your own weekly synthesis." : "Context-rich notes generated from the latest pipeline run."}
        meta={
          latest.latest
            ? [{ label: "Last updated", value: formatDate(latest.latest.createdAt) }]
            : [{ label: "Status", value: "No documents yet" }]
        }
      />

      {!latest.latest ? (
        <Card title="No insights yet">
          <p className="muted">Once the pipeline runs, you will see synthesized notes and comparisons here.</p>
        </Card>
      ) : (
        <>
          <Card
            title="Latest insight"
            subtitle="The newest synthesis with links back to the pipeline."
            action={<Badge tone="neutral">Doc {latest.latest.id}</Badge>}
          >
            <div className="stack">
              <div className="pill muted">
                <span className="section-title">Pipeline run</span>
                <span>{latest.latest.pipelineRunId ?? "n/a"}</span>
              </div>
              <div className="code-block">{latest.latest.markdown}</div>
            </div>
          </Card>

          <Card title="Diff from previous" subtitle="What changed since the last document.">
            <div className="code-block">{latest.latest.diffFromPrev ?? "(no diff provided)"}</div>
          </Card>
        </>
      )}

      <Card title="History" subtitle="Chronological list of documents and their sources.">
        {history.docs.length === 0 ? (
          <p className="muted">No history to show yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Document</th>
                <th>Pipeline run</th>
              </tr>
            </thead>
            <tbody>
              {history.docs.map((doc) => (
                <tr key={doc.id}>
                  <td>{formatDate(doc.createdAt)}</td>
                  <td>{doc.id}</td>
                  <td>{doc.pipelineRunId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
