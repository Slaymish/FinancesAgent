"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function RerunInsightsButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleRerun() {
        if (loading) return;
        setLoading(true);

        try {
            const res = await fetch("/api/insights/rerun", { method: "POST" });
            if (res.ok) {
                router.refresh();
            } else {
                const text = await res.text();
                console.error("Rerun failed:", text);
                alert(`Failed to rerun insights: ${text}`);
            }
        } catch (err) {
            console.error("Rerun error:", err);
            alert(`Error rerunning insights: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button className="button" onClick={handleRerun} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} aria-hidden="true" />
            <span>{loading ? "Rerunning..." : "Rerun synthesis"}</span>
        </button>
    );
}
