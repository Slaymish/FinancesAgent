"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDateTime } from "../lib/format";

type Transaction = {
  id: string;
  date: string;
  merchantName: string;
  descriptionRaw: string;
  amount: number;
  category: string;
  inboxState: string;
  suggestedCategoryId: string | null;
  confidence: number | null;
};

type InboxListProps = {
  transactions: Transaction[];
  knownCategories: string[];
};

function preferredCategory(tx: Transaction): string {
  return tx.suggestedCategoryId?.trim() || tx.category?.trim() || "Uncategorised";
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function InboxList({ transactions, knownCategories }: InboxListProps) {
  const [items, setItems] = useState(transactions);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [draftById, setDraftById] = useState<Record<string, string>>(() =>
    Object.fromEntries(transactions.map((tx) => [tx.id, preferredCategory(tx)]))
  );

  useEffect(() => {
    setItems(transactions);
    setDraftById(Object.fromEntries(transactions.map((tx) => [tx.id, preferredCategory(tx)])));
  }, [transactions]);

  const categoryOptions = useMemo(
    () =>
      uniqueSorted([
        "Uncategorised",
        ...knownCategories,
        ...items.map((tx) => tx.category),
        ...items.map((tx) => tx.suggestedCategoryId ?? "")
      ]),
    [items, knownCategories]
  );

  const handleConfirm = async (txId: string) => {
    const categoryId = (draftById[txId] ?? "").trim() || "Uncategorised";
    setConfirming(txId);

    try {
      const res = await fetch(`/api/inbox/${txId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId })
      });

      if (res.ok) {
        // Remove from list
        setItems((prev) => prev.filter((item) => item.id !== txId));
      } else {
        const message = await res
          .json()
          .then((body) => body?.error as string | undefined)
          .catch(() => undefined);
        alert(`Failed to confirm transaction (${res.status}${message ? `: ${message}` : ""})`);
      }
    } catch (error) {
      alert("Failed to confirm transaction");
    } finally {
      setConfirming(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>🎉 Your inbox is clear!</p>
        <p className="muted">All transactions have been categorized.</p>
      </div>
    );
  }

  return (
    <div className="inbox-list">
      {items.map((tx) => {
        const suggestedCategory = tx.suggestedCategoryId ?? "Uncategorised";
        const draft = draftById[tx.id] ?? suggestedCategory;

        return (
          <div key={tx.id} className="inbox-item">
            <div className="inbox-item-info">
              <div className="inbox-item-merchant">{tx.merchantName}</div>
              <div className="inbox-item-description muted">{tx.descriptionRaw}</div>
              <div className="inbox-item-meta muted">
                <span>{formatDateTime(tx.date)}</span>
                <span>{formatCurrency(tx.amount, { sign: true })}</span>
              </div>
            </div>

            <div className="inbox-item-actions">
              <div className="inbox-item-suggestion">
                <div className="muted">Suggested: {suggestedCategory}</div>
                <input
                  className="input"
                  value={draft}
                  list={`inbox-category-options-${tx.id}`}
                  onChange={(event) =>
                    setDraftById((prev) => ({
                      ...prev,
                      [tx.id]: event.target.value
                    }))
                  }
                />
                <datalist id={`inbox-category-options-${tx.id}`}>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
                <div className="button-group">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleConfirm(tx.id)}
                    disabled={confirming === tx.id}
                  >
                    {confirming === tx.id ? "..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
