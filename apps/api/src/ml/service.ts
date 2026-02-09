/**
 * Model training and prediction service.
 */

import { prisma } from "../prisma.js";
import {
  computeInboxState,
  extractFeatures,
  extractPredictionSignals,
  getFeatureDim,
  trainModel,
  predict,
  serializeModel,
  deserializeModel,
  type ModelWeights,
  type TransactionFeatures
} from "./index.js";
import { detectTransferTransactionIds } from "./transfers.js";

const MIN_LABELS_TO_TRAIN = 1;
const MAX_MODEL_STALENESS_MS = 24 * 60 * 60 * 1000;

type PredictResult = {
  category: string;
  confidence: number;
};

export type PredictionContext = {
  model: ModelWeights | null;
  fallbackCategory: string | null;
};

export type ReclassifyOptions = {
  startDate?: Date;
  endDate?: Date;
};

function isEligibleTrainingCategory(category: string, isTransfer: boolean): boolean {
  if (isTransfer) return false;

  const normalized = category.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "uncategorised" || normalized === "uncategorized") return false;
  if (normalized === "transfer") return false;
  return true;
}

async function countEligibleLabels(userId: string, since?: Date): Promise<number> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      categoryConfirmed: true,
      ...(since ? { confirmedAt: { gt: since } } : {})
    },
    select: {
      category: true,
      isTransfer: true
    }
  });

  let count = 0;
  for (const row of rows) {
    if (isEligibleTrainingCategory(row.category, row.isTransfer)) {
      count += 1;
    }
  }
  return count;
}

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
    const labelCount = await countEligibleLabels(userId);
    return labelCount >= MIN_LABELS_TO_TRAIN;
  }

  // Count new labels since last training
  const newLabelCount = await countEligibleLabels(userId, latestModel.updatedAt);

  if (newLabelCount >= MIN_LABELS_TO_TRAIN) {
    return true;
  }

  const modelAgeMs = Date.now() - latestModel.updatedAt.getTime();
  if (modelAgeMs < MAX_MODEL_STALENESS_MS) {
    return false;
  }

  const labelCount = await countEligibleLabels(userId);

  return labelCount >= MIN_LABELS_TO_TRAIN;
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
      isTransfer: false
    },
    orderBy: { confirmedAt: "asc" }
  });

  const trainingRows = labeledTransactions.filter((tx) =>
    isEligibleTrainingCategory(tx.category, tx.isTransfer)
  );

  if (trainingRows.length < MIN_LABELS_TO_TRAIN) {
    throw new Error(
      `Not enough labeled transactions. Need at least ${MIN_LABELS_TO_TRAIN}, have ${trainingRows.length}`
    );
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Extract features and prepare training examples
  const examples = trainingRows.map((tx) => {
    const txFeatures = {
      merchantNormalised: tx.merchantName,
      descriptionRaw: tx.descriptionRaw,
      amount: tx.amount,
      accountId: tx.accountName, // Using accountName as ID
      date: tx.date
    };

    const ageDays = tx.confirmedAt
      ? Math.max(0, (now - tx.confirmedAt.getTime()) / dayMs)
      : Math.max(0, (now - tx.date.getTime()) / dayMs);
    const recencyWeight = 0.55 + Math.exp(-ageDays / 180);

    return {
      features: extractFeatures(txFeatures),
      category: tx.category,
      weight: recencyWeight,
      signals: extractPredictionSignals(txFeatures)
    };
  });

  // Train model
  const model = trainModel(examples, getFeatureDim());

  // Serialize and store
  const weightsJson = JSON.parse(serializeModel(model));

  await prisma.categoryModel.create({
    data: {
      userId,
      weightsJson,
      trainingLabelCount: trainingRows.length
    }
  });
}

