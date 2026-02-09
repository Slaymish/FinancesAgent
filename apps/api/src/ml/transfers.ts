/**
 * Transfer detection based on transaction text hints and opposite-side pairing.
 */

export type TransferDetectionTransaction = {
  id: string;
  amount: number;
  date: Date;
  accountName: string;
  descriptionRaw: string;
  merchantName: string;
};

const TRANSFER_HINTS = [
  "transfer",
  "xfr",
  "trf",
  "internet banking",
  "between accounts",
  "own account",
  "payment to self",
  "internal",
  "sweep"
];

const NON_TRANSFER_HINTS = ["eftpos", "card", "visa", "mastercard", "apple", "google pay", "atm fee"];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTransferHint(text: string): boolean {
  return TRANSFER_HINTS.some((hint) => text.includes(hint));
}

function hasNonTransferHint(text: string): boolean {
  return NON_TRANSFER_HINTS.some((hint) => text.includes(hint));
}

function accountKey(value: string): string {
  return normalizeText(value).replace(/\d+/g, "0");
}

function dayDistance(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

function getReferenceTokens(text: string): string[] {
  const tokens = normalizeText(text).match(/[a-z0-9]{4,}/g) ?? [];
  const refs: string[] = [];
  for (const token of tokens) {
    if (!/\d/.test(token)) continue;
    if (!refs.includes(token)) refs.push(token);
    if (refs.length >= 4) break;
  }
  return refs;
}

function hasSharedReference(a: string[], b: string[]): boolean {
  for (const token of a) {
    if (b.includes(token)) return true;
  }
  return false;
}

type NormalizedTransaction = TransferDetectionTransaction & {
  amountCents: number;
  text: string;
  account: string;
  transferHint: boolean;
  nonTransferHint: boolean;
  refs: string[];
};

function toNormalized(tx: TransferDetectionTransaction): NormalizedTransaction {
  const text = normalizeText(`${tx.descriptionRaw} ${tx.merchantName}`);
  return {
    ...tx,
    amountCents: Math.round(Math.abs(tx.amount) * 100),
    text,
    account: accountKey(tx.accountName),
    transferHint: hasTransferHint(text),
    nonTransferHint: hasNonTransferHint(text),
    refs: getReferenceTokens(text)
  };
}

function scorePair(a: NormalizedTransaction, b: NormalizedTransaction): number {
  const days = dayDistance(a.date, b.date);
  if (days > 2.2) return -Infinity;
  if (a.account === b.account) return -Infinity;
  if (a.amountCents !== b.amountCents) return -Infinity;
  if (Math.sign(a.amount) === Math.sign(b.amount)) return -Infinity;

  let score = 0;

  if (days <= 0.4) score += 1.1;
  else if (days <= 1.1) score += 0.75;
  else score += 0.4;

  score += 0.9;

  if (a.transferHint || b.transferHint) score += 0.6;
  if (a.transferHint && b.transferHint) score += 0.55;

  if (hasSharedReference(a.refs, b.refs)) score += 0.55;

  if (a.text && b.text && a.text === b.text) score += 0.4;

  if (a.nonTransferHint || b.nonTransferHint) {
    score -= a.transferHint || b.transferHint ? 0.2 : 0.8;
  }

  return score;
}

export function detectTransferTransactionIds(transactions: TransferDetectionTransaction[]): Set<string> {
  const normalized = transactions.map(toNormalized);
  const transferIds = new Set<string>();

  for (const tx of normalized) {
    if (tx.transferHint && !tx.nonTransferHint) {
      transferIds.add(tx.id);
    }
  }

  const byAmount = new Map<number, NormalizedTransaction[]>();
  for (const tx of normalized) {
    if (tx.amountCents <= 0) continue;
    const rows = byAmount.get(tx.amountCents) ?? [];
    rows.push(tx);
    byAmount.set(tx.amountCents, rows);
  }

  for (const rows of byAmount.values()) {
    const incoming = rows.filter((tx) => tx.amount > 0).sort((a, b) => a.date.getTime() - b.date.getTime());
    const outgoing = rows.filter((tx) => tx.amount < 0).sort((a, b) => a.date.getTime() - b.date.getTime());
    const matchedIncoming = new Set<string>();

    for (const source of outgoing) {
      let best: NormalizedTransaction | null = null;
      let bestScore = -Infinity;

      for (const candidate of incoming) {
        if (matchedIncoming.has(candidate.id)) continue;
        const score = scorePair(source, candidate);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      const strongHint =
        source.transferHint ||
        (best?.transferHint ?? false) ||
        (best ? hasSharedReference(source.refs, best.refs) : false);
      const acceptanceThreshold = strongHint ? 1.65 : 2.1;

      if (best && bestScore >= acceptanceThreshold) {
        matchedIncoming.add(best.id);
        transferIds.add(source.id);
        transferIds.add(best.id);
      }
    }
  }

  return transferIds;
}
