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

type DashboardTabsProps = {
  totals: { income30: number; expense30: number; net30: number };
  byType: Record<string, number>;
  monthlyNet: MonthlyNet[];
  topCategories: CategorySpend[];
  latest: Transaction[];
  isDemo: boolean;
  initialManualData: ManualData | null;
};

type ScenarioId = "steady" | "save-5" | "spend-5" | "income-up";
type AccountType = "unclassified" | "cash" | "savings" | "investments" | "other" | "liability";
type SavingsBucket = "" | "emergency" | "investments" | "medium-term";

type ManualAccount = {
  id: string;
  name: string;
  type: AccountType;
  bucket: SavingsBucket;
  balance: number | "";
};

type UpcomingExpense = {
  id: string;
  label: string;
  month: string;
  amount: number | "";
};

type ManualGoals = {
  emergencyTarget: number | "";
  tripTarget: number | "";
};

type ManualData = {
  accounts: ManualAccount[];
  upcomingExpenses: UpcomingExpense[];
  savingsTargetRate: number | "";
  goals: ManualGoals;
};

const tabs = [
  { id: "overview", label: "Overview", hint: "10-second read" },
  { id: "spending", label: "Spending", hint: "Diagnostics" },
  { id: "saving", label: "Saving & Wealth", hint: "Momentum" },
  { id: "planning", label: "Planning", hint: "Outlook" },
  { id: "history", label: "History", hint: "Power user" }
] as const;

const emptyManualData: ManualData = {
  accounts: [],
  upcomingExpenses: [],
  savingsTargetRate: "",
  goals: { emergencyTarget: "", tripTarget: "" }
};

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
    goals: { ...emptyManualData.goals, ...(value.goals ?? {}) }
  };
}

