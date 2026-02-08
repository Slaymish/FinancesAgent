/**
 * Model training and prediction service.
 */

import { prisma } from "../prisma.js";
import type { Transaction, User } from "@prisma/client";
import {
  extractFeatures,
  getFeatureDim,
  trainModel,
  predict,
  serializeModel,
  deserializeModel,
  type ModelWeights,
  type TransactionFeatures
} from "../ml/index.js";

const MIN_LABELS_TO_TRAIN = 1;

/**
 * Check if model should be retrained for user.
 */
export async function shouldRetrainModel(userId: string): Promise<boolean> {
  // Get latest model
  const latestModel = await prisma.categoryModel.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" }
  });

  if (!latestModel) {
    // No model yet - check if we have enough labels
    const labelCount = await prisma.transaction.count({
      where: { userId, categoryConfirmed: true }
    });
    return labelCount >= MIN_LABELS_TO_TRAIN;
  }

  // Count new labels since last training
  const newLabelCount = await prisma.transaction.count({
    where: {
      userId,
      categoryConfirmed: true,
      confirmedAt: { gt: latestModel.updatedAt }
    }
  });

  return newLabelCount >= MIN_LABELS_TO_TRAIN;
}

/**
 * Train a new model for user from confirmed transactions.
 */
export async function trainModelForUser(userId: string): Promise<void> {
  // Get all confirmed (labeled) transactions
  const labeledTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      categoryConfirmed: true,
      category: { not: "Uncategorised" }
    },
    orderBy: { confirmedAt: "asc" }
  });

  if (labeledTransactions.length < MIN_LABELS_TO_TRAIN) {
    throw new Error(`Not enough labeled transactions. Need at least ${MIN_LABELS_TO_TRAIN}, have ${labeledTransactions.length}`);
  }

  // Extract features and prepare training examples
  const examples = labeledTransactions.map((tx) => ({
    features: extractFeatures({
      merchantNormalised: tx.merchantName,
      descriptionRaw: tx.descriptionRaw,
      amount: tx.amount,
      accountId: tx.accountName, // Using accountName as ID
      date: tx.date
    }),
    category: tx.category
  }));

  // Train model
  const model = trainModel(examples, getFeatureDim(), {
    learningRate: 0.01,
    regularization: 0.01,
    maxIterations: 100
  });

  // Serialize and store
  const weightsJson = JSON.parse(serializeModel(model));

  await prisma.categoryModel.create({
    data: {
      userId,
      weightsJson,
      trainingLabelCount: labeledTransactions.length
    }
  });
}

/**
 * Load latest model for user.
 */
export async function loadModelForUser(userId: string): Promise<ModelWeights | null> {
  let modelRecord = await prisma.categoryModel.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" }
  });

  if (!modelRecord && (await shouldRetrainModel(userId))) {
    try {
      await trainModelForUser(userId);
      modelRecord = await prisma.categoryModel.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" }
      });
    } catch {
      // Ignore training failures here and allow caller to use a fallback.
    }
  }

  if (!modelRecord) {
    return null;
  }

  return deserializeModel(JSON.stringify(modelRecord.weightsJson));
}

/**
 * Best-effort fallback suggestion when a trained model is unavailable.
 * Returns the most frequent confirmed category entered by the user.
 */
export async function getFallbackSuggestedCategory(userId: string): Promise<string | null> {
  const confirmed = await prisma.transaction.findMany({
    where: {
      userId,
      categoryConfirmed: true,
      category: { not: "Uncategorised" }
    },
    select: { category: true }
  });

  if (confirmed.length === 0) return null;

  const counts = new Map<string, number>();
  for (const row of confirmed) {
    const current = counts.get(row.category) ?? 0;
    counts.set(row.category, current + 1);
  }

  let topCategory: string | null = null;
  let topCount = -1;
  for (const [category, count] of counts) {
    if (count > topCount) {
      topCategory = category;
      topCount = count;
    }
  }

  return topCategory;
}

/**
 * Predict category for a transaction using user's model.
 */
export async function predictCategory(
  userId: string,
  tx: TransactionFeatures
): Promise<{ category: string; confidence: number } | null> {
  const model = await loadModelForUser(userId);
  if (!model) {
    return null;
  }

  const features = extractFeatures(tx);
  const prediction = predict(model, features);

  return {
    category: prediction.category,
    confidence: prediction.confidence
  };
}
