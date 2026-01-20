"use client";

import { useMemo, useState } from "react";
import { Badge } from "../components/ui";

type CategoryRule = {
  id?: string;
  pattern: string;
  field: string;
  category: string;
  categoryType: string;
  priority: number;
  amountCondition?: string | null;
  isDisabled?: boolean;
};

type Status = "idle" | "saving" | "saved" | "error";

export default function CategoriesForm({
  initialRules,
  isDemo
}: {
  initialRules: CategoryRule[];
  isDemo: boolean;
}) {
  const [rules, setRules] = useState<CategoryRule[]>(initialRules);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [reapplyStatus, setReapplyStatus] = useState<Status>("idle");

  const hasChanges = useMemo(() => JSON.stringify(rules) !== JSON.stringify(initialRules), [rules, initialRules]);

  function updateRule<K extends keyof CategoryRule>(index: number, key: K, value: CategoryRule[K]) {
    setRules((prev) => {
      const next = [...prev];
      const existing = next[index];
      if (!existing) {
        return prev;
      }
      next[index] = { ...existing, [key]: value };
      return next;
    });
  }

  function addRule() {
    setRules((prev) => [
      ...prev,
      {
        pattern: "",
        field: "merchant_normalised",
        category: "",
        categoryType: "",
        priority: prev.length + 1,
        amountCondition: "",
        isDisabled: false
      }
    ]);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function saveRules() {
    if (isDemo) return;
    setStatus("saving");
    setMessage(null);
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        throw new Error(body.error ?? "Failed to save rules");
      }
      setStatus("saved");
      setMessage(`Saved ${body.count ?? rules.length} rules`);
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function reapplyRules() {
    if (isDemo) return;
    setReapplyStatus("saving");
    setMessage(null);
    try {
      const res = await fetch("/api/categories/reapply", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        throw new Error(body.error ?? "Failed to reapply rules");
      }
      setReapplyStatus("saved");
      setMessage(`Reapplied to ${body.updated ?? 0} transactions`);
      setTimeout(() => setReapplyStatus("idle"), 2500);
    } catch (err) {
      setReapplyStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to reapply");
    }
  }

  return (
    <div className="section">
      <div className="form-actions">
        <div className="form-status">
          {isDemo ? (
            <Badge tone="negative">Sign in to edit rules</Badge>
          ) : (
            <Badge tone={status === "saved" ? "positive" : status === "error" ? "negative" : "neutral"}>
              {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : status === "error" ? "Error" : "Idle"}
            </Badge>
          )}
          {message ? <span className="muted">{message}</span> : null}
        </div>
        <div className="form-buttons">
          <button className="button ghost" type="button" onClick={addRule} disabled={isDemo}>
            Add rule
          </button>
          <button className="button" type="button" onClick={saveRules} disabled={isDemo || !hasChanges}>
            Save rules
          </button>
          <button className="button outline" type="button" onClick={reapplyRules} disabled={isDemo || reapplyStatus === "saving"}>
            Reapply to history
          </button>
        </div>
      </div>

      <div className="rules-table">
        <div className="rules-row rules-header">
          <span>Priority</span>
          <span>Pattern</span>
          <span>Field</span>
          <span>Category</span>
          <span>Type</span>
          <span>Amount</span>
          <span>Status</span>
          <span />
        </div>
        {rules.map((rule, index) => (
          <div key={`${rule.id ?? "new"}-${index}`} className="rules-row">
            <input
              type="number"
              value={rule.priority}
              onChange={(event) => updateRule(index, "priority", Number(event.target.value))}
              disabled={isDemo}
            />
            <input
              type="text"
              value={rule.pattern}
              placeholder="COUNTDOWN|NEW WORLD"
              onChange={(event) => updateRule(index, "pattern", event.target.value)}
              disabled={isDemo}
            />
            <select
              value={rule.field}
              onChange={(event) => updateRule(index, "field", event.target.value)}
              disabled={isDemo}
            >
              <option value="merchant_normalised">Merchant</option>
              <option value="description_raw">Description</option>
            </select>
            <input
              type="text"
              value={rule.category}
              placeholder="Groceries"
              onChange={(event) => updateRule(index, "category", event.target.value)}
              disabled={isDemo}
            />
            <input
              type="text"
              value={rule.categoryType}
              placeholder="essential"
              onChange={(event) => updateRule(index, "categoryType", event.target.value)}
              disabled={isDemo}
            />
            <input
              type="text"
              value={rule.amountCondition ?? ""}
              placeholder=">=50"
              onChange={(event) => updateRule(index, "amountCondition", event.target.value)}
              disabled={isDemo}
            />
            <button
              type="button"
              className={`toggle ${rule.isDisabled ? "off" : "on"}`}
              onClick={() => updateRule(index, "isDisabled", !rule.isDisabled)}
              disabled={isDemo}
            >
              {rule.isDisabled ? "Off" : "On"}
            </button>
            <button className="icon-button danger" type="button" onClick={() => removeRule(index)} disabled={isDemo}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
