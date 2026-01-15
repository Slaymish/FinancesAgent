import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function dateKeyUtc(date: Date): string {
  return startOfDayUtc(date).toISOString().slice(0, 10);
}

export async function dataQualityRoutes(app: FastifyInstance) {
  app.get("/summary", async () => {
    const now = new Date();
    const today = startOfDayUtc(now);
    const start14 = addDaysUtc(today, -13);

    const [lastIngest, lastRun, weights, nutrition, vitals, sleeps, workouts] = await Promise.all([
      prisma.ingestFile.findFirst({ orderBy: { receivedAt: "desc" } }),
      prisma.pipelineRun.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.dailyWeight.findMany({ where: { date: { gte: start14, lte: today } } }),
      prisma.dailyNutrition.findMany({ where: { date: { gte: start14, lte: today } } }),
      prisma.dailyVitals.findMany({ where: { date: { gte: start14, lte: today } } }),
      prisma.sleepSession.findMany({ where: { start: { gte: start14, lte: addDaysUtc(today, 1) } } }),
      prisma.workout.findMany({ where: { start: { gte: start14, lte: addDaysUtc(today, 1) } } })
    ]);

    const expectedDates: string[] = [];
    for (let i = 0; i < 14; i += 1) expectedDates.push(dateKeyUtc(addDaysUtc(start14, i)));

    const presentWeight = new Set(weights.map((r) => dateKeyUtc(r.date)));
    const presentNutrition = new Set(nutrition.map((r) => dateKeyUtc(r.date)));
    const presentVitals = new Set(vitals.map((r) => dateKeyUtc(r.date)));

    const presentSleep = new Set<string>();
    for (const s of sleeps) presentSleep.add(dateKeyUtc(s.start));

    const presentWorkouts = new Set<string>();
    for (const w of workouts) presentWorkouts.add(dateKeyUtc(w.start));

    const missing = (present: Set<string>) => expectedDates.filter((d) => !present.has(d));

    return {
      range: { start: start14.toISOString(), end: today.toISOString() },
      lastIngest: lastIngest
        ? {
            id: lastIngest.id,
            source: lastIngest.source,
            receivedAt: lastIngest.receivedAt,
            processedAt: lastIngest.processedAt
          }
        : null,
      lastPipelineRun: lastRun
        ? {
            id: lastRun.id,
            createdAt: lastRun.createdAt,
            processedIngestCount: lastRun.processedIngestCount
          }
        : null,
      missingDays: {
        weight: missing(presentWeight),
        nutrition: missing(presentNutrition),
        vitals: missing(presentVitals),
        sleep: missing(presentSleep),
        workouts: missing(presentWorkouts)
      }
    };
  });
}
