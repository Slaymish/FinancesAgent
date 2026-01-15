import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { readLocalStorageJson } from "../storage/localStorage.js";
import { parseAppleHealthExport } from "../parsers/appleHealthStub.js";

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function linearRegressionSlope(points: Array<{ x: number; y: number }>): number | null {
  if (points.length < 2) return null;
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    num += dx * (p.y - meanY);
    den += dx * dx;
  }
  if (den === 0) return null;
  return num / den;
}

async function computeMetricsPack(now = new Date()) {
  const today = startOfDayUtc(now);
  const start28 = addDaysUtc(today, -27);
  const start14 = addDaysUtc(today, -13);
  const start7 = addDaysUtc(today, -6);

  const [weights28, nutrition28, workouts28, sleeps28, vitals28] = await Promise.all([
    prisma.dailyWeight.findMany({ where: { date: { gte: start28, lte: today } }, orderBy: { date: "asc" } }),
    prisma.dailyNutrition.findMany({ where: { date: { gte: start28, lte: today } }, orderBy: { date: "asc" } }),
    prisma.workout.findMany({ where: { start: { gte: start28, lte: addDaysUtc(today, 1) } }, orderBy: { start: "asc" } }),
    prisma.sleepSession.findMany({ where: { start: { gte: start28, lte: addDaysUtc(today, 1) } }, orderBy: { start: "asc" } }),
    prisma.dailyVitals.findMany({ where: { date: { gte: start28, lte: today } }, orderBy: { date: "asc" } })
  ]);

  const latestWeight = weights28.length ? weights28[weights28.length - 1] : null;

  const weights7 = weights28.filter((w) => w.date >= start7);
  const weights14 = weights28.filter((w) => w.date >= start14);

  const slope7 = linearRegressionSlope(
    weights7.map((w) => ({ x: w.date.getTime(), y: w.weightKg }))
  );
  const slope14 = linearRegressionSlope(
    weights14.map((w) => ({ x: w.date.getTime(), y: w.weightKg }))
  );

  const slopeKgPerDay7 = slope7 == null ? null : slope7 * (24 * 60 * 60 * 1000);
  const slopeKgPerDay14 = slope14 == null ? null : slope14 * (24 * 60 * 60 * 1000);

  const nutrition7 = nutrition28.filter((n) => n.date >= start7);
  const nutrition14 = nutrition28.filter((n) => n.date >= start14);

  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);

  const avgCalories7 = avg(nutrition7.map((n) => n.calories).filter((v): v is number => typeof v === "number"));
  const avgProtein7 = avg(nutrition7.map((n) => n.proteinG).filter((v): v is number => typeof v === "number"));
  const avgCalories14 = avg(nutrition14.map((n) => n.calories).filter((v): v is number => typeof v === "number"));
  const avgProtein14 = avg(nutrition14.map((n) => n.proteinG).filter((v): v is number => typeof v === "number"));

  const workouts7 = workouts28.filter((w) => w.start >= start7);
  const workouts14 = workouts28.filter((w) => w.start >= start14);

  const minutes7 = workouts7.reduce((sum, w) => sum + w.durationMin, 0);
  const minutes14 = workouts14.reduce((sum, w) => sum + w.durationMin, 0);

  const sleep7 = sleeps28.filter((s) => s.start >= start7);
  const sleep14 = sleeps28.filter((s) => s.start >= start14);
  const avgSleepMin7 = avg(sleep7.map((s) => s.durationMin));
  const avgSleepMin14 = avg(sleep14.map((s) => s.durationMin));

  const vitals7 = vitals28.filter((v) => v.date >= start7);
  const vitals14 = vitals28.filter((v) => v.date >= start14);
  const avgRestingHr7 = avg(vitals7.map((v) => v.restingHr).filter((v): v is number => typeof v === "number"));
  const avgRestingHr14 = avg(vitals14.map((v) => v.restingHr).filter((v): v is number => typeof v === "number"));

  return {
    generatedAt: now.toISOString(),
    ranges: {
      d7: { start: start7.toISOString(), end: today.toISOString() },
      d14: { start: start14.toISOString(), end: today.toISOString() },
      d28: { start: start28.toISOString(), end: today.toISOString() }
    },
    weight: {
      latest: latestWeight ? { date: latestWeight.date.toISOString(), weightKg: latestWeight.weightKg } : null,
      slopeKgPerDay7,
      slopeKgPerDay14
    },
    nutrition: {
      avgCalories7,
      avgCalories14,
      avgProteinG7: avgProtein7,
      avgProteinG14: avgProtein14
    },
    training: {
      sessions7: workouts7.length,
      sessions14: workouts14.length,
      minutes7,
      minutes14
    },
    sleep: {
      avgSleepMin7,
      avgSleepMin14
    },
    recovery: {
      avgRestingHr7,
      avgRestingHr14
    }
  };
}

