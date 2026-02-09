/**
 * Multinomial logistic regression (softmax classifier) for transaction categorization.
 *
 * The model blends:
 * - A sparse linear softmax classifier
 * - Lookup-based evidence from learned transaction signals
 */

import type { FeatureVector, PredictionSignals } from "./features.js";

type SignalLookup = Record<string, number[]>;

type ModelLookups = {
  merchant?: SignalLookup;
  merchantToken?: SignalLookup;
  token?: SignalLookup;
  account?: SignalLookup;
  amountBucket?: SignalLookup;
  amountSignBucket?: SignalLookup;
  weekday?: SignalLookup;
  month?: SignalLookup;
  signature?: SignalLookup;
  reference?: SignalLookup;
};

export type ModelWeights = {
  version?: number;
  featureDim: number;
  categories: string[];
  weights: number[][]; // [numCategories][featureDim]
  biases?: number[];
  priors?: number[];
  lookups?: ModelLookups;
};

export type TrainingExample = {
  features: FeatureVector;
  category: string;
  weight?: number;
  signals?: PredictionSignals;
};

export type Prediction = {
  category: string;
  confidence: number;
  probabilities: Record<string, number>;
};

/**
 * Softmax function
 */
function softmax(logits: number[]): number[] {
  if (logits.length === 0) return [];
  const maxLogit = Math.max(...logits);
  const expLogits = logits.map((x) => Math.exp(x - maxLogit));
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  if (sumExp <= 0) {
    return logits.map(() => 1 / logits.length);
  }
  return expLogits.map((x) => x / sumExp);
}

/**
 * Compute dot product of sparse vector with dense weights
 */
function sparseDot(indices: number[], values: number[], weights: number[]): number {
  let result = 0;
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    if (idx !== undefined && idx < weights.length) {
      const weight = weights[idx];
      const value = values[i];
      if (weight !== undefined && value !== undefined) {
        result += value * weight;
      }
    }
  }
  return result;
}

function blendProbabilities(linear: number[], lookup: number[], lookupWeight: number): number[] {
  const blended: number[] = [];
  let sum = 0;
  for (let i = 0; i < linear.length; i++) {
    const linearProb = linear[i] ?? 0;
    const lookupProb = lookup[i] ?? 0;
    const value = (1 - lookupWeight) * linearProb + lookupWeight * lookupProb;
    blended.push(value);
    sum += value;
  }
  if (sum <= 0) return linear;
  return blended.map((value) => value / sum);
}

function createSignalLookupEntry(size: number): number[] {
  return new Array(size).fill(0);
}

function addLookupCount(map: SignalLookup, key: string, categoryIdx: number, weight: number, categorySize: number) {
  if (!key) return;
  const normalized = key.trim();
  if (!normalized) return;

  const row = map[normalized] ?? createSignalLookupEntry(categorySize);
  row[categoryIdx] = (row[categoryIdx] ?? 0) + weight;
  map[normalized] = row;
}

