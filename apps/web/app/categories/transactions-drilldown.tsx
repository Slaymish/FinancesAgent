"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui";
import { formatCurrency, formatDateTime } from "../lib/format";

type CategorySummary = {
  category: string;
  count: number;
  expenseTotal: number;
  incomeTotal: number;
  lastDate: string | null;
};

type CategoryTransaction = {
  id: string;
  date: string;
  merchantName: string;
  descriptionRaw: string;
  amount: number;
  accountName: string;
  category: string;
};

export function CategoriesDrilldown({
  categories,
  selectedCategory,
  transactions
}: {
  categories: CategorySummary[];
  selectedCategory: string | null;
  transactions: CategoryTransaction[];
}) {
  const [items, setItems] = useState(transactions);
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [knownCategories, setKnownCategories] = useState<string[]>(
    Array.from(new Set(categories.map((row) => row.category))).sort((a, b) => a.localeCompare(b))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(transactions);
    setDraftById({});
    setKnownCategories(Array.from(new Set(categories.map((row) => row.category))).sort((a, b) => a.localeCompare(b)));
  }, [categories, transactions]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>([...knownCategories, "Uncategorised"]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [knownCategories]);

  async function saveCategory(tx: CategoryTransaction) {
    const draft = draftById[tx.id];
    const nextCategory = (draft ?? tx.category).trim() || "Uncategorised";
    setSavingId(tx.id);

    try {
      const res = await fetch(`/api/transactions/${tx.id}/category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: nextCategory })
      });

      if (!res.ok) {
        const message = await res
          .json()
          .then((body) => body?.error as string | undefined)
          .catch(() => undefined);
        alert(`Failed to update category (${res.status}${message ? `: ${message}` : ""})`);
        return;
      }

      if (!knownCategories.includes(nextCategory)) {
        setKnownCategories((prev) => [...prev, nextCategory].sort((a, b) => a.localeCompare(b)));
      }

      setItems((prev) =>
        prev.flatMap((row) => {
          if (row.id !== tx.id) return [row];
          if (selectedCategory && selectedCategory !== nextCategory) return [];
          return [{ ...row, category: nextCategory }];
        })
      );
      setDraftById((prev) => {
        const next = { ...prev };
        delete next[tx.id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  }

  if (categories.length === 0) {
    return (
      <Card title="No categories yet">
        <p className="muted">Classify a few inbox transactions and categories will appear here.</p>
      </Card>
    );
  }

  return (
    <div className="category-layout">
      <Card title="Your categories">
        <div className="category-list">
          {categories.map((row) => {
            const isActive = row.category === selectedCategory;
            return (
              <Link
                key={row.category}
                href={`/categories?category=${encodeURIComponent(row.category)}`}
                className={`category-chip${isActive ? " is-active" : ""}`}
              >
                <div className="category-chip__title">{row.category}</div>
                <div className="category-chip__meta">
                  <span>{row.count} tx</span>
                  <span>{formatCurrency(row.expenseTotal)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card title={selectedCategory ? `Transactions: ${selectedCategory}` : "Transactions"}>
        {items.length === 0 ? (
          <p className="muted">No transactions in this category.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => {
                  const selectedValue = draftById[tx.id] ?? tx.category;
                  const isChanged = selectedValue.trim() !== tx.category;
                  const isSaving = savingId === tx.id;
                  return (
                    <tr key={tx.id}>
                      <td>{formatDateTime(tx.date)}</td>
                      <td>
                        <div className="table-strong">{tx.merchantName}</div>
                        <div className="muted small">{tx.descriptionRaw}</div>
                      </td>
                      <td>{formatCurrency(tx.amount, { sign: true })}</td>
                      <td>
                        <input
                          className="input"
                          value={selectedValue}
                          list={`category-options-${tx.id}`}
                          onChange={(event) =>
                            setDraftById((prev) => ({
                              ...prev,
                              [tx.id]: event.target.value
                            }))
                          }
                        />
                        <datalist id={`category-options-${tx.id}`}>
                          {categoryOptions.map((category) => (
                            <option key={category} value={category} />
                          ))}
                        </datalist>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!isChanged || isSaving}
                          onClick={() => saveCategory(tx)}
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
