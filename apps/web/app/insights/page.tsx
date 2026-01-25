import Link from "next/link";
import { ClipboardList, FileClock, NotebookText } from "lucide-react";
import { Badge, Card, PageHeader } from "../components/ui";
import { demoInsightsHistory, demoInsightsLatest } from "../demo-data";
import { formatDateTime } from "../lib/format";
import { getSessionOrNull } from "../lib/session";
import { fetchUserApi } from "../lib/api-client";
import RerunInsightsButton from "./rerun-insights-button";

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
                    <PageHeader title="Insights" description="Data-driven synthesis of your financial trends and upcoming commitments." />
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
                title="Insights"
                description={isDemo ? "Demo view: sign in for your personalized financial synthesis." : "Financial patterns and actionable advice."}
                meta={
                    latest.latest
                        ? [{ label: "Last updated", value: formatDateTime(latest.latest.createdAt) }]
                        : [{ label: "Status", value: "No synthesis yet" }]
                }
            />

            {!latest.latest ? (
                <Card title="No insights yet" subtitle="Run the pipeline to generate a synthesis." icon={<ClipboardList aria-hidden="true" />}>
                    <div className="stack">
                        <p className="muted">After a run, you will see your financial summary here.</p>
                        <div className="summary-strip">
                            <RerunInsightsButton />
                            <Link className="button" href="/">
                                Go to Dashboard
                            </Link>
                        </div>
                    </div>
                </Card>
            ) : (
                <>
                    <Card
                        title="Financial synthesis"
                        subtitle="Recent patterns and recommendations."
                        icon={<NotebookText aria-hidden="true" />}
                        action={<Badge tone="neutral">Synthesis {latest.latest.id}</Badge>}
                    >
                        <div className="stack">
                            <div className="summary-strip">
                                <RerunInsightsButton />
                                <span className="chip">Run: {latest.latest.pipelineRunId ?? "n/a"}</span>
                                <span className="chip">Updated: {formatDateTime(latest.latest.createdAt)}</span>
                            </div>
                            <InsightMarkdown markdown={latest.latest.markdown} />
                        </div>
                    </Card>
                </>
            )}

            <Card title="History" subtitle="Recent documents and summaries." icon={<FileClock aria-hidden="true" />}>
                {history.docs.length === 0 ? (
                    <p className="muted">No history to show yet.</p>
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Created</th>
                                    <th>Document</th>
                                    <th>Run</th>
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
