"use client";

import { useState } from "react";
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
};

export function InboxList({ transactions }: InboxListProps) {
  const [items, setItems] = useState(transactions);
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleConfirm = async (txId: string, categoryId: string) => {
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
                {tx.confidence !== null && (
                  <div className="muted">Confidence: {Math.round(tx.confidence * 100)}%</div>
                )}
                <div className="button-group">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleConfirm(tx.id, suggestedCategory)}
                    disabled={confirming === tx.id}
                  >
                    {confirming === tx.id ? "..." : "✓ Confirm"}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const category = prompt("Enter category:");
                      if (category) handleConfirm(tx.id, category);
                    }}
                    disabled={confirming === tx.id}
                  >
                    Pick Different
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
