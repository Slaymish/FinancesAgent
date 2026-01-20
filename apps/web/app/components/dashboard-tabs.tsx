"use client";

import { useMemo, useState } from "react";
import { Card, Badge } from "./ui";
import { SparkBars, SparkLine } from "./charts";
import { formatCurrency, formatNumber } from "../lib/format";

type MonthlyNet = { month: string; income: number; expense: number; net: number };
type CategorySpend = { category: string; amount: number; categoryType: string };
type Transaction = {
  id: string;
  date: string;
  accountName: string;
  amount: number;
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
};

type ScenarioId = "steady" | "save-5" | "spend-5" | "income-up";

const tabs = [
  { id: "overview", label: "Overview", hint: "10-second read" },
  { id: "spending", label: "Spending", hint: "Diagnostics" },
  { id: "saving", label: "Saving & Wealth", hint: "Momentum" },
  { id: "planning", label: "Planning", hint: "Outlook" },
  { id: "history", label: "History", hint: "Power user" }
] as const;

function formatMonthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short" });
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

function buildCategoryTrend(amount: number, months: MonthlyNet[]) {
  if (months.length === 0) return [];
  const base = Math.abs(amount) / months.length;
  return months.map((month, index) => {
    const wave = 0.12 * Math.sin(index * 1.4);
    const drift = index % 2 === 0 ? 0.04 : -0.03;
    return { label: month.month, value: Math.max(0, base * (1 + wave + drift)) };
  });
}

