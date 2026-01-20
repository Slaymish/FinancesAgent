"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Card } from "./ui";
import { SparkBars, SparkLine } from "./charts";
import { formatCurrency, formatNumber } from "../lib/format";

type MonthlyNet = { month: string; income: number; expense: number; net: number };
type CategorySpend = { category: string; amount: number; categoryType: string };
type Transaction = {
  id: string;
  date: string;
  accountName: string;
  amount: number;
  balance?: number | null;
  merchantName: string;
  descriptionRaw: string;
  category: string;
  categoryType: string;
};

type PageId = "dashboard" | "planning" | "settings" | "data";

type DashboardTabsProps = {
  totals: { income30: number; expense30: number; net30: number };
  byType: Record<string, number>;
  monthlyNet: MonthlyNet[];
  topCategories: CategorySpend[];
  latest: Transaction[];
  isDemo: boolean;
  initialManualData: ManualData | null;
  page?: PageId;
};

type ScenarioId = "steady" | "save-5" | "spend-5" | "income-up";
export type AccountType = "unclassified" | "cash" | "savings" | "investments" | "other" | "liability";
export type SavingsBucket = "" | "emergency" | "investments" | "medium-term";

export type ManualAccount = {
  id: string;
  name: string;
  type: AccountType;
  bucket: SavingsBucket;
  balance: number | "";
};

export type UpcomingExpense = {
  id: string;
  label: string;
  month: string;
  amount: number | "";
};

export type ManualGoals = {
  emergencyTarget: number | "";
  tripTarget: number | "";
};

export type ManualIncome = {
  expectedMonthly: number | "";
  frequency: "weekly" | "fortnightly" | "monthly" | "annual" | "";
};

export type ManualBudget = {
  monthStart: number | "";
  bufferPct: number | "";
};

export type ManualPreferences = {
  currency: string;
  timezone: string;
  horizonMonths: number | "";
  rounding: number | "";
};

export type ManualData = {
  accounts: ManualAccount[];
  upcomingExpenses: UpcomingExpense[];
  savingsTargetRate: number | "";
  goals: ManualGoals;
  income: ManualIncome;
  budget: ManualBudget;
  preferences: ManualPreferences;
};

type CategoryRuleForm = {
  localId: string;
  pattern: string;
  field: "description_raw" | "merchant_normalised";
  category: string;
  categoryType: string;
  priority: number | "";
  amountCondition: string;
  isDisabled: boolean;
};

const emptyManualData: ManualData = {
  accounts: [],
  upcomingExpenses: [],
  savingsTargetRate: "",
  goals: { emergencyTarget: "", tripTarget: "" },
  income: { expectedMonthly: "", frequency: "" },
  budget: { monthStart: "", bufferPct: "" },
  preferences: {
    currency: "NZD",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    horizonMonths: 12,
    rounding: 2
  }
};

const scenarioOptions = [
  { id: "steady", label: "No change" },
  { id: "save-5", label: "Save +5%" },
  { id: "spend-5", label: "Spend +5%" },
  { id: "income-up", label: "Income +5%" }
] as const;

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: "unclassified", label: "Unclassified" },
  { value: "cash", label: "Cash" },
  { value: "savings", label: "Savings" },
  { value: "investments", label: "Investments" },
  { value: "other", label: "Other assets" },
  { value: "liability", label: "Liability" }
];

const bucketOptions: Array<{ value: SavingsBucket; label: string }> = [
  { value: "", label: "No bucket" },
  { value: "emergency", label: "Emergency" },
  { value: "investments", label: "Investments" },
  { value: "medium-term", label: "Medium-term" }
];

const defaultTabByPage: Record<PageId, string> = {
  dashboard: "overview",
  planning: "scenarios",
  settings: "accounts",
  data: "transactions"
};

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatMonthLabel(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short" });
}

