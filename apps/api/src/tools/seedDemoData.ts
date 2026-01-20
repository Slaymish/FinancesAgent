import { prisma } from "../prisma.js";
import { loadDotenv } from "../dotenv.js";
import { loadEnv } from "../env.js";
import { LEGACY_USER_ID } from "@finance-agent/shared";
import { computeMetricsPack } from "../finance/metrics.js";

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function run() {
  loadDotenv();
  loadEnv();

  const now = new Date();
  const user =
    (await prisma.user.findUnique({ where: { id: LEGACY_USER_ID } })) ??
    (await prisma.user.create({ data: { id: LEGACY_USER_ID, name: "Demo User" } }));

  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId: user.id } }),
    prisma.categoryRule.deleteMany({ where: { userId: user.id } }),
    prisma.pipelineRun.deleteMany({ where: { userId: user.id } })
  ]);

  await prisma.categoryRule.createMany({
    data: [
      {
        userId: user.id,
        pattern: "COUNTDOWN|PAKNSAVE|NEW WORLD",
        field: "merchant_normalised",
        category: "Groceries",
        categoryType: "essential",
        priority: 10
      },
      {
        userId: user.id,
        pattern: "UBER|DOORDASH|DELIVEROO",
        field: "merchant_normalised",
        category: "Takeaway",
        categoryType: "want",
        priority: 20
      },
      {
        userId: user.id,
        pattern: "RENT",
        field: "description_raw",
        category: "Rent",
        categoryType: "essential",
        priority: 5
      },
      {
        userId: user.id,
        pattern: "KIWISAVER|INVEST",
        field: "description_raw",
        category: "Investing",
        categoryType: "saving",
        priority: 15
      }
    ]
  });

  const transactions = [];
  const start = startOfDayUtc(new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000));
  for (let i = 0; i < 120; i += 1) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dateIso = date.toISOString().slice(0, 10);

    if (date.getUTCDate() === 1) {
      transactions.push({
        userId: user.id,
        akahuId: `demo-income-${dateIso}`,
        date,
        accountName: "Main",
        amount: 4200,
        balance: null,
        descriptionRaw: "Salary",
        merchantName: "Employer Ltd",
        category: "Salary",
        categoryType: "income",
        isTransfer: false,
        source: "demo",
        importedAt: now
      });
      transactions.push({
        userId: user.id,
        akahuId: `demo-rent-${dateIso}`,
        date,
        accountName: "Main",
        amount: -1800,
        balance: null,
        descriptionRaw: "Rent",
        merchantName: "Rent",
        category: "Rent",
        categoryType: "essential",
        isTransfer: false,
        source: "demo",
        importedAt: now
      });
    }

    if (date.getUTCDay() === 6) {
      transactions.push({
        userId: user.id,
        akahuId: `demo-grocery-${dateIso}`,
        date,
        accountName: "Main",
        amount: -140 - (i % 5) * 8,
        balance: null,
        descriptionRaw: "Card purchase",
        merchantName: "Countdown",
        category: "Groceries",
        categoryType: "essential",
        isTransfer: false,
        source: "demo",
        importedAt: now
      });
    }

    if (date.getUTCDay() === 4) {
      transactions.push({
        userId: user.id,
        akahuId: `demo-takeaway-${dateIso}`,
        date,
        accountName: "Main",
        amount: -35 - (i % 3) * 5,
        balance: null,
        descriptionRaw: "Uber Eats",
        merchantName: "Uber Eats",
        category: "Takeaway",
        categoryType: "want",
        isTransfer: false,
        source: "demo",
        importedAt: now
      });
    }

    if (date.getUTCDate() === 15) {
      transactions.push({
        userId: user.id,
        akahuId: `demo-invest-${dateIso}`,
        date,
        accountName: "Main",
        amount: -300,
        balance: null,
        descriptionRaw: "Kiwisaver",
        merchantName: "Kiwisaver",
        category: "Investing",
        categoryType: "saving",
        isTransfer: false,
        source: "demo",
        importedAt: now
      });
    }
  }

  await prisma.transaction.createMany({ data: transactions });

  const metricsPack = computeMetricsPack(
    await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" }
    }),
    now
  );

  await prisma.pipelineRun.create({
    data: {
      userId: user.id,
      metricsPack,
      processedCount: transactions.length
    }
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, userId: user.id, transactions: transactions.length }, null, 2));
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