export function DashboardTabs({ totals, byType, monthlyNet, topCategories, latest }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("overview");
  const [selectedCategory, setSelectedCategory] = useState(topCategories[0]?.category ?? "");
  const [showTransactions, setShowTransactions] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("steady");

  const last12 = useMemo(() => monthlyNet.slice(-12), [monthlyNet]);
  const last6 = useMemo(() => monthlyNet.slice(-6), [monthlyNet]);
  const last3 = useMemo(() => monthlyNet.slice(-3), [monthlyNet]);

  const startNetWorth = Math.max(25000, Math.round(totals.income30 * 8));
  const netWorthSeries = useMemo(() => {
    let running = startNetWorth;
    return last12.map((month) => {
      running += month.net;
      return { label: month.month, value: running };
    });
  }, [last12, startNetWorth]);

  const netWorthNow = netWorthSeries[netWorthSeries.length - 1]?.value ?? startNetWorth;
  const avgExpense = Math.max(1, average(last3.map((month) => month.expense)));
  const cashBalance = Math.max(3000, netWorthNow * 0.22);
  const runwayMonths = cashBalance / avgExpense;
  const runwayTone = runwayMonths >= 6 ? "positive" : runwayMonths >= 3 ? "warn" : "negative";

  const rollingIncome = last3.reduce((sum, item) => sum + item.income, 0);
  const rollingSavings = last3.reduce((sum, item) => sum + item.net, 0);
  const savingsRate = rollingIncome > 0 ? (rollingSavings / rollingIncome) * 100 : 0;

  const savingsTarget = totals.income30 * 0.15;
  const safeToSpend = totals.income30 - totals.expense30 - savingsTarget;
  const safeTone = safeToSpend >= 0 ? "positive" : "negative";

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
  const categoryTrend = selectedCategoryData ? buildCategoryTrend(selectedCategoryData.amount, last6) : [];

  const savingsPool = Math.max(0, byType.saving ?? 0, totals.net30 * 0.2);
  const savingsAllocation = [
    { label: "Emergency", amount: savingsPool * 0.45 },
    { label: "Investments", amount: savingsPool * 0.4 },
    { label: "Medium-term", amount: savingsPool * 0.15 }
  ];
  const savingsMax = Math.max(1, ...savingsAllocation.map((item) => item.amount));

  const netWorthAssets = Math.max(netWorthNow, 0);
  const netWorthBreakdown = [
    { label: "Cash", amount: netWorthAssets * 0.28 },
    { label: "Investments", amount: netWorthAssets * 0.52 },
    { label: "Other assets", amount: netWorthAssets * 0.2 },
    { label: "Liabilities", amount: -netWorthAssets * 0.18 }
  ];

  const netWorthChange = netWorthSeries.length >= 2 ? netWorthNow - netWorthSeries[0].value : 0;
  const avgMonthlySavings = average(last6.map((item) => item.net));
  const contributionTotal = avgMonthlySavings * last6.length;
  const growthTotal = netWorthChange - contributionTotal;

  const baseIncome = average(last6.map((item) => item.income));
  const baseExpense = average(last6.map((item) => item.expense));
  const scenarioIncome = scenario === "income-up" ? baseIncome * 1.05 : baseIncome;
  const scenarioExpense =
    scenario === "spend-5" ? baseExpense * 1.05 : scenario === "save-5" ? baseExpense * 0.95 : baseExpense;
  const scenarioNet = scenarioIncome - scenarioExpense;

  const projectionBaseMonth = last6[last6.length - 1]?.month ?? "2024-01";
  const projectionSeries = Array.from({ length: 6 }, (_, index) => {
    const label = addMonths(projectionBaseMonth, index + 1);
    const projectedValue = netWorthNow + scenarioNet * (index + 1);
    return { label, value: projectedValue };
  });
  const projectedNetWorth = projectionSeries[projectionSeries.length - 1]?.value ?? netWorthNow;
  const projectedCash = cashBalance + scenarioNet * 2;

  const upcomingExpenses = [
    {
      label: "Rent",
      date: "Next month",
      amount: baseExpense * 0.35
    },
    {
      label: "Insurance",
      date: "In 2 months",
      amount: baseExpense * 0.12
    },
    {
      label: "Trip fund",
      date: "In 4 months",
      amount: baseExpense * 0.22
    }
  ];

  const emergencyTarget = baseExpense * 6;
  const emergencyProgress = emergencyTarget > 0 ? Math.min(1, cashBalance / emergencyTarget) : 0;
  const tripTarget = 3200;
  const tripSaved = savingsPool * 0.3;
  const tripProgress = tripTarget > 0 ? Math.min(1, tripSaved / tripTarget) : 0;

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
              <Card title="Net worth over time" subtitle="Last 12 months">
                <SparkLine data={netWorthSeries.map((item) => ({ value: item.value }))} />
                <div className="chart-legend">
                  {netWorthSeries.slice(-3).map((item) => (
                    <div key={item.label} className="pill muted">
                      <span className="section-title">{item.label}</span>
                      <span>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <Card title="Cash runway" subtitle="Estimated months of buffer">
              <div className={`big-number ${runwayTone}`}>
                {formatNumber(runwayMonths, 1)}
                <span className="big-number__unit">months</span>
              </div>
              <p className="muted small">Based on recent monthly outflows.</p>
            </Card>
            <Card title="Savings rate" subtitle="Rolling 3-month">
              <div className="big-number neutral">
                {formatNumber(savingsRate, 1)}%
                <span className="big-number__unit">of income</span>
              </div>
              <p className="muted small">Net income retained after expenses.</p>
            </Card>
            <Card title="Safe to spend this month" subtitle="After baseline savings">
              <div className={`big-number ${safeTone}`}>
                {formatCurrency(safeToSpend)}
                <span className="big-number__unit">buffer</span>
              </div>
              <Badge tone={safeTone}>{safeToSpend >= 0 ? "On track" : "Tight month"}</Badge>
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
            <Card title="Category drill-down" subtitle="Select a category">
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
                <SparkBars
                  data={categoryTrend.map((item) => ({ label: item.label, value: item.value }))}
                  height={110}
                  renderLabel={(value) => formatCurrency(value)}
                />
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
            <Card title="Savings allocation" subtitle="Where the buffer is going">
              <div className="bar-list">
                {savingsAllocation.map((item) => (
                  <div key={item.label} className="bar-list__row">
                    <div className="bar-list__label">
                      <span>{item.label}</span>
                      <span className="muted small">{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="bar-list__track">
                      <div
                        className="bar-list__bar"
                        style={{
                          width: `${(item.amount / savingsMax) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Net worth breakdown" subtitle="Structure, not perfection">
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
                          width: `${(Math.abs(item.amount) / Math.max(1, netWorthAssets)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Contributions vs growth" subtitle="Investing momentum">
              <div className="split-meter">
                <div
                  className="split-meter__segment fixed"
                  style={{
                    width: `${(Math.abs(contributionTotal) / Math.max(1, Math.abs(contributionTotal) + Math.abs(growthTotal))) * 100}%`
                  }}
                />
                <div
                  className="split-meter__segment discretionary"
                  style={{
                    width: `${(Math.abs(growthTotal) / Math.max(1, Math.abs(contributionTotal) + Math.abs(growthTotal))) * 100}%`
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
                  <div>{formatCurrency(growthTotal)}</div>
                </div>
              </div>
              <p className="muted small">Keeps the focus on compounding, not guilt.</p>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "planning" && (
        <div id="planning-panel" role="tabpanel" className="tab-panel">
          <div className="dashboard-grid cols-2">
            <Card title="Upcoming known expenses" subtitle="Next 3-6 months">
              <div className="change-list">
                {upcomingExpenses.map((item) => (
                  <div key={item.label} className="change-item">
                    <div className="glance-title-row">
                      <span className="glance-title">{item.label}</span>
                      <Badge tone="neutral">{item.date}</Badge>
                    </div>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Projection if nothing changes" subtitle="Net worth + cash outlook">
              <SparkLine data={projectionSeries.map((item) => ({ value: item.value }))} />
              <div className="chart-legend">
                <div className="pill muted">
                  <span className="section-title">Net worth (6 months)</span>
                  <span>{formatCurrency(projectedNetWorth)}</span>
                </div>
                <div className="pill muted">
                  <span className="section-title">Cash (2 months)</span>
                  <span>{formatCurrency(projectedCash)}</span>
                </div>
              </div>
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
            <Card title="Goal trackers" subtitle="Permission to relax">
              <div className="goal-stack">
                <div>
                  <div className="goal-row">
                    <span>Emergency fund</span>
                    <span className="muted small">
                      {formatCurrency(cashBalance)} / {formatCurrency(emergencyTarget)}
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
                      {formatCurrency(tripSaved)} / {formatCurrency(tripTarget)}
                    </span>
                  </div>
                  <div className="progress">
                    <div className="progress__bar alt" style={{ width: `${tripProgress * 100}%` }} />
                  </div>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
            <Card title="Data sources & sync status" subtitle="Trust layer">
              <div className="stack">
                <div className="pill muted">Bank feed · Healthy · 2 hours ago</div>
                <div className="pill muted">Card feed · Healthy · Yesterday</div>
                <div className="pill muted">Manual uploads · No issues</div>
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
