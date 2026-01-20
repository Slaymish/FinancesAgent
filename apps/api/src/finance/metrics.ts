import type { Transaction } from "@prisma/client";

type DateRange = { start: string; end: string };

export type MetricsPack = {
  generatedAt: string;
  ranges: {
    d30: DateRange;
    d90: DateRange;
    y12: DateRange;
  };
  totals: {
    income30: number;
    expense30: number;
    net30: number;
  };
  byType30: Record<string, number>;
  trends: {
    dailySpend30: Array<{ date: string; spend: number }>;
    monthlyNet12: Array<{ month: string; income: number; expense: number; net: number }>;
    categorySpend30: Array<{ category: string; amount: number; categoryType: string }>;
  };
};

export function computeMetricsPack(transactions: Transaction[], now = new Date()): MetricsPack {
  const today = startOfDayUtc(now);
  const start30 = addDaysUtc(today, -29);
  const start90 = addDaysUtc(today, -89);
  const startYear = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));

  const relevant = transactions.filter((tx) => !tx.isTransfer);
  const byDate = new Map<string, number>();
  const byMonth = new Map<string, { income: number; expense: number }>();
  const byType = new Map<string, number>();
  const byCategory = new Map<string, { amount: number; categoryType: string }>();

  let income30 = 0;
  let expense30 = 0;

  for (const tx of relevant) {
    const date = tx.date;
    const dateKey = dateKeyUtc(date);
    const monthKey = monthKeyUtc(date);
    const amount = tx.amount;
    const absAmount = Math.abs(amount);

    if (date >= start30 && date <= addDaysUtc(today, 1)) {
      if (amount >= 0) {
        income30 += amount;
      } else {
        expense30 += absAmount;
        const typeKey = tx.categoryType?.trim() || "Uncategorised";
        byType.set(typeKey, (byType.get(typeKey) ?? 0) + absAmount);
        const categoryKey = tx.category?.trim() || "Uncategorised";
        const existing = byCategory.get(categoryKey);
        if (existing) {
          existing.amount += absAmount;
        } else {
          byCategory.set(categoryKey, { amount: absAmount, categoryType: typeKey });
        }
      }
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + (amount < 0 ? absAmount : 0));
    }

    if (date >= startYear && date <= addDaysUtc(today, 32)) {
      const entry = byMonth.get(monthKey) ?? { income: 0, expense: 0 };
      if (amount >= 0) entry.income += amount;
      if (amount < 0) entry.expense += absAmount;
      byMonth.set(monthKey, entry);
    }
  }

  const dailySpend30 = buildDailySeries(start30, today, (dateKey) => byDate.get(dateKey) ?? 0);
  const monthlyNet12 = buildMonthlySeries(startYear, today, (monthKey) => {
    const entry = byMonth.get(monthKey) ?? { income: 0, expense: 0 };
    return { income: entry.income, expense: entry.expense, net: entry.income - entry.expense };
  });

  const categorySpend30 = Array.from(byCategory.entries())
    .map(([category, data]) => ({ category, amount: data.amount, categoryType: data.categoryType }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12);

  return {
    generatedAt: now.toISOString(),
    ranges: {
      d30: { start: start30.toISOString(), end: today.toISOString() },
      d90: { start: start90.toISOString(), end: today.toISOString() },
      y12: { start: startYear.toISOString(), end: today.toISOString() }
    },
    totals: {
      income30,
      expense30,
      net30: income30 - expense30
    },
    byType30: Object.fromEntries(byType),
    trends: {
      dailySpend30,
      monthlyNet12,
      categorySpend30
    }
  };
}

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function dateKeyUtc(date: Date): string {
  return startOfDayUtc(date).toISOString().slice(0, 10);
}

function monthKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function buildDailySeries(
  start: Date,
  end: Date,
  valueForDate: (dateKey: string) => number
): Array<{ date: string; spend: number }> {
  const series: Array<{ date: string; spend: number }> = [];
  for (let cursor = startOfDayUtc(start); cursor <= end; cursor = addDaysUtc(cursor, 1)) {
    const key = dateKeyUtc(cursor);
    series.push({ date: key, spend: valueForDate(key) });
  }
  return series;
}

function buildMonthlySeries(
  start: Date,
  end: Date,
  valueForMonth: (monthKey: string) => { income: number; expense: number; net: number }
): Array<{ month: string; income: number; expense: number; net: number }> {
  const series: Array<{ month: string; income: number; expense: number; net: number }> = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= endMonth) {
    const key = cursor.toISOString().slice(0, 7);
    series.push({ month: key, ...valueForMonth(key) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return series;
}
