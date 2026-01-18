"use client";

import { useState } from "react";

export default function TokenManager({
  initialPreview,
  ingestUrl
}: {
  initialPreview: string | null;
  ingestUrl: string;
}) {
  const [preview, setPreview] = useState(initialPreview);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setStatus("loading");
    setError(null);
    setToken(null);
    try {
      const res = await fetch("/api/ingest-token", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { token?: string; preview?: string; error?: string };
      if (!res.ok || !body.token) {
        throw new Error(body.error ?? "Failed to generate token");
      }
      setToken(body.token);
      setPreview(body.preview ?? body.token.slice(-6));
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <div className="stack">
      <div className="summary-strip">
        <span className="chip">Current: {preview ? `…${preview}` : "Not set"}</span>
        <button className="button" onClick={generate} disabled={status === "loading"}>
          {status === "loading" ? "Generating…" : "Generate new token"}
        </button>
      </div>
      {token ? (
        <div className="stack">
          <p className="muted">Copy this value into the <code>X-INGEST-TOKEN</code> header in your exporter.</p>
          <pre className="code-block">{token}</pre>
          <div className="muted">
            Example:
            <pre className="code-block">
{`curl -X POST '${ingestUrl}'
  -H 'Content-Type: application/json'
  -H 'X-INGEST-TOKEN: ${token}'
  --data-binary '@health-export.json'`}
            </pre>
          </div>
        </div>
      ) : (
        <p className="muted">Generate a token to connect your exporter. Regenerating will revoke old tokens.</p>
      )}
      {status === "error" && error ? <p className="muted warn">{error}</p> : null}
    </div>
  );
}