export async function pipelineRoutes(app: FastifyInstance) {
  const env = loadEnv();

  app.post("/run", async (_req, reply) => {
    const unprocessed = await prisma.ingestFile.findMany({
      where: { processedAt: null },
      orderBy: { receivedAt: "asc" }
    });

    const warnings: string[] = [];
    let processedCount = 0;

    for (const ingest of unprocessed) {
      if (env.STORAGE_PROVIDER !== "local") {
        return reply
          .code(501)
          .send({ error: `storage provider '${env.STORAGE_PROVIDER}' not implemented` });
      }

      const payload = await readLocalStorageJson(env.STORAGE_LOCAL_DIR, ingest.storageKey);
      const parsed = parseAppleHealthExport(payload);
      warnings.push(...parsed.warnings);

      // Upsert canonical rows (currently no-op until parser is implemented)
      await prisma.$transaction([
        ...parsed.rows.dailyWeights.map((row) =>
          prisma.dailyWeight.upsert({
            where: { date: row.date },
            update: { weightKg: row.weightKg },
            create: { date: row.date, weightKg: row.weightKg }
          })
        ),
        ...parsed.rows.dailyNutrition.map((row) =>
          prisma.dailyNutrition.upsert({
            where: { date: row.date },
            update: {
              calories: row.calories ?? null,
              proteinG: row.proteinG ?? null,
              carbsG: row.carbsG ?? null,
              fatG: row.fatG ?? null,
              fibreG: row.fibreG ?? null,
              alcoholG: row.alcoholG ?? null
            },
            create: {
              date: row.date,
              calories: row.calories ?? null,
              proteinG: row.proteinG ?? null,
              carbsG: row.carbsG ?? null,
              fatG: row.fatG ?? null,
              fibreG: row.fibreG ?? null,
              alcoholG: row.alcoholG ?? null
            }
          })
        ),
        ...parsed.rows.workouts.map((row) =>
          prisma.workout.create({
            data: {
              start: row.start,
              type: row.type,
              durationMin: row.durationMin,
              distanceKm: row.distanceKm ?? null,
              avgHr: row.avgHr ?? null,
              maxHr: row.maxHr ?? null,
              avgPace: row.avgPace ?? null
            }
          })
        ),
        ...parsed.rows.sleepSessions.map((row) =>
          prisma.sleepSession.create({
            data: {
              start: row.start,
              end: row.end,
              durationMin: row.durationMin,
              quality: row.quality ?? null
            }
          })
        ),
        ...parsed.rows.dailyVitals.map((row) =>
          prisma.dailyVitals.upsert({
            where: { date: row.date },
            update: {
              restingHr: row.restingHr ?? null,
              hrv: row.hrv ?? null
            },
            create: {
              date: row.date,
              restingHr: row.restingHr ?? null,
              hrv: row.hrv ?? null
            }
          })
        )
      ]);

      await prisma.ingestFile.update({
        where: { id: ingest.id },
        data: { processedAt: new Date() }
      });
      processedCount += 1;
    }

    const metricsPack = await computeMetricsPack();

    const run = await prisma.pipelineRun.create({
      data: {
        metricsPack,
        processedIngestCount: processedCount
      }
    });

    const existingDocs = await prisma.insightsDoc.count();
    if (existingDocs === 0) {
      await prisma.insightsDoc.create({
        data: {
          markdown: "# Insights\n\n",
          diffFromPrev: null,
          metricsPack,
          pipelineRunId: run.id
        }
      });
    }

    return reply.code(200).send({
      ok: true,
      runId: run.id,
      processedIngestCount: processedCount,
      warnings,
      metricsPack
    });
  });
}
