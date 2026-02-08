/**
 * Multinomial logistic regression (softmax classifier) for transaction categorization.
 * 
 * This is a simple in-process implementation that:
 * - Trains via batch gradient descent
 * - Stores weights as JSON
 * - Predicts with softmax
 */

import type { FeatureVector } from "./features.js";

export type ModelWeights = {
  featureDim: number;
  categories: string[];
  weights: number[][]; // [numCategories][featureDim]
};

export type TrainingExample = {
  features: FeatureVector;
  category: string;
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
  const maxLogit = Math.max(...logits);
  const expLogits = logits.map((x) => Math.exp(x - maxLogit));
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
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
    learningRate = 0.01,
    regularization = 0.01,
    maxIterations = 100,
    convergenceThreshold = 1e-4
  } = options;

  // Get unique categories
  const categories = Array.from(new Set(examples.map((ex) => ex.category)));
  if (categories.length === 0) {
    throw new Error("No categories in training data");
  }
  if (categories.length === 1) {
    // Single category - return trivial model
    return {
      featureDim,
      categories,
      weights: [new Array(featureDim).fill(0)]
    };
  }

  // Initialize weights to zero
  const weights: number[][] = categories.map(() => new Array(featureDim).fill(0));

  // Map category to index
  const categoryIndex = new Map(categories.map((cat, idx) => [cat, idx]));

  // Training loop
  let prevLoss = Infinity;
  for (let iter = 0; iter < maxIterations; iter++) {
    // Compute loss and gradients
    let loss = 0;
    const gradients: number[][] = categories.map(() => new Array(featureDim).fill(0));

    for (const example of examples) {
      const { features, category } = example;
      const targetIdx = categoryIndex.get(category);
      if (targetIdx === undefined) continue;

      // Compute logits
      const logits = weights.map((w) => sparseDot(features.indices, features.values, w));
      const probs = softmax(logits);

      // Compute loss (cross-entropy)
      const targetProb = probs[targetIdx];
      if (targetProb !== undefined) {
        loss -= Math.log(targetProb + 1e-10);
      }

      // Compute gradients
      for (let c = 0; c < categories.length; c++) {
        const prob = probs[c];
        const grad = gradients[c];
        if (prob === undefined || grad === undefined) continue;
        
        const error = prob - (c === targetIdx ? 1 : 0);
        for (let i = 0; i < features.indices.length; i++) {
          const idx = features.indices[i];
          const value = features.values[i];
          if (idx !== undefined && value !== undefined && idx < featureDim) {
            grad[idx] = (grad[idx] || 0) + error * value;
          }
        }
      }
    }

    // Average loss
    loss /= examples.length;

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
    if (Math.abs(prevLoss - loss) < convergenceThreshold) {
      break;
    }
    prevLoss = loss;

    // Update weights
    for (let c = 0; c < categories.length; c++) {
      const w = weights[c];
      const grad = gradients[c];
      if (!w || !grad) continue;
      
      for (let f = 0; f < featureDim; f++) {
        const weight = w[f];
        const gradient = grad[f];
        if (weight !== undefined && gradient !== undefined) {
          const gradientNorm = gradient / examples.length;
          const regGradient = regularization * weight;
          w[f] = weight - learningRate * (gradientNorm + regGradient);
        }
      }
    }
  }

  return {
    featureDim,
    categories,
    weights
  };
}

/**
 * Predict category for a transaction using trained model.
 */
export function predict(model: ModelWeights, features: FeatureVector): Prediction {
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

  // Compute logits for each category
  const logits = model.weights.map((w) => sparseDot(features.indices, features.values, w));
  const probs = softmax(logits);

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
  
  return parsed as ModelWeights;
}
