"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function SyncButton() {
  const router = useRouter();
  const { data } = useSession();
  const isAuthed = !!data;
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function runSync() {
    setStatus("running");
    setMessage(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; runId?: string; pipelineRunId?: string };
      if (!res.ok || body.error) {
        throw new Error(body.error ?? `Sync failed (${res.status})`);
      }
      setStatus("done");
      setMessage(`Run ${body.pipelineRunId ?? body.runId ?? "completed"}`);
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setTimeout(() => setStatus("idle"), 3500);
    }
  }

  return (
    <div className="sync">
      <button className="button" onClick={runSync} disabled={!isAuthed || status === "running"}>
        {status === "running" ? "Syncing…" : isAuthed ? "Run sync" : "Sign in to sync"}
      </button>
      {message ? <span className={`sync-message ${status}`}>{message}</span> : null}
    </div>
  );
}
