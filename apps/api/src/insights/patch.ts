import { applyPatch } from "diff";

export function applyUnifiedDiff(params: { previous: string; patch: string }): string {
  const { previous, patch } = params;

  const next = applyPatch(previous, patch);
  if (next === false) {
    throw new Error("Failed to apply unified diff patch");
  }

  return next;
}
