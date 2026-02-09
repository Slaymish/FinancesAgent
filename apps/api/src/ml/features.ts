/**
 * Feature extraction for transaction categorization.
 */

export type TransactionFeatures = {
  merchantNormalised: string;
  descriptionRaw: string;
  amount: number;
  accountId: string;
  date: Date;
};

export type FeatureVector = {
  indices: number[];
  values: number[];
};

export type PredictionSignals = {
  merchantKey: string;
  merchantTokens: string[];
  descriptionTokens: string[];
  accountKey: string;
  amountBucket: string;
  amountSignBucket: string;
  weekday: string;
  month: string;
  textSignature: string;
  referenceTokens: string[];
  direction: "in" | "out";
};

const FEATURE_DIM = 8192;
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "to",
  "of",
  "at",
  "on",
  "in",
  "by",
  "payment",
  "card",
  "eftpos",
  "pos",
  "online",
  "purchase",
  "transaction",
  "debit",
  "credit",
  "nz"
]);

/**
 * Simple string hashing function (MurmurHash3-inspired)
 */
function hashString(str: string, seed = 0): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
  }
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/**
 * Hash feature string to index in [0, FEATURE_DIM)
 */
function hashFeature(feature: string): number {
  return hashString(feature) % FEATURE_DIM;
}

/**
 * Tokenize text into lowercased words
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && token.length <= 24)
    .filter((token) => !STOP_WORDS.has(token));
}

function canonicalMerchant(text: string): string {
  return normalizeText(text)
    .replace(/\d+/g, "0")
    .replace(/\b(ltd|limited|co|company|inc|pty)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get amount bucket for transaction
 */
function getAmountBucket(amount: number): string {
  const abs = Math.abs(amount);
  if (abs < 5) return "micro";
  if (abs < 20) return "tiny";
  if (abs < 60) return "small";
  if (abs < 150) return "medium";
  if (abs < 400) return "large";
  if (abs < 1000) return "xlarge";
  return "huge";
}

/**
 * Get direction (in/out) for transaction
 */
function getDirection(amount: number): "in" | "out" {
  return amount < 0 ? "out" : "in";
}

function getRoundedAmountBucket(amount: number): string {
  const abs = Math.abs(amount);
  if (abs < 1) return "sub1";

  const step = abs < 20 ? 1 : abs < 100 ? 5 : abs < 500 ? 10 : 50;
  const rounded = Math.round(abs / step) * step;
  return `${step}:${rounded}`;
}

function getReferenceTokens(text: string): string[] {
  const matches = normalizeText(text).match(/[a-z0-9]{4,}/g) ?? [];
  const unique: string[] = [];
  for (const token of matches) {
    if (!/\d/.test(token)) continue;
    if (!unique.includes(token)) unique.push(token);
    if (unique.length >= 4) break;
  }
  return unique;
}

function getTextSignature(tokens: string[]): string {
  if (tokens.length === 0) return "unknown";
  return [...new Set(tokens)]
    .slice(0, 4)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

function getCharacterNgrams(text: string, minSize: number, maxSize: number, limit: number): string[] {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return [];

  const grams: string[] = [];
  for (let size = minSize; size <= maxSize; size++) {
    for (let i = 0; i + size <= compact.length; i++) {
      grams.push(compact.slice(i, i + size));
      if (grams.length >= limit) return grams;
    }
  }
  return grams;
}

export function extractPredictionSignals(tx: TransactionFeatures): PredictionSignals {
  const merchantKey = canonicalMerchant(tx.merchantNormalised || tx.descriptionRaw || "");
  const merchantTokens = tokenize(tx.merchantNormalised).slice(0, 8);
  const descriptionTokens = tokenize(tx.descriptionRaw).slice(0, 16);
  const accountKey = normalizeText(tx.accountId) || "unknown";
  const direction = getDirection(tx.amount);
  const amountBucket = getAmountBucket(tx.amount);

  const mergedTokens = [...merchantTokens, ...descriptionTokens];

  return {
    merchantKey: merchantKey || "unknown",
    merchantTokens,
    descriptionTokens,
    accountKey,
    amountBucket,
    amountSignBucket: `${direction}:${amountBucket}`,
    weekday: `dow:${tx.date.getUTCDay()}`,
    month: `month:${tx.date.getUTCMonth() + 1}`,
    textSignature: getTextSignature(mergedTokens),
    referenceTokens: getReferenceTokens(`${tx.descriptionRaw} ${tx.merchantNormalised}`),
    direction
  };
}

/**
 * Extract features from a transaction and return a sparse feature vector.
 * Uses feature hashing to map to fixed dimension.
 */
export function extractFeatures(tx: TransactionFeatures): FeatureVector {
  const featureMap = new Map<number, number>();
  const signals = extractPredictionSignals(tx);

  // Helper to add feature
  const addFeature = (name: string, value = 1) => {
    const idx = hashFeature(name);
    featureMap.set(idx, (featureMap.get(idx) || 0) + value);
  };

  // Merchant and account features get stronger weights.
  addFeature(`merchant:${signals.merchantKey}`, 2.2);
  addFeature(`account:${signals.accountKey}`, 1.1);

  for (const token of signals.merchantTokens) {
    addFeature(`merchant_token:${token}`, 1.3);
  }

  for (const token of signals.descriptionTokens) {
    addFeature(`token:${token}`, 0.8);
  }

  // Description bigrams improve recurring merchant/context matching.
  for (let i = 0; i + 1 < signals.descriptionTokens.length && i < 10; i++) {
    const first = signals.descriptionTokens[i];
    const second = signals.descriptionTokens[i + 1];
    if (first && second) {
      addFeature(`bigram:${first}_${second}`, 0.55);
    }
  }

  for (const refToken of signals.referenceTokens) {
    addFeature(`reference:${refToken}`, 0.9);
  }

  for (const gram of getCharacterNgrams(signals.merchantKey, 3, 5, 28)) {
    addFeature(`merchant_ngram:${gram}`, 0.35);
  }

  // Amount and temporal features.
  addFeature(`amount:${signals.amountBucket}`, 0.9);
  addFeature(`amount_sign_bucket:${signals.amountSignBucket}`, 1.1);
  addFeature(`amount_rounded:${getRoundedAmountBucket(tx.amount)}`, 0.75);
  addFeature(`direction:${signals.direction}`, 0.6);
  addFeature(signals.weekday, 0.35);
  addFeature(signals.month, 0.2);
  addFeature(`signature:${signals.textSignature}`, 0.5);
  addFeature(
    `dom_band:${
      tx.date.getUTCDate() <= 5 ? "start" : tx.date.getUTCDate() <= 20 ? "mid" : "end"
    }`,
    0.2
  );

  const amountAbs = Math.abs(tx.amount);
  const amountLogBucket = Number(Math.floor(Math.log10(amountAbs + 1) * 2) / 2).toFixed(1);
  addFeature(`amount_log:${amountLogBucket}`, 0.45);
  addFeature(`cents:${(Math.round(amountAbs * 100) % 100).toString().padStart(2, "0")}`, 0.15);

  // Convert to sorted arrays
  const entries = Array.from(featureMap.entries()).sort((a, b) => a[0] - b[0]);
  return {
    indices: entries.map((e) => e[0]),
    values: entries.map((e) => e[1])
  };
}

/**
 * Get feature dimension size
 */
export function getFeatureDim(): number {
  return FEATURE_DIM;
}
