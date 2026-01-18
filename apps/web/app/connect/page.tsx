import Link from "next/link";
import { Card, Grid, PageHeader } from "../components/ui";
import { getSessionOrNull } from "../lib/session";
import { prisma } from "../lib/prisma";
import TokenManager from "./token-manager";

export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  const session = await getSessionOrNull();
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const ingestUrl = `${apiBaseUrl}/api/ingest/apple-health`;

  if (!session?.user?.id) {
    return (
      <div className="section">
        <PageHeader title="Connect Apple Health" description="Sign in to generate a personal ingest token and link your exports." />
        <Card title="Sign in to connect">
          <p className="muted">Create a GitHub session to generate your ingest token and get connection steps.</p>
          <Link className="button" href="/api/auth/signin">
            Sign in with GitHub
          </Link>
        </Card>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ingestTokenPreview: true, email: true, name: true }
  });

  return (
    <div className="section">
      <PageHeader
        title="Connect Apple Health"
        description="Generate your ingest token and point your exporter at the personal endpoint."
        meta={[{ label: "Endpoint", value: ingestUrl }]}
      />

      <Grid columns={2}>
        <Card title="Your ingest token" subtitle="Generate a token to use in your Apple Health export automation.">
          <TokenManager initialPreview={user?.ingestTokenPreview ?? null} ingestUrl={ingestUrl} />
        </Card>

        <Card title="Setup steps" subtitle="Point your exporter at the ingest endpoint with your token.">
          <ol className="list">
            <li>Open your exporter (e.g., Health Auto Export) and add a REST target.</li>
            <li>Set the URL to <code>{ingestUrl}</code>.</li>
            <li>Set header <code>X-INGEST-TOKEN</code> to the token above.</li>
            <li>Send daily exports (JSON) to keep the pipeline fresh.</li>
          </ol>
          <p className="muted">Tip: run a manual export once to confirm you see a recent ingest in the Data view.</p>
        </Card>
      </Grid>
    </div>
  );
}