export async function retrainModelForUserIfNeeded(userId: string): Promise<boolean> {
  if (!(await shouldRetrainModel(userId))) {
    return false;
  }

  await trainModelForUser(userId);
  return true;
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
export async function getFallbackSuggestedCategory(userId: string): Promise<string> {
  const confirmed = await prisma.transaction.findMany({
    where: {
      userId,
      categoryConfirmed: true
    },
    select: {
      category: true,
      isTransfer: true
    }
  });

  const fromConfirmed = pickMostFrequentCategory(
    confirmed
      .filter((row) => isEligibleTrainingCategory(row.category, row.isTransfer))
      .map((row) => row.category)
  );
  if (fromConfirmed) return fromConfirmed;

  // Fallback to any previously assigned category if explicit confirmations don't exist.
  const historical = await prisma.transaction.findMany({
    where: { userId },
    select: {
      category: true,
      isTransfer: true
    }
  });

  return (
    pickMostFrequentCategory(
      historical
        .filter((row) => isEligibleTrainingCategory(row.category, row.isTransfer))
        .map((row) => row.category)
    ) ?? "Uncategorised"
  );
}

function pickMostFrequentCategory(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const category = raw.trim();
    if (!category) continue;
    const normalized = category.toLowerCase();
    if (normalized === "uncategorised" || normalized === "uncategorized") continue;
    if (normalized === "transfer") continue;

    const current = counts.get(category) ?? 0;
    counts.set(category, current + 1);
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

export async function getPredictionContextForUser(userId: string): Promise<PredictionContext> {
  const model = await loadModelForUser(userId);
  if (model) {
    return {
      model,
      fallbackCategory: null
    };
  }

  return {
    model: null,
    fallbackCategory: await getFallbackSuggestedCategory(userId)
  };
}

export function predictCategoryWithContext(
  context: PredictionContext,
  tx: TransactionFeatures
): PredictResult | null {
  if (context.model) {
    const features = extractFeatures(tx);
    const signals = extractPredictionSignals(tx);
    const prediction = predict(context.model, features, signals);
    return {
      category: prediction.category,
      confidence: prediction.confidence
    };
  }

  if (context.fallbackCategory) {
    return {
      category: context.fallbackCategory,
      confidence: 0
    };
  }

  return null;
}

function sameOptionalNumber(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) < 1e-6;
}

function inTargetRange(date: Date, startDate?: Date, endDate?: Date): boolean {
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

export async function reclassifyTransactionsForUser(params: {
  userId: string;
  threshold: number;
  options?: ReclassifyOptions;
}): Promise<number> {
  const { userId, threshold, options } = params;

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    select: {
      id: true,
      amount: true,
      descriptionRaw: true,
      merchantName: true,
      accountName: true,
      date: true,
      category: true,
      categoryType: true,
      isTransfer: true,
      inboxState: true,
      classificationSource: true,
      suggestedCategoryId: true,
      confidence: true,
      categoryConfirmed: true
    }
  });

  if (transactions.length === 0) return 0;

  const transferIds = detectTransferTransactionIds(transactions);
  const predictionContext = await getPredictionContextForUser(userId);
  const updates = [];

  for (const tx of transactions) {
    if (!inTargetRange(tx.date, options?.startDate, options?.endDate)) {
      continue;
    }

    const nextTransfer = transferIds.has(tx.id);
    let nextCategory = tx.category;
    let nextCategoryType = tx.categoryType;
    let nextInboxState = tx.inboxState;
    let nextClassificationSource = tx.classificationSource;
    let nextSuggested = tx.suggestedCategoryId;
    let nextConfidence = tx.confidence;

    if (!tx.categoryConfirmed) {
      if (nextTransfer) {
        nextCategory = "Transfer";
        nextCategoryType = "";
        nextInboxState = "auto_classified";
        nextClassificationSource = "model";
        nextSuggested = null;
        nextConfidence = 1;
      } else {
        const prediction = predictCategoryWithContext(predictionContext, {
          merchantNormalised: tx.merchantName,
          descriptionRaw: tx.descriptionRaw,
          amount: tx.amount,
          accountId: tx.accountName,
          date: tx.date
        });

        const inboxResult = computeInboxState({
          modelPrediction: prediction
            ? {
                category: prediction.category,
                categoryType: "",
                confidence: prediction.confidence
              }
            : null,
          threshold
        });

        nextCategory = inboxResult.category;
        nextCategoryType = inboxResult.categoryType;
        nextInboxState = inboxResult.inboxState;
        nextClassificationSource = inboxResult.classificationSource;
        nextSuggested = inboxResult.suggestedCategoryId;
        nextConfidence = inboxResult.confidence;
      }
    }

    const changed =
      tx.isTransfer !== nextTransfer ||
      (!tx.categoryConfirmed &&
        (tx.category !== nextCategory ||
          tx.categoryType !== nextCategoryType ||
          tx.inboxState !== nextInboxState ||
          tx.classificationSource !== nextClassificationSource ||
          tx.suggestedCategoryId !== nextSuggested ||
          !sameOptionalNumber(tx.confidence, nextConfidence)));

    if (!changed) continue;

    updates.push(
      prisma.transaction.update({
        where: { id: tx.id },
        data: {
          isTransfer: nextTransfer,
          ...(tx.categoryConfirmed
            ? {}
            : {
                category: nextCategory,
                categoryType: nextCategoryType,
                inboxState: nextInboxState,
                classificationSource: nextClassificationSource,
                suggestedCategoryId: nextSuggested,
                confidence: nextConfidence
              })
        }
      })
    );
  }

  for (let i = 0; i < updates.length; i += 100) {
    await prisma.$transaction(updates.slice(i, i + 100));
  }

  return updates.length;
}

export async function retrainAndReclassifyIfNeeded(params: {
  userId: string;
  threshold: number;
}): Promise<{ retrained: boolean; reclassified: number }> {
  const retrained = await retrainModelForUserIfNeeded(params.userId);
  if (!retrained) {
    return { retrained: false, reclassified: 0 };
  }

  const reclassified = await reclassifyTransactionsForUser({
    userId: params.userId,
    threshold: params.threshold
  });
  return { retrained: true, reclassified };
}

/**
 * Predict category for a transaction using user's model.
 */
export async function predictCategory(
  userId: string,
  tx: TransactionFeatures
): Promise<{ category: string; confidence: number } | null> {
  const context = await getPredictionContextForUser(userId);
  return predictCategoryWithContext(context, tx);
}
