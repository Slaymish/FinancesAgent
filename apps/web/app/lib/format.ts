export type DeltaTone = "positive" | "negative" | "warn" | "neutral";

export function formatDateTime(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, options ?? { dateStyle: "medium", timeStyle: "short" });
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "—";
  if (Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? value.toString() : value.toFixed(digits);
}

export function formatCurrency(value: number | null | undefined, options?: { currency?: string; sign?: boolean }) {
  if (value === null || value === undefined) return "—";
  if (Number.isNaN(value)) return "—";
  const currency = options?.currency ?? "NZD";
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  });
  const formatted = formatter.format(Math.abs(value));
  if (!options?.sign) return value < 0 ? `-${formatted}` : formatted;
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

export function formatMinutes(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (Number.isNaN(value)) return "—";
  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function deltaTone(diff: number, goodDirection: "up" | "down" | "either" | "none" = "either"): DeltaTone {
  if (diff === 0) return "neutral";
  if (goodDirection === "none") return "neutral";
  if (goodDirection === "either") return diff > 0 ? "positive" : "negative";
  if (goodDirection === "up") return diff > 0 ? "positive" : "negative";
  return diff < 0 ? "positive" : "negative";
}

export function formatDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  unit: string,
  {
    precision = 1,
    goodDirection = "either",
    label = "vs last week"
  }: { precision?: number; goodDirection?: "up" | "down" | "either" | "none"; label?: string }
): { text: string; tone: DeltaTone } {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return { text: "—", tone: "neutral" };
  }
  const diff = current - previous;
  if (diff === 0) return { text: `→ 0 ${unit} ${label}`, tone: "neutral" };
  const symbol = diff > 0 ? "↑" : "↓";
  return {
    text: `${symbol} ${Math.abs(diff).toFixed(precision)} ${unit} ${label}`,
    tone: deltaTone(diff, goodDirection)
  };
}
