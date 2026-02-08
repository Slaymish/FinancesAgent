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

const FEATURE_DIM = 4096;

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
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Get amount bucket for transaction
 */
function getAmountBucket(amount: number): string {
  const abs = Math.abs(amount);
  if (abs < 10) return "tiny";
  if (abs < 50) return "small";
  if (abs < 100) return "medium";
  if (abs < 500) return "large";
  return "huge";
}

/**
 * Get direction (in/out) for transaction
 */
function getDirection(amount: number): string {
  return amount < 0 ? "out" : "in";
}

/**
 * Extract features from a transaction and return a sparse feature vector.
 * Uses feature hashing to map to fixed dimension.
 */
export function extractFeatures(tx: TransactionFeatures): FeatureVector {
  const featureMap = new Map<number, number>();

  // Helper to add feature
  const addFeature = (name: string, value = 1) => {
    const idx = hashFeature(name);
    featureMap.set(idx, (featureMap.get(idx) || 0) + value);
  };

  // Merchant name
  if (tx.merchantNormalised) {
    addFeature(`merchant:${tx.merchantNormalised.toLowerCase()}`);
  }

  // Description tokens
  const tokens = tokenize(tx.descriptionRaw);
  for (const token of tokens) {
    addFeature(`token:${token}`);
  }

  // Amount bucket
  addFeature(`amount:${getAmountBucket(tx.amount)}`);

  // Direction
  addFeature(`direction:${getDirection(tx.amount)}`);

  // Account ID
  if (tx.accountId) {
    addFeature(`account:${tx.accountId}`);
  }

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
