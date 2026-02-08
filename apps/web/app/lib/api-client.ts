import type { Session } from "next-auth";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
const internalApiKey = process.env.INTERNAL_API_KEY;
const pipelineToken = process.env.PIPELINE_TOKEN;

export async function fetchUserApi<T>(
  session: Session | null,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T }> {
  if (!session?.user?.id) return { ok: false, status: 401 };
  if (!internalApiKey) return { ok: false, status: 500 };

  const headers = new Headers(init?.headers ?? {});
  headers.set("x-user-id", session.user.id);
  headers.set("x-internal-api-key", internalApiKey);
  if (pipelineToken) headers.set("x-pipeline-token", pipelineToken);

  const res = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    ...init,
    headers
  });

  const data = await res
    .json()
    .catch(() => undefined);

  return { ok: res.ok, status: res.status, data: data as T };
}
