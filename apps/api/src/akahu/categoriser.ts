type AmountOperator = ">" | ">=" | "<" | "<=" | "=";

type AmountCondition =
  | { type: "comparison"; operator: AmountOperator; threshold: number }
  | { type: "exact"; values: number[] };

export type CategoryRuleInput = {
  id?: string;
  priority: number;
  pattern: string;
  field: string;
  category: string;
  categoryType: string;
  amountCondition?: string | null;
  isDisabled?: boolean;
};

export type CategorisationTarget = {
  amount: number;
  descriptionRaw: string;
  merchantName: string;
};

type CompiledRule = {
  priority: number;
  pattern: RegExp;
  field: "merchant_normalised" | "description_raw";
  category: string;
  categoryType: string;
  amountCondition?: AmountCondition;
};

const TRANSFER_HINTS = ["internet xfr", "transfer", "internal", "self", "bnz"];

export function buildCategoriser(rules: CategoryRuleInput[]) {
  const compiled: CompiledRule[] = [];

  for (const rule of rules) {
    if (rule.isDisabled) continue;
    const pattern = rule.pattern?.trim();
    if (!pattern) continue;
    const regex = safeRegex(pattern);
    if (!regex) continue;
    const field = rule.field === "description_raw" ? "description_raw" : "merchant_normalised";
    compiled.push({
      priority: Number.isFinite(rule.priority) ? rule.priority : 1000,
      pattern: regex,
      field,
      category: rule.category || "Uncategorised",
      categoryType: rule.categoryType || "",
      amountCondition: parseAmountCondition(rule.amountCondition ?? "")
    });
  }

  compiled.sort((a, b) => a.priority - b.priority);

  return {
    categorise(target: CategorisationTarget): { category: string; categoryType: string } {
      for (const rule of compiled) {
        const fieldValue = rule.field === "description_raw" ? target.descriptionRaw : target.merchantName;
        if (!rule.pattern.test(fieldValue ?? "")) continue;
        if (rule.amountCondition && !amountConditionMatches(rule.amountCondition, target.amount)) continue;
        return { category: rule.category, categoryType: rule.categoryType };
      }
      return { category: "Uncategorised", categoryType: "" };
    },
    detectTransfer(target: CategorisationTarget): boolean {
      const description = (target.descriptionRaw ?? "").toLowerCase();
      const merchant = (target.merchantName ?? "").toLowerCase();
      return TRANSFER_HINTS.some((hint) => description.includes(hint) || merchant.includes(hint));
    }
  };
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

function amountConditionMatches(condition: AmountCondition, amount: number): boolean {
  const value = Math.abs(amount);
  if (condition.type === "exact") {
    return condition.values.some((candidate) => Math.abs(candidate) === value);
  }

  const threshold = Math.abs(condition.threshold);
  switch (condition.operator) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case "=":
      return value === threshold;
    default:
      return false;
  }
}

function parseAmountCondition(raw: string): AmountCondition | undefined {
  if (!raw) return undefined;
  let normalized = raw.trim().toLowerCase();
  if (!normalized) return undefined;

  const replacements: Array<[string, string]> = [
    ["greater than or equal to", ">="],
    ["greater than", ">"],
    ["more than", ">"],
    ["less than or equal to", "<="],
    ["less than", "<"],
    ["fewer than", "<"],
    ["at least", ">="],
    ["at most", "<="],
    ["no more than", "<="],
    ["no less than", ">="],
    ["equal to", "="]
  ];

  for (const [phrase, symbol] of replacements) {
    normalized = normalized.replace(phrase, symbol);
  }

  normalized = normalized
    .replace("dollars", "")
    .replace("dollar", "")
    .replace("nz$", "$")
    .replace("nzd", "")
    .replace(",", "");
  normalized = normalized.replace(/\s+/g, " ").trim();

  if (/\bor\b/.test(normalized)) {
    const parts = normalized.split(/\bor\b/).map((part) => part.trim()).filter(Boolean);
    const values = parts.map(parseNumericLiteral).filter((value): value is number => value != null);
    if (values.length === parts.length && values.length > 0) {
      return { type: "exact", values };
    }
  }

  const literal = parseNumericLiteral(normalized);
  if (literal != null) {
    return { type: "exact", values: [literal] };
  }

  const condensed = normalized.replace(/\s+/g, "");
  const match = condensed.match(/(>=|<=|>|<|==|=)\$?(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const operatorRaw = match[1];
  if (!operatorRaw) return undefined;
  const operator = operatorRaw === "==" ? "=" : operatorRaw;
  if (!isAmountOperator(operator)) return undefined;
  const threshold = Number(match[2]);
  if (!Number.isFinite(threshold)) return undefined;
  return { type: "comparison", operator, threshold };
}

function parseNumericLiteral(input: string): number | null {
  const cleaned = input.replace(/\s+/g, "");
  const match = cleaned.match(/^\$?(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function isAmountOperator(value: string): value is AmountOperator {
  return value === ">" || value === ">=" || value === "<" || value === "<=" || value === "=";
}