function sum(values: number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function pruneLookup(map: SignalLookup, options: { maxKeys: number; minSupport: number }): SignalLookup {
  const entries = Object.entries(map)
    .map(([key, counts]) => ({
      key,
      counts,
      support: sum(counts)
    }))
    .filter((entry) => entry.support >= options.minSupport)
    .sort((a, b) => b.support - a.support)
    .slice(0, options.maxKeys);

  return Object.fromEntries(entries.map((entry) => [entry.key, entry.counts]));
}

function buildLookups(examples: TrainingExample[], categories: string[], categoryIndex: Map<string, number>): ModelLookups {
  const merchant: SignalLookup = {};
  const merchantToken: SignalLookup = {};
  const token: SignalLookup = {};
  const account: SignalLookup = {};
  const amountBucket: SignalLookup = {};
  const amountSignBucket: SignalLookup = {};
  const weekday: SignalLookup = {};
  const month: SignalLookup = {};
  const signature: SignalLookup = {};
  const reference: SignalLookup = {};

  for (const example of examples) {
    const signals = example.signals;
    if (!signals) continue;

    const idx = categoryIndex.get(example.category);
    if (idx === undefined) continue;

    const weight = Math.max(0.1, example.weight ?? 1);
    addLookupCount(merchant, signals.merchantKey, idx, weight * 2.2, categories.length);
    addLookupCount(account, signals.accountKey, idx, weight, categories.length);
    addLookupCount(amountBucket, signals.amountBucket, idx, weight * 0.9, categories.length);
    addLookupCount(amountSignBucket, signals.amountSignBucket, idx, weight, categories.length);
    addLookupCount(weekday, signals.weekday, idx, weight * 0.45, categories.length);
    addLookupCount(month, signals.month, idx, weight * 0.35, categories.length);
    addLookupCount(signature, signals.textSignature, idx, weight * 1.2, categories.length);

    for (const value of signals.merchantTokens.slice(0, 8)) {
      addLookupCount(merchantToken, value, idx, weight, categories.length);
    }
    for (const value of signals.descriptionTokens.slice(0, 16)) {
      addLookupCount(token, value, idx, weight * 0.85, categories.length);
    }
    for (const value of signals.referenceTokens.slice(0, 4)) {
      addLookupCount(reference, value, idx, weight * 1.3, categories.length);
    }
  }

  return {
    merchant: pruneLookup(merchant, { maxKeys: 2000, minSupport: 1 }),
    merchantToken: pruneLookup(merchantToken, { maxKeys: 2500, minSupport: 1 }),
    token: pruneLookup(token, { maxKeys: 6000, minSupport: 1.2 }),
    account: pruneLookup(account, { maxKeys: 600, minSupport: 1 }),
    amountBucket: pruneLookup(amountBucket, { maxKeys: 64, minSupport: 1 }),
    amountSignBucket: pruneLookup(amountSignBucket, { maxKeys: 64, minSupport: 1 }),
    weekday: pruneLookup(weekday, { maxKeys: 16, minSupport: 1 }),
    month: pruneLookup(month, { maxKeys: 24, minSupport: 1 }),
    signature: pruneLookup(signature, { maxKeys: 3200, minSupport: 1 }),
    reference: pruneLookup(reference, { maxKeys: 1500, minSupport: 1 })
  };
}

function normalisePriors(priors: number[] | undefined, categoryCount: number): number[] {
  if (!priors || priors.length !== categoryCount) {
    return new Array(categoryCount).fill(1 / Math.max(1, categoryCount));
  }
  const safe = priors.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = safe.reduce((acc, value) => acc + value, 0);
  if (total <= 0) {
    return new Array(categoryCount).fill(1 / Math.max(1, categoryCount));
  }
  return safe.map((value) => value / total);
}

function applyLookupEvidence(params: {
  model: ModelWeights;
  signals: PredictionSignals;
}): { probabilities: number[]; evidenceCount: number } | null {
  const { model, signals } = params;
  const lookups = model.lookups;
  const categoryCount = model.categories.length;
  if (!lookups || categoryCount === 0) return null;

  const priors = normalisePriors(model.priors, categoryCount);
  const logScores = priors.map((prior) => Math.log(prior + 1e-12));
  let evidenceCount = 0;

  const apply = (lookup: SignalLookup | undefined, key: string | undefined, strength: number) => {
    if (!lookup || !key) return;
    const counts = lookup[key];
    if (!counts || counts.length !== categoryCount) return;
    evidenceCount += 1;

    const total = sum(counts) + categoryCount;
    for (let i = 0; i < categoryCount; i++) {
      const count = counts[i] ?? 0;
      const current = logScores[i] ?? 0;
      logScores[i] = current + strength * Math.log((count + 1) / total);
    }
  };

  apply(lookups.merchant, signals.merchantKey, 2.6);
  apply(lookups.account, signals.accountKey, 0.45);
  apply(lookups.amountBucket, signals.amountBucket, 0.35);
  apply(lookups.amountSignBucket, signals.amountSignBucket, 0.55);
  apply(lookups.weekday, signals.weekday, 0.18);
  apply(lookups.month, signals.month, 0.12);
  apply(lookups.signature, signals.textSignature, 0.95);

  for (const token of signals.merchantTokens.slice(0, 8)) {
    apply(lookups.merchantToken, token, 0.42);
  }
  for (const token of signals.descriptionTokens.slice(0, 14)) {
    apply(lookups.token, token, 0.2);
  }
  for (const ref of signals.referenceTokens.slice(0, 4)) {
    apply(lookups.reference, ref, 0.38);
  }

  if (evidenceCount === 0) return null;

  return {
    probabilities: softmax(logScores),
    evidenceCount
  };
}

/**
 * Train a multinomial logistic regression model.
 * Uses simple batch gradient descent with L2 regularization.
 */
export function trainModel(
  examples: TrainingExample[],
  featureDim: number,
  options: {
    learningRate?: number;
    regularization?: number;
    maxIterations?: number;
    convergenceThreshold?: number;
  } = {}
): ModelWeights {
  const {
    learningRate = 0.03,
    regularization = 0.005,
    maxIterations = 180,
    convergenceThreshold = 1e-5
  } = options;

  // Get unique categories
  const categories = Array.from(new Set(examples.map((ex) => ex.category)));
  if (categories.length === 0) {
    throw new Error("No categories in training data");
  }
  if (categories.length === 1) {
    // Single category - return trivial model
    return {
      version: 2,
      featureDim,
      categories,
      weights: [new Array(featureDim).fill(0)],
      biases: [0],
      priors: [1],
      lookups: buildLookups(examples, categories, new Map(categories.map((cat, idx) => [cat, idx])))
    };
  }

  // Initialize weights to zero
  const weights: number[][] = categories.map(() =>
    new Array(featureDim).fill(0).map(() => (Math.random() - 0.5) * 0.002)
  );
  const biases = new Array(categories.length).fill(0);

  // Map category to index
  const categoryIndex = new Map(categories.map((cat, idx) => [cat, idx]));
  const categoryCounts = new Array(categories.length).fill(0);
  for (const example of examples) {
    const idx = categoryIndex.get(example.category);
    if (idx === undefined) continue;
    const baseWeight = Math.max(0.1, example.weight ?? 1);
    categoryCounts[idx] = (categoryCounts[idx] ?? 0) + baseWeight;
  }

  const totalLabelWeight = categoryCounts.reduce((acc, value) => acc + value, 0);
  const classWeights = categoryCounts.map((count) =>
    count > 0 ? totalLabelWeight / (count * categories.length) : 1
  );

  // Training loop
  let prevLoss = Infinity;
  for (let iter = 0; iter < maxIterations; iter++) {
    // Compute loss and gradients
    let loss = 0;
    let totalWeight = 0;
    const gradients: number[][] = categories.map(() => new Array(featureDim).fill(0));
    const biasGradients = new Array(categories.length).fill(0);

    for (const example of examples) {
      const { features, category } = example;
      const targetIdx = categoryIndex.get(category);
      if (targetIdx === undefined) continue;
      const sampleWeight = Math.max(0.1, example.weight ?? 1) * (classWeights[targetIdx] ?? 1);
      totalWeight += sampleWeight;

      // Compute logits
      const logits = weights.map((w, idx) => sparseDot(features.indices, features.values, w) + (biases[idx] ?? 0));
      const probs = softmax(logits);

      // Compute loss (cross-entropy)
      const targetProb = probs[targetIdx];
      if (targetProb !== undefined) {
        loss -= sampleWeight * Math.log(targetProb + 1e-10);
      }

      // Compute gradients
      for (let c = 0; c < categories.length; c++) {
        const prob = probs[c];
        const grad = gradients[c];
        if (prob === undefined || grad === undefined) continue;

        const error = prob - (c === targetIdx ? 1 : 0);
        biasGradients[c] = (biasGradients[c] ?? 0) + sampleWeight * error;
        for (let i = 0; i < features.indices.length; i++) {
          const idx = features.indices[i];
          const value = features.values[i];
          if (idx !== undefined && value !== undefined && idx < featureDim) {
            grad[idx] = (grad[idx] || 0) + sampleWeight * error * value;
          }
        }
      }
    }

    // Average loss
    const divisor = Math.max(totalWeight, 1e-9);
    loss /= divisor;

    // Add regularization to loss
    for (let c = 0; c < categories.length; c++) {
      const w = weights[c];
      if (!w) continue;
      for (let f = 0; f < featureDim; f++) {
        const weight = w[f];
        if (weight !== undefined) {
          loss += (regularization / 2) * weight * weight;
        }
      }
    }

    // Check convergence
    const relativeDelta = Math.abs(prevLoss - loss) / Math.max(1e-8, prevLoss);
    if (relativeDelta < convergenceThreshold) {
      break;
    }
    prevLoss = loss;

    // Update weights
    const stepSize = learningRate / (1 + iter * 0.03);
    for (let c = 0; c < categories.length; c++) {
      const w = weights[c];
      const grad = gradients[c];
      if (!w || !grad) continue;

      for (let f = 0; f < featureDim; f++) {
        const weight = w[f];
        const gradient = grad[f];
        if (weight !== undefined && gradient !== undefined) {
          const gradientNorm = gradient / divisor;
          const regGradient = regularization * weight;
          w[f] = weight - stepSize * (gradientNorm + regGradient);
        }
      }

      const bias = biases[c] ?? 0;
      const biasGradient = (biasGradients[c] ?? 0) / divisor;
      biases[c] = bias - stepSize * biasGradient;
    }
  }

  const priors = categoryCounts.map((count) => (count + 1) / (totalLabelWeight + categories.length));
  const lookups = buildLookups(examples, categories, categoryIndex);

  return {
    version: 2,
    featureDim,
    categories,
    weights,
    biases,
    priors,
    lookups
  };
}

/**
 * Predict category for a transaction using trained model.
 */
export function predict(model: ModelWeights, features: FeatureVector, signals?: PredictionSignals): Prediction {
  if (model.categories.length === 0) {
    throw new Error("Model has no categories");
  }

  // Single category case
  if (model.categories.length === 1) {
    const category = model.categories[0];
    if (!category) {
      throw new Error("Model has invalid category");
    }
    return {
      category,
      confidence: 1.0,
      probabilities: { [category]: 1.0 }
    };
  }

  const biases = model.biases ?? new Array(model.categories.length).fill(0);
  // Compute logits for each category
  const logits = model.weights.map(
    (w, idx) => sparseDot(features.indices, features.values, w) + (biases[idx] ?? 0)
  );
  const linearProbs = softmax(logits);

  let probs = linearProbs;
  if (signals) {
    const lookup = applyLookupEvidence({ model, signals });
    if (lookup) {
      const lookupWeight = Math.min(0.6, 0.2 + lookup.evidenceCount * 0.03);
      probs = blendProbabilities(linearProbs, lookup.probabilities, lookupWeight);
    }
  }

  // Find best category
  let bestIdx = 0;
  let bestProb = probs[0] || 0;
  for (let i = 1; i < probs.length; i++) {
    const prob = probs[i];
    if (prob !== undefined && prob > bestProb) {
      bestProb = prob;
      bestIdx = i;
    }
  }

  // Build probabilities map
  const probabilities: Record<string, number> = {};
  for (let i = 0; i < model.categories.length; i++) {
    const cat = model.categories[i];
    const prob = probs[i];
    if (cat !== undefined && prob !== undefined) {
      probabilities[cat] = prob;
    }
  }

  const bestCategory = model.categories[bestIdx];
  if (!bestCategory) {
    throw new Error("No category found at best index");
  }

  return {
    category: bestCategory,
    confidence: bestProb,
    probabilities
  };
}

/**
 * Serialize model to JSON
 */
export function serializeModel(model: ModelWeights): string {
  return JSON.stringify(model);
}

/**
 * Deserialize model from JSON
 */
export function deserializeModel(json: string): ModelWeights {
  const parsed = JSON.parse(json);

  // Validate structure
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid model JSON: must be an object");
  }
  if (typeof parsed.featureDim !== "number" || parsed.featureDim <= 0) {
    throw new Error("Invalid model JSON: featureDim must be a positive number");
  }
  if (!Array.isArray(parsed.categories)) {
    throw new Error("Invalid model JSON: categories must be an array");
  }
  if (!Array.isArray(parsed.weights)) {
    throw new Error("Invalid model JSON: weights must be an array");
  }
  if (parsed.weights.length !== parsed.categories.length) {
    throw new Error("Invalid model JSON: weights and categories must have same length");
  }

  const biases = Array.isArray(parsed.biases) ? parsed.biases : new Array(parsed.categories.length).fill(0);
  const priors = Array.isArray(parsed.priors)
    ? parsed.priors
    : new Array(parsed.categories.length).fill(1 / Math.max(1, parsed.categories.length));

  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    featureDim: parsed.featureDim,
    categories: parsed.categories,
    weights: parsed.weights,
    biases,
    priors,
    lookups: parsed.lookups as ModelLookups | undefined
  };
}
