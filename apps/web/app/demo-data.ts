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

export const demoSummary = {
  metricsPack: {
    generatedAt: now.toISOString(),
    ranges: {
      d30: { start: dailySpend30[0].date, end: dailySpend30[dailySpend30.length - 1].date },
      d90: { start: dailySpend30[0].date, end: dailySpend30[dailySpend30.length - 1].date },
      y12: { start: monthlyNet12[0].month + "-01", end: monthlyNet12[monthlyNet12.length - 1].month + "-01" }
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
