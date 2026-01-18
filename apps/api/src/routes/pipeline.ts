import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { loadEnv } from "../env.js";
import { readStorageJson } from "../storage/storage.js";
import { parseAppleHealthExport } from "../parsers/appleHealthStub.js";
import { generateInsightsUnifiedDiff } from "../insights/llm.js";
import { applyUnifiedDiff } from "../insights/patch.js";
import { requireUserFromInternalRequest } from "../auth.js";

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function dateKeyUtc(date: Date): string {
  return startOfDayUtc(date).toISOString().slice(0, 10);
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

async function computeMetricsPack(userId: string, now = new Date()) {
  const today = startOfDayUtc(now);
  const start28 = addDaysUtc(today, -27);
  const start14 = addDaysUtc(today, -13);
  const start7 = addDaysUtc(today, -6);

  const [weights28, nutrition28, workouts28, sleeps28, vitals28] = await Promise.all([
    prisma.dailyWeight.findMany({ where: { userId, date: { gte: start28, lte: today } }, orderBy: { date: "asc" } }),
    prisma.dailyNutrition.findMany({ where: { userId, date: { gte: start28, lte: today } }, orderBy: { date: "asc" } }),
    prisma.workout.findMany({
      where: { userId, start: { gte: start28, lte: addDaysUtc(today, 1) } },
      orderBy: { start: "asc" }
    }),
    prisma.sleepSession.findMany({
      where: { userId, start: { gte: start28, lte: addDaysUtc(today, 1) } },
      orderBy: { start: "asc" }
    }),
    prisma.dailyVitals.findMany({ where: { userId, date: { gte: start28, lte: today } }, orderBy: { date: "asc" } })
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

  const sleepByDay = new Map<string, number>();
  for (const s of sleeps28) {
    const k = dateKeyUtc(s.start);
    sleepByDay.set(k, (sleepByDay.get(k) ?? 0) + s.durationMin);
  }

  const workoutMinByDay = new Map<string, number>();
  for (const w of workouts28) {
    const k = dateKeyUtc(w.start);
    workoutMinByDay.set(k, (workoutMinByDay.get(k) ?? 0) + w.durationMin);
  }

  const weightSeries = weights28.map((w) => ({ date: dateKeyUtc(w.date), weightKg: w.weightKg }));
  const nutritionSeries = nutrition28.map((n) => ({
    date: dateKeyUtc(n.date),
    calories: n.calories,
    proteinG: n.proteinG
  }));
  const sleepSeries = Array.from(sleepByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, minutes]) => ({ date, minutes }));
  const trainingSeries = Array.from(workoutMinByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, minutes]) => ({ date, minutes }));

  const levers: string[] = [];
  if (avgProtein7 != null && avgProtein7 < 120) levers.push("Protein: raise average daily protein (aim >= 120g/day).");
  if (avgSleepMin7 != null && avgSleepMin7 < 7 * 60) levers.push("Sleep: push average sleep toward 7+ hours.");
  if (workouts7.length < 3) levers.push("Training: schedule at least 3 sessions/week.");
  if (levers.length === 0) levers.push("Consistency: keep inputs stable and reassess weekly.");

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
    },
    trends: {
      weightSeries,
      nutritionSeries,
      sleepSeries,
      trainingSeries
    },
    levers: levers.slice(0, 3)
  };
}