function formatMonthLong(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function addMonths(value: string, offset: number) {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseAmount(value: string) {
  if (!value) return "";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "";
  return parsed;
}

function formatMaybeCurrency(value: number | null) {
  if (value === null) return "—";
  return formatCurrency(value);
}

function normalizeManualData(value: ManualData | null | undefined): ManualData {
  if (!value) return emptyManualData;
  return {
    ...emptyManualData,
    ...value,
    accounts: Array.isArray(value.accounts) ? value.accounts : [],
    upcomingExpenses: Array.isArray(value.upcomingExpenses) ? value.upcomingExpenses : [],
    goals: { ...emptyManualData.goals, ...(value.goals ?? {}) },
    income: { ...emptyManualData.income, ...(value.income ?? {}) },
    budget: { ...emptyManualData.budget, ...(value.budget ?? {}) },
    preferences: { ...emptyManualData.preferences, ...(value.preferences ?? {}) }
  };
}

export function DashboardTabs({
  totals,
  byType,
  monthlyNet,
  topCategories,
  latest,
  isDemo,
  initialManualData,
  page = "dashboard"
}: DashboardTabsProps) {
  const [selectedCategory, setSelectedCategory] = useState(topCategories[0]?.category ?? "");
  const [scenario, setScenario] = useState<ScenarioId>("steady");
  const [decisionAmountInput, setDecisionAmountInput] = useState("");
  const [decisionLabel, setDecisionLabel] = useState("Can I afford this?");
  const [decisionMonths, setDecisionMonths] = useState(3);
  const [activeTab, setActiveTab] = useState(defaultTabByPage[page]);
  const [manualData, setManualData] = useState<ManualData>(() => normalizeManualData(initialManualData));
  const [categoryRules, setCategoryRules] = useState<CategoryRuleForm[]>([]);
  const [categoryStatus, setCategoryStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<number | null>(null);
  const hasMounted = useRef(false);
  const [newAccount, setNewAccount] = useState<ManualAccount>({
    id: "",
    name: "",
    type: "unclassified",
    bucket: "",
    balance: ""
  });
  const [newExpense, setNewExpense] = useState<UpcomingExpense>({ id: "", label: "", month: "", amount: "" });

  const last12 = useMemo(() => monthlyNet.slice(-12), [monthlyNet]);
  const last6 = useMemo(() => monthlyNet.slice(-6), [monthlyNet]);
  const last3 = useMemo(() => monthlyNet.slice(-3), [monthlyNet]);

  useEffect(() => {
    const latestAccounts = Array.from(
      new Set(latest.map((tx) => tx.accountName).filter((name) => name && name.trim()))
    );
    if (latestAccounts.length === 0) return;

    setManualData((prev) => {
      const existingByName = new Map(prev.accounts.map((account) => [account.name, account]));
      const mergedAccounts = [...prev.accounts];
      let changed = false;
      latestAccounts.forEach((name) => {
        if (!existingByName.has(name)) {
          mergedAccounts.push({
            id: createId(),
            name,
            type: "unclassified",
            bucket: "",
            balance: ""
          });
          changed = true;
        }
      });
      return changed ? { ...prev, accounts: mergedAccounts } : prev;
    });
  }, [latest]);

  useEffect(() => {
    if (isDemo) return;
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }

    setSaveStatus("saving");
    saveTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/manual-data", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data: manualData })
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, 700);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [manualData, isDemo]);

  useEffect(() => {
    setActiveTab(defaultTabByPage[page]);
  }, [page]);

  useEffect(() => {
    if (isDemo) return;
    let isMounted = true;
    setCategoryStatus("loading");
    setCategoryError(null);
    fetch("/api/categories")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { rules?: CategoryRuleForm[] };
        if (!res.ok) throw new Error("failed");
        const rules = Array.isArray(body.rules) ? body.rules : [];
        const normalized = rules.map((rule, index) => ({
          localId: (rule as { id?: string }).id ?? createId(),
          pattern: (rule as { pattern?: string }).pattern ?? "",
          field:
            (rule as { field?: string }).field === "description_raw" ? "description_raw" : "merchant_normalised",
          category: (rule as { category?: string }).category ?? "",
          categoryType: (rule as { categoryType?: string }).categoryType ?? "",
          priority:
            typeof (rule as { priority?: number }).priority === "number" ? (rule as { priority?: number }).priority : index + 1,
          amountCondition: (rule as { amountCondition?: string | null }).amountCondition ?? "",
          isDisabled: Boolean((rule as { isDisabled?: boolean }).isDisabled)
        }));
        if (isMounted) {
          setCategoryRules(normalized);
          setCategoryStatus("idle");
        }
      })
      .catch(() => {
        if (isMounted) {
          setCategoryStatus("error");
          setCategoryError("Failed to load rules");
        }
      });
    return () => {
      isMounted = false;
    };
  }, [isDemo]);

  const latestTransaction = latest.reduce<Transaction | null>((greatest, tx) => {
    if (!greatest) return tx;
    return new Date(tx.date).getTime() > new Date(greatest.date).getTime() ? tx : greatest;
  }, null);
  const latestActivityLabel = latestTransaction ? new Date(latestTransaction.date).toLocaleDateString() : "—";

  const accountsWithBalance = manualData.accounts.filter((account) => typeof account.balance === "number");
  const hasBalances = accountsWithBalance.length > 0;
  const cashBalance = accountsWithBalance
    .filter((account) => account.type === "cash" || account.type === "savings")
    .reduce((sum, account) => sum + (account.balance as number), 0);
  const netWorthNow = hasBalances
    ? accountsWithBalance.reduce((sum, account) => sum + (account.balance as number), 0)
    : null;

  const netWorthSeries = useMemo(() => {
    if (!hasBalances || last12.length === 0 || netWorthNow === null) return [];
    const series: Array<{ label: string; value: number }> = [];
    let running = netWorthNow;
    for (let i = last12.length - 1; i >= 0; i -= 1) {
      const month = last12[i];
      if (!month) continue;
      series.unshift({ label: month.month, value: running });
      running -= month.net;
    }
    return series;
  }, [hasBalances, last12, netWorthNow]);

  const avgExpense = average(last3.map((month) => month.expense));
  const runwayMonths = cashBalance > 0 && avgExpense > 0 ? cashBalance / avgExpense : null;
  const runwayTone =
    runwayMonths === null ? "neutral" : runwayMonths >= 6 ? "positive" : runwayMonths >= 3 ? "warn" : "negative";

  const rollingIncome = last3.reduce((sum, item) => sum + item.income, 0);
  const rollingSavings = last3.reduce((sum, item) => sum + item.net, 0);
  const savingsRate = rollingIncome > 0 ? (rollingSavings / rollingIncome) * 100 : 0;

  const savingsTargetRate = typeof manualData.savingsTargetRate === "number" ? manualData.savingsTargetRate : null;
  const savingsTarget = savingsTargetRate !== null ? totals.income30 * (savingsTargetRate / 100) : null;
  const safeToSpend = savingsTarget !== null ? totals.income30 - totals.expense30 - savingsTarget : null;
  const safeTone = safeToSpend !== null && safeToSpend >= 0 ? "positive" : "negative";

  const incomeVsSpend = last6.map((item) => ({
    label: formatMonthLabel(item.month),
    income: item.income,
    spend: item.expense
  }));
  const incomeSpendMax = Math.max(1, ...incomeVsSpend.map((item) => Math.max(item.income, item.spend)));

  const spendingTrend = last6.map((item) => ({ label: item.month, value: item.expense }));
  const categoryList = topCategories.slice(0, 5);
  const categoryMax = Math.max(1, ...categoryList.map((item) => Math.abs(item.amount)));
  const fixedSpend = byType.essential ?? 0;
  const discretionarySpend = byType.want ?? 0;
  const splitTotal = fixedSpend + discretionarySpend || 1;
  const fixedPct = (fixedSpend / splitTotal) * 100;

  const allocationTotals = manualData.accounts.reduce(
    (acc, account) => {
      if (typeof account.balance !== "number") return acc;
      if (!account.bucket) return acc;
      acc[account.bucket] += account.balance;
      return acc;
    },
    { emergency: 0, investments: 0, "medium-term": 0 }
  );
  const allocationList = [
    { label: "Emergency", amount: allocationTotals.emergency },
    { label: "Investments", amount: allocationTotals.investments },
    { label: "Medium-term", amount: allocationTotals["medium-term"] }
  ];
  const allocationMax = Math.max(1, ...allocationList.map((item) => Math.abs(item.amount)));

  const breakdownTotals = manualData.accounts.reduce(
    (acc, account) => {
      if (typeof account.balance !== "number") return acc;
      if (account.type === "cash" || account.type === "savings") acc.cash += account.balance;
      else if (account.type === "investments") acc.investments += account.balance;
      else if (account.type === "other") acc.other += account.balance;
      else if (account.type === "liability") acc.liabilities += account.balance;
      else acc.unclassified += account.balance;
      return acc;
    },
    { cash: 0, investments: 0, other: 0, liabilities: 0, unclassified: 0 }
  );
  const netWorthBreakdown = [
    { label: "Cash", amount: breakdownTotals.cash },
    { label: "Investments", amount: breakdownTotals.investments },
    { label: "Other assets", amount: breakdownTotals.other },
    { label: "Liabilities", amount: breakdownTotals.liabilities }
  ];
  if (breakdownTotals.unclassified !== 0) {
    netWorthBreakdown.push({ label: "Unclassified", amount: breakdownTotals.unclassified });
  }

  const firstNetWorth = netWorthSeries[0];
  const lastNetWorth = netWorthSeries[netWorthSeries.length - 1];
  const netWorthChange = firstNetWorth && lastNetWorth ? lastNetWorth.value - firstNetWorth.value : null;
  const contributionTotal = last12.reduce((sum, item) => sum + item.net, 0);
  const growthTotal = netWorthChange !== null ? netWorthChange - contributionTotal : null;
  const netWorthTone = netWorthChange === null ? "neutral" : netWorthChange >= 0 ? "positive" : "negative";

  const baseIncome = average(last6.map((item) => item.income));
  const baseExpense = average(last6.map((item) => item.expense));
  const scenarioIncome = scenario === "income-up" ? baseIncome * 1.05 : baseIncome;
  const scenarioExpense =
    scenario === "spend-5" ? baseExpense * 1.05 : scenario === "save-5" ? baseExpense * 0.95 : baseExpense;
  const scenarioNet = scenarioIncome - scenarioExpense;

  const projectionBaseMonth = last6[last6.length - 1]?.month ?? "";
  const projectionSeries =
    netWorthNow !== null && projectionBaseMonth
      ? Array.from({ length: 6 }, (_, index) => {
          const label = addMonths(projectionBaseMonth, index + 1);
          const projectedValue = netWorthNow + scenarioNet * (index + 1);
          return { label, value: projectedValue };
        })
      : [];
  const projectedNetWorth = projectionSeries[projectionSeries.length - 1]?.value ?? null;
  const projectedCash = cashBalance > 0 ? cashBalance + scenarioNet * 2 : null;

  const emergencyTarget =
    typeof manualData.goals.emergencyTarget === "number" ? manualData.goals.emergencyTarget : null;
  const tripTarget = typeof manualData.goals.tripTarget === "number" ? manualData.goals.tripTarget : null;
  const tripSaved = allocationTotals["medium-term"];
  const emergencyProgress =
    emergencyTarget !== null && emergencyTarget > 0 && cashBalance > 0
      ? Math.min(1, cashBalance / emergencyTarget)
      : 0;
  const tripProgress = tripTarget !== null && tripTarget > 0 ? Math.min(1, tripSaved / tripTarget) : 0;

  const saveMeta = isDemo
    ? { label: "Demo only", className: "chip muted" }
    : saveStatus === "saving"
      ? { label: "Saving...", className: "chip" }
      : saveStatus === "saved"
        ? { label: "Saved", className: "chip good" }
        : saveStatus === "error"
          ? { label: "Save failed", className: "chip attention" }
          : { label: "Not saved", className: "chip muted" };

  const decisionAmountValue = parseAmount(decisionAmountInput);
  const decisionCashImpact =
    typeof decisionAmountValue === "number" ? (cashBalance ?? 0) - decisionAmountValue : null;
  const decisionSeries =
    typeof decisionAmountValue === "number" && decisionMonths > 0
      ? Array.from({ length: decisionMonths }, (_, index) => ({
          label: `${index + 1}m`,
          value: (cashBalance ?? 0) - decisionAmountValue + scenarioNet * index
        }))
      : [];
  const planningMessage =
    decisionCashImpact === null
      ? "Enter an amount to preview cash impact."
      : decisionCashImpact >= 0
        ? "Within current runway."
        : "Stretching the runway.";
  const assumptionNotes = [
    { label: "Base income", value: `${formatCurrency(baseIncome)} / mo` },
    { label: "Base spend", value: `${formatCurrency(baseExpense)} / mo` },
    { label: "Scenario net", value: `${formatCurrency(scenarioNet)} / mo` }
  ];
  const updateAccount = (id: string, patch: Partial<ManualAccount>) => {
    setManualData((prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) => (account.id === id ? { ...account, ...patch } : account))
    }));
  };

  const removeAccount = (id: string) => {
    setManualData((prev) => ({ ...prev, accounts: prev.accounts.filter((account) => account.id !== id) }));
  };

  const addAccount = () => {
    if (!newAccount.name.trim()) return;
    setManualData((prev) => ({
      ...prev,
      accounts: [
        ...prev.accounts,
        { ...newAccount, id: createId(), name: newAccount.name.trim(), balance: newAccount.balance }
      ]
    }));
    setNewAccount({ id: "", name: "", type: "unclassified", bucket: "", balance: "" });
  };

  const addExpense = () => {
    if (!newExpense.label.trim() || !newExpense.month) return;
    setManualData((prev) => ({
      ...prev,
      upcomingExpenses: [
        ...prev.upcomingExpenses,
        { ...newExpense, id: createId(), label: newExpense.label.trim(), amount: newExpense.amount }
      ]
    }));
    setNewExpense({ id: "", label: "", month: "", amount: "" });
  };

  const removeExpense = (id: string) => {
    setManualData((prev) => ({
      ...prev,
      upcomingExpenses: prev.upcomingExpenses.filter((expense) => expense.id !== id)
    }));
  };

  const updateCategoryRule = (localId: string, patch: Partial<CategoryRuleForm>) => {
    setCategoryRules((prev) => prev.map((rule) => (rule.localId === localId ? { ...rule, ...patch } : rule)));
  };

  const addCategoryRule = () => {
    setCategoryRules((prev) => [
      ...prev,
      {
        localId: createId(),
        pattern: "",
        field: "merchant_normalised",
        category: "",
        categoryType: "",
        priority: prev.length + 1,
        amountCondition: "",
        isDisabled: false
      }
    ]);
  };

  const removeCategoryRule = (localId: string) => {
    setCategoryRules((prev) => prev.filter((rule) => rule.localId !== localId));
  };

  const saveCategoryRules = async () => {
    if (isDemo) return;
    setCategoryStatus("saving");
    setCategoryError(null);
    try {
      const payloadRules = categoryRules.map((rule, index) => ({
        pattern: rule.pattern.trim(),
        field: rule.field,
        category: rule.category.trim(),
        categoryType: rule.categoryType.trim(),
        priority: typeof rule.priority === "number" ? rule.priority : index + 1,
        amountCondition: rule.amountCondition.trim() || null,
        isDisabled: rule.isDisabled
      }));
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules: payloadRules })
      });
      if (!res.ok) throw new Error("save_failed");
      setCategoryStatus("saved");
    } catch {
      setCategoryStatus("error");
      setCategoryError("Save failed");
    }
  };

  const reapplyCategoryRules = async () => {
    if (isDemo) return;
    try {
      await fetch("/api/categories/reapply", { method: "POST" });
    } catch {
      setCategoryError("Reapply failed");
    }
  };

  const categorySaveLabel =
    categoryStatus === "saving"
      ? "Saving"
      : categoryStatus === "saved"
        ? "Saved"
        : categoryStatus === "error"
          ? "Error"
          : "Save";

  const dashboardTabs = [
    {
      id: "overview",
      label: "Overview",
      hint: "Net worth + runway",
      content: (
        <div className="dashboard-grid cols-2">
          <Card title="Net worth & runway">
            <div className="glance-grid">
              <div className="glance-block">
                <div className="glance-title-row">
                  <span className="glance-title">Net worth (est.)</span>
                  <Badge tone={netWorthTone}>{formatCurrency(netWorthChange)}</Badge>
                </div>
                <div className="glance-value">{formatMaybeCurrency(lastNetWorth?.value ?? netWorthNow ?? null)}</div>
                {netWorthSeries.length > 0 ? (
                  <>
                    <SparkLine data={netWorthSeries.map((item) => ({ value: item.value }))} height={80} />
                  </>
                ) : (
                  <p className="muted small">Add balances.</p>
                )}
              </div>
              <div className="glance-block">
                <div className="glance-title-row">
                  <span className="glance-title">Cash runway</span>
                  <span className={`glance-value ${runwayTone}`}>
                    {runwayMonths === null ? "—" : `${runwayMonths.toFixed(1)} mo`}
                  </span>
                </div>
                <div className="glance-title-row">
                  <span className="glance-title">Savings rate (3m)</span>
                  <span className="glance-value">{formatNumber(savingsRate, 1)}%</span>
                </div>
                <div className="glance-title-row">
                  <span className="glance-title">Safe to spend</span>
                  <span className={`glance-value ${safeTone}`}>{formatCurrency(safeToSpend)}</span>
                </div>
              </div>
            </div>
          </Card>
          <Card title="Income vs spending">
            <div className="comparison-bars">
              {incomeVsSpend.map((item) => (
                <div key={item.label} className="comparison-bars__row">
                  <span className="comparison-bars__label">{item.label}</span>
                  <div className="comparison-bars__bars">
                    <span
                      className="comparison-bars__bar income"
                      style={{ width: `${(item.income / incomeSpendMax) * 100}%` }}
                    />
                    <span
                      className="comparison-bars__bar spend"
                      style={{ width: `${(item.spend / incomeSpendMax) * 100}%` }}
                    />
                  </div>
                  <strong className="comparison-bars__value">
                    {formatCurrency(item.income)} / {formatCurrency(item.spend)}
                  </strong>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )
    },
    {
      id: "spending",
      label: "Spending",
      hint: "Trend + categories",
      content: (
        <div className="dashboard-grid cols-2">
          <Card title="Monthly spending trend">
            <SparkBars data={spendingTrend.map((item) => ({ label: item.label, value: item.value }))} height={120} />
          </Card>
          <Card title="Category mix">
            <div className="bar-list">
              {categoryList.map((category) => (
                <div key={category.category} className="bar-list__row">
                  <div className="bar-list__label">
                    <span>{category.category}</span>
                    <Badge tone={category.categoryType === "discretionary" ? "negative" : "neutral"}>
                      {category.categoryType || "uncategorised"}
                    </Badge>
                  </div>
                  <div className="bar-list__track">
                    <span
                      className="bar-list__bar"
                      style={{ width: `${(Math.abs(category.amount) / categoryMax) * 100}%` }}
                    />
                  </div>
                  <div className="bar-list__label">{formatCurrency(category.amount)}</div>
                </div>
              ))}
            </div>
            <div className="split-meter">
              <span className="split-meter__segment fixed" style={{ width: `${fixedPct}%` }} />
              <span className="split-meter__segment discretionary" style={{ width: `${100 - fixedPct}%` }} />
            </div>
            <div className="split-labels">
              <span>
                Fixed {formatCurrency(fixedSpend)} ({fixedPct.toFixed(0)}%)
              </span>
              <span>
                Discretionary {formatCurrency(discretionarySpend)} ({(100 - fixedPct).toFixed(0)}%)
              </span>
            </div>
            <div className="field">
              <label htmlFor="drill-category">Category drill-down</label>
              <select
                id="drill-category"
                className="input"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                {categoryList.map((category) => (
                  <option key={category.category} value={category.category}>
                    {category.category}
                  </option>
                ))}
              </select>
            </div>
          </Card>
        </div>
      )
    },
    {
      id: "saving",
      label: "Saving & Wealth",
      hint: "Allocation + breakdown",
      content: (
        <Card title="Saving & Wealth">
          {netWorthSeries.length > 0 ? (
            <SparkLine data={netWorthSeries.map((item) => ({ value: item.value }))} height={90} />
          ) : (
            <div className="placeholder">Add balances to view savings over time.</div>
          )}
          <div className="glance-grid">
            <div className="glance-block">
              <div className="glance-title">Savings allocation</div>
              {allocationList.map((item) => (
                <div key={item.label} className="table-row">
                  <strong>{item.label}</strong>
                  <span>{formatCurrency(item.amount)}</span>
                  <div className="bar-list__track">
                    <span
                      className="bar-list__bar"
                      style={{ width: `${(Math.abs(item.amount) / allocationMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="glance-block">
              <div className="glance-title">Net worth breakdown</div>
              {netWorthBreakdown.map((slice) => (
                <div key={slice.label} className="table-row">
                  <strong>{slice.label}</strong>
                  <span>{formatCurrency(slice.amount)}</span>
                </div>
              ))}
            </div>
            <div className="glance-block">
              <div className="glance-title">Contributions vs growth</div>
              <div className="table-row">
                <strong>Contributions</strong>
                <span>{formatCurrency(contributionTotal)}</span>
              </div>
              <div className="table-row">
                <strong>Growth</strong>
                <span>{formatCurrency(growthTotal)}</span>
              </div>
            </div>
          </div>
        </Card>
      )
    },
    {
      id: "planning",
      label: "Planning (light)",
      hint: "Upcoming + goals",
      content: (
        <Card title="Upcoming commitments">
          <div className="section-list">
            <strong>Upcoming known expenses</strong>
            {manualData.upcomingExpenses.length === 0 ? (
              <p className="muted small">No upcoming expenses.</p>
            ) : (
              <ul className="change-list">
                {manualData.upcomingExpenses.map((expense) => (
                  <li key={expense.id} className="change-item">
                    <div className="change-meta">
                      <span>{expense.label}</span>
                      <span className="muted small">{expense.month}</span>
                    </div>
                    <strong>{typeof expense.amount === "number" ? formatCurrency(expense.amount) : "—"}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="expense-label">Expense</label>
              <input
                id="expense-label"
                className="input"
                value={newExpense.label}
                onChange={(event) => setNewExpense((prev) => ({ ...prev, label: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="expense-month">Month</label>
              <input
                id="expense-month"
                className="input"
                type="month"
                value={newExpense.month}
                onChange={(event) => setNewExpense((prev) => ({ ...prev, month: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="expense-amount">Amount</label>
              <input
                id="expense-amount"
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={newExpense.amount}
                onChange={(event) => setNewExpense((prev) => ({ ...prev, amount: parseAmount(event.target.value) }))}
              />
            </div>
          </div>
          <button type="button" className="button" onClick={addExpense}>
            Save expense
          </button>
          <div className="goal-stack">
            <div>
              <div className="goal-row">
                <span>Emergency fund</span>
                <span className="muted small">
                  {formatMaybeCurrency(cashBalance || null)} / {formatMaybeCurrency(emergencyTarget)}
                </span>
              </div>
              <div className="progress">
                <div className="progress__bar" style={{ width: `${emergencyProgress * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="goal-row">
                <span>Trip fund</span>
                <span className="muted small">
                  {formatMaybeCurrency(tripSaved)} / {formatMaybeCurrency(tripTarget)}
                </span>
              </div>
              <div className="progress">
                <div className="progress__bar alt" style={{ width: `${tripProgress * 100}%` }} />
              </div>
            </div>
          </div>
        </Card>
      )
    }
  ];

  const planningTabs = [
    {
      id: "scenarios",
      label: "Scenarios",
      hint: "Income + spending",
      content: (
        <Card title="Scenarios">
          <div className="chip-row">
            {scenarioOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`chip-button${scenario === option.id ? " is-active" : ""}`}
                onClick={() => setScenario(option.id as ScenarioId)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>
      )
    },
    {
      id: "one-off",
      label: "One-off decisions",
      hint: "Affordability",
      content: (
        <Card title="One-off decisions">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="decision-label">Decision</label>
              <input
                id="decision-label"
                className="input"
                value={decisionLabel}
                onChange={(event) => setDecisionLabel(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="decision-amount">Amount</label>
              <input
                id="decision-amount"
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={decisionAmountInput}
                onChange={(event) => setDecisionAmountInput(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="decision-months">Review horizon</label>
              <select
                id="decision-months"
                className="input"
                value={decisionMonths}
                onChange={(event) => setDecisionMonths(Number(event.target.value))}
              >
                {[3, 6, 12].map((value) => (
                  <option key={value} value={value}>
                    {value} months
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="glance-grid">
            <div className="glance-block">
              <div className="glance-title">Cash impact</div>
              <div
                className={`glance-value ${decisionCashImpact !== null && decisionCashImpact >= 0 ? "positive" : "negative"}`}
              >
                {decisionCashImpact === null ? "—" : formatCurrency(decisionCashImpact)}
              </div>
              <p className="muted small">{planningMessage}</p>
            </div>
              <div className="glance-block">
                <div className="glance-title">Net worth preview</div>
                <div className="glance-value">
                  {typeof decisionAmountValue === "number" ? formatCurrency(-decisionAmountValue) : "—"}
                </div>
              </div>
            </div>
            {decisionSeries.length > 0 ? (
              <SparkLine data={decisionSeries.map((item) => ({ value: item.value }))} height={80} />
            ) : (
              <p className="muted small">Enter an amount.</p>
            )}
          </Card>
      )
    },
    {
      id: "projections",
      label: "Projections",
      hint: "Cash + net worth",
      content: (
        <div className="dashboard-grid cols-2">
          <Card title="Projections">
            {projectionSeries.length > 0 ? (
              <>
                <SparkLine data={projectionSeries.map((item) => ({ value: item.value }))} height={90} />
                <div className="pill-row">
                  <span className="inline-pill">Net worth {formatMaybeCurrency(projectedNetWorth)}</span>
                  <span className="inline-pill">Cash {formatMaybeCurrency(projectedCash)}</span>
                </div>
              </>
            ) : (
              <div className="callout">
                <strong>Add balances to project future snapshots.</strong>
              </div>
            )}
          </Card>
          <Card title="Assumptions summary">
            {assumptionNotes.map((item) => (
              <div key={item.label} className="table-row">
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
            ))}
          </Card>
        </div>
      )
    }
  ];

  const settingsTabs = [
    {
      id: "accounts",
      label: "Accounts & Sources",
      hint: "Sync + manual",
      content: (
        <Card title="Accounts" action={<span className={saveMeta.className}>{saveMeta.label}</span>}>
          <div className="account-grid account-grid__header">
            <span>Account</span>
            <span>Type</span>
            <span>Bucket</span>
            <span>Balance</span>
            <span />
          </div>
          {manualData.accounts.length === 0 ? (
            <p className="muted">No accounts yet.</p>
          ) : (
            manualData.accounts.map((account) => (
              <div key={account.id} className="account-grid account-grid__row">
                <input
                  className="input"
                  value={account.name}
                  onChange={(event) => updateAccount(account.id, { name: event.target.value })}
                />
                <select
                  className="input"
                  value={account.type}
                  onChange={(event) => updateAccount(account.id, { type: event.target.value as AccountType })}
                >
                  {accountTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={account.bucket}
                  onChange={(event) => updateAccount(account.id, { bucket: event.target.value as SavingsBucket })}
                >
                  {bucketOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={account.balance}
                  onChange={(event) => updateAccount(account.id, { balance: parseAmount(event.target.value) })}
                />
                <button type="button" className="button ghost" onClick={() => removeAccount(account.id)}>
                  Remove
                </button>
              </div>
            ))
          )}
          <div className="divider" />
          <div className="account-grid account-grid__row">
            <input
              className="input"
              placeholder="Account"
              value={newAccount.name}
              onChange={(event) => setNewAccount((prev) => ({ ...prev, name: event.target.value }))}
            />
            <select
              className="input"
              value={newAccount.type}
              onChange={(event) => setNewAccount((prev) => ({ ...prev, type: event.target.value as AccountType }))}
            >
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={newAccount.bucket}
              onChange={(event) => setNewAccount((prev) => ({ ...prev, bucket: event.target.value as SavingsBucket }))}
            >
              {bucketOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="0"
              value={newAccount.balance}
              onChange={(event) => setNewAccount((prev) => ({ ...prev, balance: parseAmount(event.target.value) }))}
            />
            <button type="button" className="button" onClick={addAccount}>
              Add
            </button>
          </div>
        </Card>
      )
    },
    {
      id: "income",
      label: "Income",
      hint: "Sources + cadence",
      content: (
        <Card title="Income">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="income-expected">Expected monthly</label>
              <input
                id="income-expected"
                className="input"
                type="number"
                step="0.01"
                value={manualData.income.expectedMonthly}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    income: { ...prev.income, expectedMonthly: parseAmount(event.target.value) }
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="income-frequency">Frequency</label>
              <select
                id="income-frequency"
                className="input"
                value={manualData.income.frequency}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    income: { ...prev.income, frequency: event.target.value as ManualIncome["frequency"] }
                  }))
                }
              >
                <option value="">Select</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
        </Card>
      )
    },
    {
      id: "savings",
      label: "Savings Rules",
      hint: "Targets + buckets",
      content: (
        <Card title="Savings Rules">
          <div className="field">
            <label htmlFor="target-rate">Target savings rate (%)</label>
            <input
              id="target-rate"
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={manualData.savingsTargetRate}
              onChange={(event) =>
                setManualData((prev) => ({ ...prev, savingsTargetRate: parseAmount(event.target.value) }))
              }
            />
          </div>
          {savingsTarget !== null ? (
            <div className="table-row">
              <strong>Goal</strong>
              <span>{formatCurrency(savingsTarget)}</span>
            </div>
          ) : null}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="goal-emergency">Emergency target</label>
              <input
                id="goal-emergency"
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={manualData.goals.emergencyTarget}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    goals: { ...prev.goals, emergencyTarget: parseAmount(event.target.value) }
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="goal-trip">Trip target</label>
              <input
                id="goal-trip"
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={manualData.goals.tripTarget}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    goals: { ...prev.goals, tripTarget: parseAmount(event.target.value) }
                  }))
                }
              />
            </div>
          </div>
        </Card>
      )
    },
    {
      id: "categorisation",
      label: "Categorisation",
      hint: "Rules + priority",
      content: (
        <Card
          title="Category Rules"
          action={
            <div className="chip-row">
              <button type="button" className="chip-button" onClick={saveCategoryRules} disabled={isDemo}>
                {categorySaveLabel}
              </button>
              <button type="button" className="chip-button" onClick={reapplyCategoryRules} disabled={isDemo}>
                Reapply
              </button>
            </div>
          }
        >
          <div className="rule-grid rule-grid__header">
            <span>Pattern</span>
            <span>Field</span>
            <span>Category</span>
            <span>Type</span>
            <span>Priority</span>
            <span>Amount</span>
            <span>Off</span>
            <span />
          </div>
          {categoryRules.length === 0 ? (
            <p className="muted">No rules yet.</p>
          ) : (
            categoryRules.map((rule) => (
              <div key={rule.localId} className="rule-grid rule-grid__row">
                <input
                  className="input"
                  value={rule.pattern}
                  onChange={(event) => updateCategoryRule(rule.localId, { pattern: event.target.value })}
                />
                <select
                  className="input"
                  value={rule.field}
                  onChange={(event) =>
                    updateCategoryRule(rule.localId, {
                      field: event.target.value === "description_raw" ? "description_raw" : "merchant_normalised"
                    })
                  }
                >
                  <option value="merchant_normalised">Merchant</option>
                  <option value="description_raw">Description</option>
                </select>
                <input
                  className="input"
                  value={rule.category}
                  onChange={(event) => updateCategoryRule(rule.localId, { category: event.target.value })}
                />
                <input
                  className="input"
                  value={rule.categoryType}
                  onChange={(event) => updateCategoryRule(rule.localId, { categoryType: event.target.value })}
                />
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={rule.priority}
                  onChange={(event) => updateCategoryRule(rule.localId, { priority: parseAmount(event.target.value) })}
                />
                <input
                  className="input"
                  value={rule.amountCondition}
                  onChange={(event) => updateCategoryRule(rule.localId, { amountCondition: event.target.value })}
                />
                <input
                  className="input checkbox"
                  type="checkbox"
                  checked={rule.isDisabled}
                  onChange={(event) => updateCategoryRule(rule.localId, { isDisabled: event.target.checked })}
                />
                <button type="button" className="button ghost" onClick={() => removeCategoryRule(rule.localId)}>
                  Remove
                </button>
              </div>
            ))
          )}
          <div className="divider" />
          <button type="button" className="button" onClick={addCategoryRule}>
            Add rule
          </button>
          {categoryError ? <p className="muted small">{categoryError}</p> : null}
        </Card>
      )
    },
    {
      id: "spending-structure",
      label: "Spending Structure",
      hint: "Fixed vs discretionary",
      content: (
        <Card title="Spending Structure">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="budget-month-start">Month start day</label>
              <input
                id="budget-month-start"
                className="input"
                type="number"
                min="1"
                max="28"
                value={manualData.budget.monthStart}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    budget: { ...prev.budget, monthStart: parseAmount(event.target.value) }
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="budget-buffer">Buffer (%)</label>
              <input
                id="budget-buffer"
                className="input"
                type="number"
                min="0"
                step="0.1"
                value={manualData.budget.bufferPct}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    budget: { ...prev.budget, bufferPct: parseAmount(event.target.value) }
                  }))
                }
              />
            </div>
          </div>
        </Card>
      )
    },
    {
      id: "preferences",
      label: "Preferences",
      hint: "Currency + timezone",
      content: (
        <Card title="Preferences">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="pref-currency">Currency</label>
              <input
                id="pref-currency"
                className="input"
                value={manualData.preferences.currency}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, currency: event.target.value }
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="pref-timezone">Timezone</label>
              <input
                id="pref-timezone"
                className="input"
                value={manualData.preferences.timezone}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, timezone: event.target.value }
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="pref-horizon">Projection horizon (months)</label>
              <input
                id="pref-horizon"
                className="input"
                type="number"
                min="1"
                value={manualData.preferences.horizonMonths}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, horizonMonths: parseAmount(event.target.value) }
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="pref-rounding">Rounding (decimals)</label>
              <input
                id="pref-rounding"
                className="input"
                type="number"
                min="0"
                max="4"
                value={manualData.preferences.rounding}
                onChange={(event) =>
                  setManualData((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, rounding: parseAmount(event.target.value) }
                  }))
                }
              />
            </div>
          </div>
        </Card>
      )
    }
  ];

  const dataTabs = [
    {
      id: "transactions",
      label: "Transactions",
      hint: "Filters + edits",
      content: (
        <Card title="Transactions">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.date).toLocaleDateString()}</td>
                    <td>{tx.merchantName || tx.descriptionRaw}</td>
                    <td>{tx.accountName}</td>
                    <td>{tx.category || "Uncategorised"}</td>
                    <td className={tx.amount < 0 ? "negative" : "positive"}>
                      {formatCurrency(tx.amount, { sign: true })}
                    </td>
                    <td>{tx.balance == null ? "—" : formatCurrency(tx.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )
    },
    {
      id: "imports",
      label: "Imports & Logs",
      hint: "Errors + retries",
      content: (
        <Card title="Imports & Logs">
          <div className="callout">
            <strong>{latest.length} transactions synced</strong>
            <p className="muted small">Last update: {latestActivityLabel}</p>
          </div>
        </Card>
      )
    },
    {
      id: "export",
      label: "Export",
      hint: "CSV + JSON",
      content: (
        <Card title="Export">
          <div className="chip-row">
            <button type="button" className="chip-button">
              Export CSV
            </button>
            <button type="button" className="chip-button">
              Export JSON
            </button>
            <button type="button" className="chip-button">
              Snapshot (monthly)
            </button>
          </div>
        </Card>
      )
    }
  ];

  const pageTabs =
    page === "dashboard" ? dashboardTabs : page === "planning" ? planningTabs : page === "settings" ? settingsTabs : dataTabs;

  const currentTab = pageTabs.find((tab) => tab.id === activeTab) ?? pageTabs[0];

  return (
    <div className="tabs">
      <div className="tab-list" role="tablist" aria-label="Page sections">
        {pageTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={currentTab?.id === tab.id}
            aria-controls={`${tab.id}-panel`}
            className={`tab-button${currentTab?.id === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <span className="tab-hint">{tab.hint}</span>
          </button>
        ))}
      </div>
      <div id={`${currentTab?.id}-panel`} role="tabpanel" className="tab-panel">
        {currentTab?.content}
      </div>
    </div>
  );
}
