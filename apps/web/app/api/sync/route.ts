export const dynamic = "force-dynamic";

export async function POST() {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const pipelineToken = process.env.PIPELINE_TOKEN;

  try {
    const res = await fetch(`${apiBaseUrl}/api/pipeline/run`, {
      method: "POST",
      headers: pipelineToken ? { "x-pipeline-token": pipelineToken } : undefined
    });

    const body = await res.json().catch(() => ({}));
    return new Response(JSON.stringify(body), { status: res.status, headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "failed to run sync" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