function computeGoalProjection(params: {
  env: ReturnType<typeof loadEnv>;
  metricsPack: any;
}): any {
  const { env, metricsPack } = params;
  if (!env.GOAL_TARGET_WEIGHT_KG) return null;
  const latest = metricsPack.weight?.latest;
  if (!latest || typeof latest.weightKg !== "number") return null;

  const today = new Date(metricsPack.ranges?.d7?.end ?? new Date().toISOString());
  const observed = metricsPack.weight?.slopeKgPerDay14;
  const observedSlopeKgPerDay14 = typeof observed === "number" ? observed : null;
  if (observedSlopeKgPerDay14 == null) return null;

  const deltaToGoalKg = env.GOAL_TARGET_WEIGHT_KG - latest.weightKg;
  const trend =
    deltaToGoalKg === 0
      ? "at-goal"
      : observedSlopeKgPerDay14 === 0
        ? "flat"
        : deltaToGoalKg * observedSlopeKgPerDay14 > 0
          ? "toward"
          : "away";

  let projectedDaysToGoal: number | null = null;
  let projectedDate: string | null = null;

  if (deltaToGoalKg === 0) {
    projectedDaysToGoal = 0;
    projectedDate = startOfDayUtc(today).toISOString();
  } else if (trend === "toward") {
    projectedDaysToGoal = Math.ceil(Math.abs(deltaToGoalKg / observedSlopeKgPerDay14));
    projectedDate = addDaysUtc(startOfDayUtc(today), projectedDaysToGoal).toISOString();
  }

  return {
    targetWeightKg: env.GOAL_TARGET_WEIGHT_KG,
    observedSlopeKgPerDay14,
    observedSlopeKgPerWeek: observedSlopeKgPerDay14 * 7,
    deltaToGoalKg,
    projectedDaysToGoal,
    projectedDate,
    trend
  };
}

function sanityWarnings(parsed: ReturnType<typeof parseAppleHealthExport>): string[] {
  const warnings: string[] = [];

  for (const n of parsed.rows.dailyNutrition) {
    if (n.calories != null) {
      if (n.calories < 0) warnings.push(`Negative calories on ${n.date.toISOString().slice(0, 10)}`);
      if (n.calories > 12000) warnings.push(`Implausible calories on ${n.date.toISOString().slice(0, 10)}: ${n.calories}`);
    }
  }

  for (const s of parsed.rows.sleepSessions) {
    if (s.durationMin <= 0) warnings.push(`Non-positive sleep duration at ${s.start.toISOString()}`);
    if (s.durationMin > 24 * 60) warnings.push(`Implausible sleep duration at ${s.start.toISOString()}: ${s.durationMin}min`);
  }

  const workoutIds = new Set<string>();
  for (const w of parsed.rows.workouts) {
    if (w.durationMin <= 0) warnings.push(`Non-positive workout duration at ${w.start.toISOString()}`);
    if (w.sourceId) {
      if (workoutIds.has(w.sourceId)) warnings.push(`Duplicate workout sourceId in payload: ${w.sourceId}`);
      workoutIds.add(w.sourceId);
    }
  }

  return warnings;
}

