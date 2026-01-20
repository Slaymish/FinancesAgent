import { getServerSession } from "next-auth";
import { authOptions } from "../../auth";

export const dynamic = "force-dynamic";

function buildHeaders(userId: string) {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const internalKey = process.env.INTERNAL_API_KEY ?? "dev-internal-key";
  const pipelineToken = process.env.PIPELINE_TOKEN;
  const headers: Record<string, string> = {
    "x-user-id": userId,
    "x-internal-api-key": internalKey
  };
  if (pipelineToken) headers["x-pipeline-token"] = pipelineToken;
  return { apiBaseUrl, headers };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  const { apiBaseUrl, headers } = buildHeaders(session.user.id);
  const res = await fetch(`${apiBaseUrl}/api/manual-data`, { headers });
  const body = await res.json().catch(() => ({}));
  return new Response(JSON.stringify(body), { status: res.status, headers: { "content-type": "application/json" } });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch (err) {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const { apiBaseUrl, headers } = buildHeaders(session.user.id);
  const res = await fetch(`${apiBaseUrl}/api/manual-data`, {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  return new Response(JSON.stringify(body), { status: res.status, headers: { "content-type": "application/json" } });
}
