const now = new Date();

const dailySpend30 = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
  return {
    date: date.toISOString().slice(0, 10),
    spend: 35 + (i % 6) * 12 + (i % 4 === 0 ? 40 : 0)
  };
});

const monthlyNet12 = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1));
  const income = 4200 + (i % 2) * 120;
  const expense = 3000 + (i % 3) * 180;
  return {
    month: date.toISOString().slice(0, 7),
    income,
    expense,
    net: income - expense
  };
});

const firstDaily = dailySpend30[0] ?? { date: now.toISOString().slice(0, 10), spend: 0 };
const lastDaily = dailySpend30[dailySpend30.length - 1] ?? firstDaily;
const firstMonthly = monthlyNet12[0] ?? { month: now.toISOString().slice(0, 7), income: 0, expense: 0, net: 0 };
const lastMonthly = monthlyNet12[monthlyNet12.length - 1] ?? firstMonthly;

export const demoSummary = {
  metricsPack: {
    generatedAt: now.toISOString(),
    ranges: {
      d30: { start: firstDaily.date, end: lastDaily.date },
      d90: { start: firstDaily.date, end: lastDaily.date },
      y12: { start: `${firstMonthly.month}-01`, end: `${lastMonthly.month}-01` }
    },
    totals: {
      income30: 5400,
      expense30: 3120,
      net30: 2280
    },
    byType30: {
      essential: 1860,
      want: 860,
      saving: 400
    },
    trends: {
      dailySpend30,
      monthlyNet12,
      categorySpend30: [
        { category: "Groceries", amount: 620, categoryType: "essential" },
        { category: "Rent", amount: 1480, categoryType: "essential" },
        { category: "Takeaway", amount: 420, categoryType: "want" },
        { category: "Subscriptions", amount: 160, categoryType: "want" },
        { category: "Investing", amount: 400, categoryType: "saving" }
      ]
    }
  },
  latestTransactions: [
    {
      id: "demo-1",
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      accountName: "Main",
      amount: -68.5,
      merchantName: "New World",
      descriptionRaw: "Card purchase",
      category: "Groceries",
      categoryType: "essential",
      source: "demo"
    },
    {
      id: "demo-2",
      date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      accountName: "Main",
      amount: -24.0,
      merchantName: "Uber Eats",
      descriptionRaw: "Food delivery",
      category: "Takeaway",
      categoryType: "want",
      source: "demo"
    },
    {
      id: "demo-3",
      date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      accountName: "Main",
      amount: 4200,
      merchantName: "Employer Ltd",
      descriptionRaw: "Salary",
      category: "Salary",
      categoryType: "income",
      source: "demo"
    }
  ]
};

export const demoCategories = {
  rules: [
    {
      id: "demo-rule-1",
      pattern: "COUNTDOWN|PAKNSAVE|NEW WORLD",
      field: "merchant_normalised",
      category: "Groceries",
      categoryType: "essential",
      priority: 10,
      amountCondition: null,
      isDisabled: false
    },
    {
      id: "demo-rule-2",
      pattern: "UBER|EATS|DELIVEROO",
      field: "merchant_normalised",
      category: "Takeaway",
      categoryType: "want",
      priority: 20,
      amountCondition: null,
      isDisabled: false
    },
    {
      id: "demo-rule-3",
      pattern: "RENT",
      field: "description_raw",
      category: "Rent",
      categoryType: "essential",
      priority: 5,
      amountCondition: null,
      isDisabled: false
    }
  ]
};

export const demoInsightsLatest = {
  latest: {
    id: "demo-insight-1",
    createdAt: new Date().toISOString(),
    markdown:
      "## Financial synthesis\n- **Cash Flow:** Strong surplus this month (Income $5,400 vs Spend $3,120).\n- **Net Worth:** Assets are growing steadily (Latest estimated total $54,200).\n- **Saving:** Excellent savings rate of 42.2%, well above the 20% baseline.\n- **Wishlist:** Upcoming expenses total $1,250 (Car Service and Sydney Flights); current cash flow comfortably covers these.\n- **Next actions:** Finalise the Sydney flight booking while prices are stable.\n- **Numbers used:** Net Worth 54200; Income 5400; Spend 3120; Savings Rate 42.2.",
    diffFromPrev: null,
    pipelineRunId: "demo-run-1"
  }
};

export const demoInsightsHistory = {
  docs: [
    {
      id: "demo-insight-1",
      createdAt: new Date().toISOString(),
      diffFromPrev: null,
      pipelineRunId: "demo-run-1"
    }
  ]
};
