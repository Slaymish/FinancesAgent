import Link from "next/link";
import { Badge, Card, PageHeader } from "../components/ui";
import { demoInsightsHistory, demoInsightsLatest } from "../demo-data";
import { formatDateTime } from "../lib/format";
import { getSessionOrNull } from "../lib/session";
import { fetchUserApi } from "../lib/api-client";

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

function InsightMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n").map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => line.startsWith("#"));
  const bullets = lines.filter((line) => line.startsWith("-"));
  const paragraphs = lines.filter((line) => !line.startsWith("#") && !line.startsWith("-"));

  return (
    <div className="stack">
      {heading ? <div className="stat-value">{heading.replace(/^#+\s*/, "")}</div> : null}
      {paragraphs.length ? (
        paragraphs.map((p, index) => (
          <p key={index} className="muted">
            {p}
          </p>
        ))
      ) : null}
      {bullets.length ? (
        <ul className="list">
          {bullets.map((item) => (
            <li key={item}>{item.replace(/^-+\s*/, "")}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default async function InsightsPage() {
  const session = await getSessionOrNull();
  const isDemo = !session;

  let latest: InsightsLatestResponse;
  let history: InsightsHistoryResponse;

  if (isDemo) {
    latest = demoInsightsLatest as InsightsLatestResponse;
    history = demoInsightsHistory as InsightsHistoryResponse;
  } else {
    const [latestRes, historyRes] = await Promise.all([
      fetchUserApi<InsightsLatestResponse>(session, "/api/insights/latest"),
      fetchUserApi<InsightsHistoryResponse>(session, "/api/insights/history")
    ]);

    if (!latestRes.ok || !latestRes.data || !historyRes.ok || !historyRes.data) {
      return (
        <div className="section">
          <PageHeader title="Review" description="Weekly synthesis of what changed, why, and what to do next." />
          <Card title="API unavailable">
            <p className="muted">Failed to load insights from API.</p>
          </Card>
        </div>
      );
    }

    latest = latestRes.data;
    history = historyRes.data;
  }

  return (
    <div className="section">
      <PageHeader
        title="Review"
        description={isDemo ? "Demo view: sign in to see your own weekly synthesis." : "Weekly summary of what changed and where to adjust."}
        meta={
          latest.latest
            ? [{ label: "Last updated", value: formatDateTime(latest.latest.createdAt) }]
            : [{ label: "Status", value: "No documents yet" }]
        }
      />

      {!latest.latest ? (
        <Card title="No insights yet" subtitle="Run the pipeline to generate a first synthesis.">
          <div className="stack">
            <p className="muted">Once the pipeline runs, you will see synthesized notes and comparisons here.</p>
            <Link className="button" href="/">
              Go to Status
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card
            title="Weekly synthesis"
            subtitle="Overview with the notes and supporting numbers in one place."
            action={<Badge tone="neutral">Doc {latest.latest.id}</Badge>}
          >
            <div className="stack">
              <div className="summary-strip">
                <span className="chip">Pipeline run: {latest.latest.pipelineRunId ?? "n/a"}</span>
                <span className="chip">Updated: {formatDateTime(latest.latest.createdAt)}</span>
              </div>
              <InsightMarkdown markdown={latest.latest.markdown} />
              <Link className="chip" href="/trends">
                See supporting charts →
              </Link>
            </div>
          </Card>
        </>
      )}

      <Card title="History" subtitle="Chronological list of documents and their sources.">
        {history.docs.length === 0 ? (
          <p className="muted">No history to show yet.</p>
        ) : (
          <div className="table-wrap">
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
                    <td>{formatDateTime(doc.createdAt)}</td>
                    <td>{doc.id}</td>
                    <td>{doc.pipelineRunId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