export function DashboardTabs({
  totals,
  byType,
  monthlyNet,
  topCategories,
  latest,
  isDemo,
  initialManualData
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("overview");
  const [selectedCategory, setSelectedCategory] = useState(topCategories[0]?.category ?? "");
  const [showTransactions, setShowTransactions] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("steady");
  const [manualData, setManualData] = useState<ManualData>(() => normalizeManualData(initialManualData));
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

  const latestByAccount = useMemo(() => {
    const map = new Map<string, Transaction>();
    latest.forEach((tx) => {
      if (!tx.accountName) return;
      const existing = map.get(tx.accountName);
      if (!existing || new Date(tx.date).getTime() > new Date(existing.date).getTime()) {
        map.set(tx.accountName, tx);
      }
    });
    return map;
  }, [latest]);

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

  const selectedCategoryData = topCategories.find((item) => item.category === selectedCategory) ?? categoryList[0];

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
  const hasAllocation = allocationList.some((item) => item.amount !== 0);

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
  const netWorthChange =
    firstNetWorth && lastNetWorth ? lastNetWorth.value - firstNetWorth.value : null;
  const contributionTotal = last12.reduce((sum, item) => sum + item.net, 0);
  const growthTotal = netWorthChange !== null ? netWorthChange - contributionTotal : null;

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

  return (
    <div className="tabs">
      <div className="tab-list" role="tablist" aria-label="Dashboard sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            className={`tab-button${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <span className="tab-hint">{tab.hint}</span>
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div id="overview-panel" role="tabpanel" className="tab-panel">
          <div className="dashboard-grid cols-3">
            <div className="span-2">
              <Card title="Net worth over time" subtitle="Based on your balances + cashflow">
                {netWorthSeries.length > 0 ? (
                  <>
                    <SparkLine data={netWorthSeries.map((item) => ({ value: item.value }))} />
                    <div className="chart-legend">
                      {netWorthSeries.slice(-3).map((item) => (
                        <div key={item.label} className="pill muted">
                          <span className="section-title">{item.label}</span>
                          <span>{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="callout">
                    <strong>Add balances to unlock net worth</strong>
                    <p className="muted small">Enter account balances in the History tab to avoid placeholders.</p>
                  </div>
                )}
              </Card>
            </div>
            <Card title="Cash runway" subtitle="Estimated months of buffer">
              {runwayMonths === null ? (
                <div className="callout">
                  <strong>Cash balances missing</strong>
                  <p className="muted small">Add cash or savings balances to calculate runway.</p>
                </div>
              ) : (
                <>
                  <div className={`big-number ${runwayTone}`}>
                    {formatNumber(runwayMonths, 1)}
                    <span className="big-number__unit">months</span>
                  </div>
                  <p className="muted small">Based on recent monthly outflows.</p>
                </>
              )}
            </Card>
            <Card title="Savings rate" subtitle="Rolling 3-month">
              <div className="big-number neutral">
                {formatNumber(savingsRate, 1)}%
                <span className="big-number__unit">of income</span>
              </div>
              <p className="muted small">Net income retained after expenses.</p>
            </Card>
            <Card title="Safe to spend this month" subtitle="After your savings target">
              {safeToSpend === null ? (
                <div className="callout">
                  <strong>Set a savings target</strong>
                  <p className="muted small">Add a target percentage to unlock safe-to-spend.</p>
                </div>
              ) : (
                <>
                  <div className={`big-number ${safeTone}`}>
                    {formatCurrency(safeToSpend)}
                    <span className="big-number__unit">buffer</span>
                  </div>
                  <Badge tone={safeTone}>{safeToSpend >= 0 ? "On track" : "Tight month"}</Badge>
                </>
              )}
              <div className="field compact">
                <label htmlFor="savings-target">Savings target (%)</label>
                <input
                  id="savings-target"
                  className="input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={manualData.savingsTargetRate}
                  onChange={(event) =>
                    setManualData((prev) => ({ ...prev, savingsTargetRate: parseAmount(event.target.value) }))
                  }
                />
              </div>
            </Card>
            <div className="span-2">
              <Card title="Income vs spending" subtitle="Last 6 months">
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
                      <span className="comparison-bars__value">
                        {formatCurrency(item.income - item.spend, { sign: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {activeTab === "spending" && (
        <div id="spending-panel" role="tabpanel" className="tab-panel">
          <div className="dashboard-grid cols-2">
            <Card title="Monthly spending trend" subtitle="Last 6 months">
              <SparkBars data={spendingTrend.map((item) => ({ label: item.label, value: item.value }))} />
            </Card>
            <Card title="Top 5 categories" subtitle="Where money is going">
              <div className="bar-list">
                {categoryList.length === 0 ? (
                  <p className="muted">No spending data yet.</p>
                ) : (
                  categoryList.map((item) => (
                    <div key={item.category} className="bar-list__row">
                      <div className="bar-list__label">
                        <span>{item.category}</span>
                        <span className="muted small">{formatCurrency(-item.amount)}</span>
                      </div>
                      <div className="bar-list__track">
                        <div
                          className="bar-list__bar"
                          style={{
                            width: `${(Math.abs(item.amount) / categoryMax) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
            <Card title="Fixed vs discretionary" subtitle="Last 30 days">
              <div className="split-meter">
                <div className="split-meter__segment fixed" style={{ width: `${fixedPct}%` }} />
                <div className="split-meter__segment discretionary" style={{ width: `${100 - fixedPct}%` }} />
              </div>
              <div className="split-labels">
                <div>
                  <div className="section-title">Fixed</div>
                  <div>{formatCurrency(-fixedSpend)}</div>
                </div>
                <div>
                  <div className="section-title">Discretionary</div>
                  <div>{formatCurrency(-discretionarySpend)}</div>
                </div>
              </div>
              <p className="muted small">Essentials vs wants to show flexibility.</p>
            </Card>
            <Card title="Category drill-down" subtitle="Monthly trend when available">
              <div className="chip-row">
                {categoryList.map((item) => (
                  <button
                    key={item.category}
                    type="button"
                    className={`chip-button${selectedCategory === item.category ? " is-active" : ""}`}
                    onClick={() => setSelectedCategory(item.category)}
                  >
                    {item.category}
                  </button>
                ))}
              </div>
              {selectedCategoryData ? (
                <div className="callout">
                  <strong>Category trend data not available yet</strong>
                  <p className="muted small">Connect monthly category history to unlock this view.</p>
                </div>
              ) : (
                <p className="muted">Pick a category to see the monthly trend.</p>
              )}
            </Card>
            <div className="span-2">
              <Card
                title="Transactions"
                subtitle="Hidden by default"
                action={
                  <button type="button" className="button ghost" onClick={() => setShowTransactions((prev) => !prev)}>
                    {showTransactions ? "Hide table" : "Show table"}
                  </button>
                }
              >
                {showTransactions ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Merchant</th>
                          <th>Category</th>
                          <th>Date</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latest.slice(0, 8).map((tx) => (
                          <tr key={tx.id}>
                            <td>{tx.merchantName || tx.descriptionRaw}</td>
                            <td>{tx.category || "Uncategorised"}</td>
                            <td>{new Date(tx.date).toLocaleDateString()}</td>
                            <td className={tx.amount < 0 ? "negative" : "positive"}>
                              {formatCurrency(tx.amount, { sign: true })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Reveal the full table when you need to audit.</p>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {activeTab === "saving" && (
        <div id="saving-panel" role="tabpanel" className="tab-panel">
          <div className="dashboard-grid cols-2">
            <Card title="Savings over time" subtitle="Absolute + % of income">
              <SparkLine data={last12.map((item) => ({ value: item.net }))} />
              <div className="chart-legend">
                {last3.map((item) => (
                  <div key={item.month} className="pill muted">
                    <span className="section-title">{formatMonthLabel(item.month)}</span>
                    <span>
                      {formatCurrency(item.net)} · {formatNumber((item.net / Math.max(1, item.income)) * 100, 1)}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Savings allocation" subtitle="Manual buckets">
              {hasAllocation ? (
                <div className="bar-list">
                  {allocationList.map((item) => (
                    <div key={item.label} className="bar-list__row">
                      <div className="bar-list__label">
                        <span>{item.label}</span>
                        <span className="muted small">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="bar-list__track">
                        <div
                          className="bar-list__bar"
                          style={{
                            width: `${(Math.abs(item.amount) / allocationMax) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="callout">
                  <strong>No savings buckets yet</strong>
                  <p className="muted small">Assign buckets to savings accounts in History.</p>
                </div>
              )}
            </Card>
            <Card title="Net worth breakdown" subtitle="Based on account balances">
              {hasBalances ? (
                <div className="bar-list">
                  {netWorthBreakdown.map((item) => (
                    <div key={item.label} className="bar-list__row">
                      <div className="bar-list__label">
                        <span>{item.label}</span>
                        <span className="muted small">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="bar-list__track">
                        <div
                          className={`bar-list__bar${item.amount < 0 ? " negative" : ""}`}
                          style={{
                            width: `${(Math.abs(item.amount) / Math.max(1, Math.abs(netWorthNow ?? 0))) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="callout">
                  <strong>Add balances to see structure</strong>
                  <p className="muted small">Balances are manual until account data is available.</p>
                </div>
              )}
            </Card>
            <Card title="Contributions vs growth" subtitle="Derived from balances">
              {netWorthChange === null ? (
                <div className="callout">
                  <strong>Need balances for growth</strong>
                  <p className="muted small">Add account balances to compare contributions vs growth.</p>
                </div>
              ) : (
                <>
                  <div className="split-meter">
                    <div
                      className="split-meter__segment fixed"
                      style={{
                        width: `${(Math.abs(contributionTotal) / Math.max(1, Math.abs(contributionTotal) + Math.abs(growthTotal ?? 0))) * 100}%`
                      }}
                    />
                    <div
                      className="split-meter__segment discretionary"
                      style={{
                        width: `${(Math.abs(growthTotal ?? 0) / Math.max(1, Math.abs(contributionTotal) + Math.abs(growthTotal ?? 0))) * 100}%`
                      }}
                    />
                  </div>
                  <div className="split-labels">
                    <div>
                      <div className="section-title">Contributions</div>
                      <div>{formatCurrency(contributionTotal)}</div>
                    </div>
                    <div>
                      <div className="section-title">Growth</div>
                      <div>{formatMaybeCurrency(growthTotal)}</div>
                    </div>
                  </div>
                  <p className="muted small">Growth reflects the gap between balances and net cashflow.</p>
                </>
              )}
            </Card>
          </div>
        </div>
      )}

      {activeTab === "planning" && (
        <div id="planning-panel" role="tabpanel" className="tab-panel">
          <div className="dashboard-grid cols-2">
            <Card title="Upcoming known expenses" subtitle="Next 3-6 months">
              <div className="stack">
                {manualData.upcomingExpenses.length === 0 ? (
                  <p className="muted">Add upcoming expenses to reduce surprises.</p>
                ) : (
                  manualData.upcomingExpenses.map((item) => (
                    <div key={item.id} className="change-item">
                      <div className="glance-title-row">
                        <span className="glance-title">{item.label}</span>
                        <Badge tone="neutral">{formatMonthLong(item.month)}</Badge>
                      </div>
                      <div className="row-between">
                        <strong>{typeof item.amount === "number" ? formatCurrency(item.amount) : "—"}</strong>
                        <button type="button" className="button ghost" onClick={() => removeExpense(item.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="divider" />
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
                Add expense
              </button>
            </Card>
            <Card title="Projection if nothing changes" subtitle="Net worth + cash outlook">
              {projectionSeries.length > 0 ? (
                <>
                  <SparkLine data={projectionSeries.map((item) => ({ value: item.value }))} />
                  <div className="chart-legend">
                    <div className="pill muted">
                      <span className="section-title">Net worth (6 months)</span>
                      <span>{formatMaybeCurrency(projectedNetWorth)}</span>
                    </div>
                    <div className="pill muted">
                      <span className="section-title">Cash (2 months)</span>
                      <span>{formatMaybeCurrency(projectedCash)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="callout">
                  <strong>Add balances to project</strong>
                  <p className="muted small">Projections need current account balances.</p>
                </div>
              )}
            </Card>
            <Card title="Scenario toggles" subtitle="Optional adjustments">
              <div className="chip-row">
                {[
                  { id: "steady", label: "No change" },
                  { id: "save-5", label: "Save +5%" },
                  { id: "spend-5", label: "Spend +5%" },
                  { id: "income-up", label: "Income +5%" }
                ].map((option) => (
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
              <p className="muted small">Lightweight what-if scenarios to reduce anxiety.</p>
            </Card>
            <Card title="Goal trackers" subtitle="Manual targets">
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
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div id="history-panel" role="tabpanel" className="tab-panel">
          <div className="dashboard-grid cols-2">
            <div className="span-2">
              <Card
                title="Transaction history"
                subtitle="Full detail for trust and audits"
                action={
                  <div className="chip-row">
                    <button type="button" className="chip-button">
                      Export CSV
                    </button>
                    <button type="button" className="chip-button">
                      Filters
                    </button>
                  </div>
                }
              >
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
            </div>
            <Card
              title="Account balances"
              subtitle="Manual until feeds include balances"
              action={<span className={saveMeta.className}>{saveMeta.label}</span>}
            >
              <div className="stack">
                {manualData.accounts.length === 0 ? (
                  <p className="muted">No accounts yet. Add one below.</p>
                ) : (
                  manualData.accounts.map((account) => {
                    const latestTx = latestByAccount.get(account.name);
                    return (
                      <div key={account.id} className="balance-row">
                        <div>
                          <div className="category-name">{account.name}</div>
                          <div className="muted small">
                            Latest:{" "}
                            {latestTx
                              ? `${new Date(latestTx.date).toLocaleDateString()} · ${latestTx.merchantName || latestTx.descriptionRaw}`
                              : "—"}
                          </div>
                          <div className="muted small">
                            Last known balance: {latestTx?.balance == null ? "—" : formatCurrency(latestTx.balance)}
                          </div>
                        </div>
                        <div className="balance-controls">
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
                            onChange={(event) =>
                              updateAccount(account.id, { bucket: event.target.value as SavingsBucket })
                            }
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
                            placeholder="Balance"
                            value={account.balance}
                            onChange={(event) => updateAccount(account.id, { balance: parseAmount(event.target.value) })}
                          />
                          <button type="button" className="button ghost" onClick={() => removeAccount(account.id)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="divider" />
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="account-name">Account</label>
                  <input
                    id="account-name"
                    className="input"
                    value={newAccount.name}
                    onChange={(event) => setNewAccount((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="account-type">Type</label>
                  <select
                    id="account-type"
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
                </div>
                <div className="field">
                  <label htmlFor="account-bucket">Bucket</label>
                  <select
                    id="account-bucket"
                    className="input"
                    value={newAccount.bucket}
                    onChange={(event) =>
                      setNewAccount((prev) => ({ ...prev, bucket: event.target.value as SavingsBucket }))
                    }
                  >
                    {bucketOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="account-balance">Balance</label>
                  <input
                    id="account-balance"
                    className="input"
                    type="number"
                    step="0.01"
                    value={newAccount.balance}
                    onChange={(event) => setNewAccount((prev) => ({ ...prev, balance: parseAmount(event.target.value) }))}
                  />
                </div>
              </div>
              <button type="button" className="button" onClick={addAccount}>
                Add account
              </button>
            </Card>
            <Card title="Data sources & sync status" subtitle="Trust layer">
              <div className="callout">
                <strong>Sync status not available yet</strong>
                <p className="muted small">Feed health will appear once providers share balance metadata.</p>
              </div>
            </Card>
            <Card title="Corrections & adjustments" subtitle="Clean up the edges">
              <div className="callout">
                <strong>Manual adjustments ready</strong>
                <p className="muted small">Recode transactions, split merchants, or add notes without noise.</p>
                <button type="button" className="button">
                  Add adjustment
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
