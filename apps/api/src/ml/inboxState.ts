/**
 * Inbox state machine for transaction categorization.
 * 
 * Applies the following logic:
 * 1. Model prediction:
 *    - High confidence (>= threshold) -> auto_classified (source=model)
 *    - Low confidence (< threshold) -> needs_review (source=model)
 * 2. No model prediction -> unclassified (source=none)
 */

import type { InboxState, ClassificationSource } from "@prisma/client";

export type ModelPrediction = {
  category: string;
  categoryType: string;
  confidence: number;
};

export type InboxStateResult = {
  inboxState: InboxState;
  category: string;
  categoryType: string;
  classificationSource: ClassificationSource;
  suggestedCategoryId: string | null;
  confidence: number | null;
};

/**
 * Compute inbox state for a transaction.
 * 
 * @param modelPrediction - Result from model prediction (if any)
 * @param threshold - Auto-apply threshold (default 0.85)
 * @returns Inbox state and categorization result
 */
export function computeInboxState(params: {
  modelPrediction: ModelPrediction | null;
  threshold: number;
}): InboxStateResult {
  const { modelPrediction, threshold } = params;

  // 1. Model prediction exists
  if (modelPrediction) {
    const { category, categoryType, confidence } = modelPrediction;

    // High confidence - auto-classify
    if (confidence >= threshold) {
      return {
        inboxState: "auto_classified",
        category,
        categoryType,
        classificationSource: "model",
        suggestedCategoryId: null,
        confidence
      };
    }

    // Low confidence - needs review
    return {
      inboxState: "needs_review",
      category: "Uncategorised", // Don't auto-apply
      categoryType: "",
      classificationSource: "model",
      suggestedCategoryId: category, // Store as suggestion
      confidence
    };
  }

  // 2. No model prediction - unclassified
  return {
    inboxState: "unclassified",
    category: "Uncategorised",
    categoryType: "",
    classificationSource: "none",
    suggestedCategoryId: null,
    confidence: null
  };
}