export async function pipelineRoutes(app: FastifyInstance) {
  const env = loadEnv();

  app.get("/latest", async (req, reply) => {
    const user = await requireUserFromInternalRequest({ req, reply, env });
    if (!user) return;

    const latest = await prisma.pipelineRun.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });

    return {
      latestRun: latest
        ? {
            id: latest.id,
            createdAt: latest.createdAt,
            processedIngestCount: latest.processedIngestCount,
            metricsPack: latest.metricsPack
          }
        : null
    };
  });

  app.post("/run", async (req, reply) => {
    const user = await requireUserFromInternalRequest({ req, reply, env, allowPipelineToken: true });
    if (!user) return;

    const unprocessed = await prisma.ingestFile.findMany({
      where: { userId: user.id, processedAt: null },
      orderBy: { receivedAt: "asc" }
    });

    const warnings: string[] = [];
    let processedCount = 0;

    for (const ingest of unprocessed) {
      const payload = await readStorageJson({ env, storageKey: ingest.storageKey });
      const parsed = parseAppleHealthExport(payload);
      warnings.push(...parsed.warnings);
      warnings.push(...sanityWarnings(parsed));

      await prisma.$transaction([
        ...parsed.rows.dailyWeights.map((row) =>
          prisma.dailyWeight.upsert({
            where: { userId_date: { userId: user.id, date: row.date } },
            update: { weightKg: row.weightKg },
            create: { userId: user.id, date: row.date, weightKg: row.weightKg }
          })
        ),
        ...parsed.rows.dailyNutrition.map((row) =>
          prisma.dailyNutrition.upsert({
            where: { userId_date: { userId: user.id, date: row.date } },
            update: {
              calories: row.calories ?? null,
              proteinG: row.proteinG ?? null,
              carbsG: row.carbsG ?? null,
              fatG: row.fatG ?? null,
              fibreG: row.fibreG ?? null,
              alcoholG: row.alcoholG ?? null
            },
            create: {
              userId: user.id,
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
          row.sourceId
            ? prisma.workout.upsert({
                where: { userId_sourceId: { userId: user.id, sourceId: row.sourceId } },
                update: {
                  start: row.start,
                  type: row.type,
                  durationMin: row.durationMin,
                  distanceKm: row.distanceKm ?? null,
                  avgHr: row.avgHr ?? null,
                  maxHr: row.maxHr ?? null,
                  avgPace: row.avgPace ?? null
                },
                create: {
                  userId: user.id,
                  sourceId: row.sourceId,
                  start: row.start,
                  type: row.type,
                  durationMin: row.durationMin,
                  distanceKm: row.distanceKm ?? null,
                  avgHr: row.avgHr ?? null,
                  maxHr: row.maxHr ?? null,
                  avgPace: row.avgPace ?? null
                }
              })
            : prisma.workout.create({
                data: {
                  userId: user.id,
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
          row.dedupeKey
            ? prisma.sleepSession.upsert({
                where: { userId_dedupeKey: { userId: user.id, dedupeKey: row.dedupeKey } },
                update: {
                  start: row.start,
                  end: row.end,
                  durationMin: row.durationMin,
                  quality: row.quality ?? null
                },
                create: {
                  userId: user.id,
                  dedupeKey: row.dedupeKey,
                  start: row.start,
                  end: row.end,
                  durationMin: row.durationMin,
                  quality: row.quality ?? null
                }
              })
            : prisma.sleepSession.create({
                data: {
                  userId: user.id,
                  start: row.start,
                  end: row.end,
                  durationMin: row.durationMin,
                  quality: row.quality ?? null
                }
              })
        ),
        ...parsed.rows.dailyVitals.map((row) =>
          prisma.dailyVitals.upsert({
            where: { userId_date: { userId: user.id, date: row.date } },
            update: {
              restingHr: row.restingHr ?? null,
              hrv: row.hrv ?? null
            },
            create: {
              userId: user.id,
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

    const metricsPack = await computeMetricsPack(user.id);
    const goalProjection = computeGoalProjection({ env, metricsPack: metricsPack as any });
    const metricsPackWithGoal = {
      ...(metricsPack as any),
      goalProjection
    };

    const run = await prisma.pipelineRun.create({
      data: {
        userId: user.id,
        metricsPack: metricsPackWithGoal,
        processedIngestCount: processedCount
      }
    });

    if (env.INSIGHTS_ENABLED) {
      const prev = await prisma.insightsDoc.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

      if (!prev) {
        await prisma.insightsDoc.create({
          data: {
            userId: user.id,
            markdown: "## Weekly synthesis\n- Awaiting next update.\n",
            diffFromPrev: null,
            metricsPack: metricsPackWithGoal,
            pipelineRunId: run.id
          }
        });
      } else {
        let nextMarkdown = prev.markdown;
        let diffFromPrev: string | null = null;

        if (env.OPENAI_API_KEY && env.INSIGHTS_MODEL) {
          try {
            const diff = await generateInsightsUnifiedDiff({
              apiKey: env.OPENAI_API_KEY,
              model: env.INSIGHTS_MODEL,
              previousMarkdown: prev.markdown,
              metricsPack: metricsPackWithGoal
            });

            nextMarkdown = applyUnifiedDiff({ previous: prev.markdown, patch: diff });
            diffFromPrev = diff;
          } catch (err) {
            warnings.push(`Insights update failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          warnings.push("Insights enabled but missing OPENAI_API_KEY or INSIGHTS_MODEL.");
        }

        await prisma.insightsDoc.create({
          data: {
            userId: user.id,
            markdown: nextMarkdown,
            diffFromPrev,
            metricsPack: metricsPackWithGoal,
            pipelineRunId: run.id
          }
        });
      }
    }

    return reply.code(200).send({
      ok: true,
      runId: run.id,
      processedIngestCount: processedCount,
      warnings,
      metricsPack: metricsPackWithGoal
    });
  });
}
