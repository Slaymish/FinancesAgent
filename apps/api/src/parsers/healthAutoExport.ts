import crypto from "node:crypto";
import type { CanonicalRows, IngestParser, ParserResult } from "./types.js";

type MetricEntry = {
  date?: string;
  qty?: unknown;
  source?: string;
  [k: string]: unknown;
};

type MetricBundle = {
  name?: string;
  units?: string;
  data?: MetricEntry[];
};

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stableWorkoutSourceId(input: {
  startRaw: string;
  endRaw: string;
  name: string;
  durationSeconds: number | null;
  distanceKm: number | null;
}): string {
  const dur = input.durationSeconds == null ? "" : String(input.durationSeconds);
  const dist = input.distanceKm == null ? "" : String(input.distanceKm);
  return sha256(`workout:${input.startRaw}|${input.endRaw}|${input.name}|${dur}|${dist}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDateOnlyUtc(dateTime: string): Date {
  // Uses YYYY-MM-DD portion only, normalized to UTC midnight.
  const datePart = dateTime.slice(0, 10);
  const parts = datePart.split("-");
  if (parts.length !== 3) throw new Error(`Unparseable date: ${dateTime}`);
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`Unparseable date: ${dateTime}`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function parseDateTimeWithOffset(dateTime: string): Date {
  // Example: "2026-01-15 15:50:31 +1300" => "2026-01-15T15:50:31+13:00"
  const match = /^([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2}:[0-9]{2}:[0-9]{2}) ([+-][0-9]{4})$/.exec(
    dateTime
  );
  if (!match) {
    // Fall back: Date.parse might still handle it.
    const dt = new Date(dateTime);
    if (Number.isNaN(dt.getTime())) throw new Error(`Unparseable datetime: ${dateTime}`);
    return dt;
  }

  const d = match[1];
  const t = match[2];
  const off = match[3];
  if (!d || !t || !off) throw new Error(`Unparseable datetime: ${dateTime}`);
  const sign = off[0];
  const hh = off.slice(1, 3);
  const mm = off.slice(3, 5);
  return new Date(`${d}T${t}${sign}${hh}:${mm}`);
}

function pickPreferredSource(entries: MetricEntry[], preferredSource: string): MetricEntry[] {
  const preferred = entries.filter((e) => e.source === preferredSource);
  return preferred.length ? preferred : entries;
}

function groupSumByDate(entries: MetricEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    if (!e.date) continue;
    const v = typeof e.qty === "number" ? e.qty : Number(e.qty);
    if (!Number.isFinite(v)) continue;
    const dateKey = e.date.slice(0, 10);
    out.set(dateKey, (out.get(dateKey) ?? 0) + v);
  }
  return out;
}

function groupAvgByDate(entries: MetricEntry[]): Map<string, number> {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (!e.date) continue;
    const v = typeof e.qty === "number" ? e.qty : Number(e.qty);
    if (!Number.isFinite(v)) continue;
    const dateKey = e.date.slice(0, 10);
    sums.set(dateKey, (sums.get(dateKey) ?? 0) + v);
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  }
  const out = new Map<string, number>();
  for (const [k, sum] of sums) {
    out.set(k, sum / (counts.get(k) ?? 1));
  }
  return out;
}

export const parseHealthAutoExport: IngestParser = (payload: unknown): ParserResult => {
  const warnings: string[] = [];

  if (!isRecord(payload) || !isRecord(payload.data)) {
    return {
      rows: {
        dailyWeights: [],
        dailyNutrition: [],
        workouts: [],
        sleepSessions: [],
        dailyVitals: []
      },
      warnings: ["Payload is not a Health Auto Export JSON (missing data object)."]
    };
  }

  const data = payload.data as Record<string, unknown>;
  const metricsRaw = data.metrics;
  const workoutsRaw = data.workouts;

  const metricBundles: MetricBundle[] = Array.isArray(metricsRaw) ? (metricsRaw as MetricBundle[]) : [];
  const metricsByName = new Map<string, MetricBundle>();
  for (const m of metricBundles) {
    if (m && typeof m.name === "string") metricsByName.set(m.name, m);
  }

  const getMetricEntries = (name: string): { units: string | undefined; entries: MetricEntry[] } => {
    const bundle = metricsByName.get(name);
    const units = bundle?.units;
    const entries = Array.isArray(bundle?.data) ? (bundle!.data as MetricEntry[]) : [];
    return { units, entries };
  };

  const rows: CanonicalRows = {
    dailyWeights: [],
    dailyNutrition: [],
    workouts: [],
    sleepSessions: [],
    dailyVitals: []
  };

  // Weight (kg)
  {
    const { units, entries } = getMetricEntries("weight_body_mass");
    if (entries.length === 0) warnings.push("No weight_body_mass entries found.");
    if (units && units !== "kg") warnings.push(`weight_body_mass units '${units}' (expected kg)`);

    // take last value per day
    const byDate = new Map<string, number>();
    for (const e of entries) {
      if (!e.date) continue;
      const v = typeof e.qty === "number" ? e.qty : Number(e.qty);
      if (!Number.isFinite(v)) continue;
      byDate.set(e.date.slice(0, 10), v);
    }
    for (const [dateKey, weightKg] of byDate) {
      rows.dailyWeights.push({ date: parseDateOnlyUtc(dateKey), weightKg });
    }
  }

  // Nutrition
  {
    const energy = getMetricEntries("dietary_energy");
    const protein = getMetricEntries("protein");
    const carbs = getMetricEntries("carbohydrates");
    const fat = getMetricEntries("total_fat");
    const fiber = getMetricEntries("fiber");

    const preferredSource = "MacroFactor";

    const energyEntries = pickPreferredSource(energy.entries, preferredSource);
    const proteinEntries = pickPreferredSource(protein.entries, preferredSource);
    const carbEntries = pickPreferredSource(carbs.entries, preferredSource);
    const fatEntries = pickPreferredSource(fat.entries, preferredSource);
    const fiberEntries = pickPreferredSource(fiber.entries, preferredSource);

    if (energy.entries.length === 0) warnings.push("No dietary_energy entries found.");

    const energyByDate = groupSumByDate(energyEntries);
    const proteinByDate = groupSumByDate(proteinEntries);
    const carbsByDate = groupSumByDate(carbEntries);
    const fatByDate = groupSumByDate(fatEntries);
    const fiberByDate = groupSumByDate(fiberEntries);

    // dietary_energy appears to be kJ in your export.
    const energyUnits = energy.units;
    const kjToKcal = (kj: number) => kj / 4.184;

    const allDates = new Set<string>([
      ...energyByDate.keys(),
      ...proteinByDate.keys(),
      ...carbsByDate.keys(),
      ...fatByDate.keys(),
      ...fiberByDate.keys()
    ]);

    for (const dateKey of allDates) {
      const energyVal = energyByDate.get(dateKey);
      let calories: number | null = null;
      if (typeof energyVal === "number") {
        if (energyUnits === "kJ") calories = Math.round(kjToKcal(energyVal));
        else if (energyUnits === "kcal") calories = Math.round(energyVal);
        else {
          calories = Math.round(kjToKcal(energyVal));
          warnings.push(`dietary_energy units '${energyUnits ?? "(missing)"}' assumed kJ`);
        }
      }

      rows.dailyNutrition.push({
        date: parseDateOnlyUtc(dateKey),
        calories,
        proteinG: proteinByDate.get(dateKey) ?? null,
        carbsG: carbsByDate.get(dateKey) ?? null,
        fatG: fatByDate.get(dateKey) ?? null,
        fibreG: fiberByDate.get(dateKey) ?? null,
        alcoholG: null
      });
    }
  }

  // Daily vitals
  {
    const rhr = getMetricEntries("resting_heart_rate");
    const hrv = getMetricEntries("heart_rate_variability");

    const rhrByDate = groupAvgByDate(rhr.entries);
    const hrvByDate = groupAvgByDate(hrv.entries);

    const allDates = new Set<string>([...rhrByDate.keys(), ...hrvByDate.keys()]);
    for (const dateKey of allDates) {
      const restingHr = rhrByDate.get(dateKey);
      const hrvVal = hrvByDate.get(dateKey);
      rows.dailyVitals.push({
        date: parseDateOnlyUtc(dateKey),
        restingHr: restingHr == null ? null : Math.round(restingHr),
        hrv: hrvVal ?? null
      });
    }
  }

  // Sleep sessions (from sleep_analysis metric)
  {
    const sleep = getMetricEntries("sleep_analysis");
    const entries = sleep.entries;
    if (entries.length === 0) warnings.push("No sleep_analysis entries found.");

    for (const e of entries) {
      const sleepStart = typeof e.sleepStart === "string" ? e.sleepStart : null;
      const sleepEnd = typeof e.sleepEnd === "string" ? e.sleepEnd : null;
      const totalSleepHr = typeof e.totalSleep === "number" ? e.totalSleep : Number(e.totalSleep);

      if (!sleepStart || !sleepEnd) continue;
      const start = parseDateTimeWithOffset(sleepStart);
      const end = parseDateTimeWithOffset(sleepEnd);
      const durationMin = Number.isFinite(totalSleepHr) ? Math.round(totalSleepHr * 60) : Math.round((end.getTime() - start.getTime()) / 60000);

      const dedupeKey = sha256(`sleep:${sleepStart}|${sleepEnd}`);
      rows.sleepSessions.push({ start, end, durationMin, quality: null, dedupeKey });
    }
  }

  // Workouts
  {
    const workouts = Array.isArray(workoutsRaw) ? (workoutsRaw as unknown[]) : [];
    for (const w of workouts) {
      if (!isRecord(w)) continue;
      const id = typeof w.id === "string" ? w.id : null;
      const name = typeof w.name === "string" ? w.name : "Workout";
      const startRaw = typeof w.start === "string" ? w.start : null;
      const endRaw = typeof w.end === "string" ? w.end : null;

      if (!startRaw || !endRaw) continue;

      const start = parseDateTimeWithOffset(startRaw);
      const end = parseDateTimeWithOffset(endRaw);

      const durationSeconds = typeof w.duration === "number" ? w.duration : Number(w.duration);
      const durationMin = Number.isFinite(durationSeconds)
        ? Math.max(1, Math.round(durationSeconds / 60))
        : Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

      const distance = isRecord(w.distance) ? w.distance : null;
      const distanceKm = distance && typeof distance.qty === "number" ? distance.qty : distance && distance.qty != null ? Number(distance.qty) : null;

      const avgHrObj = isRecord(w.avgHeartRate) ? w.avgHeartRate : null;
      const maxHrObj = isRecord(w.maxHeartRate) ? w.maxHeartRate : null;
      const avgHr = avgHrObj && typeof avgHrObj.qty === "number" ? Math.round(avgHrObj.qty) : avgHrObj && avgHrObj.qty != null ? Math.round(Number(avgHrObj.qty)) : null;
      const maxHr = maxHrObj && typeof maxHrObj.qty === "number" ? Math.round(maxHrObj.qty) : maxHrObj && maxHrObj.qty != null ? Math.round(Number(maxHrObj.qty)) : null;

      const speedObj = isRecord(w.speed) ? w.speed : null;
      const speedKmh = speedObj && typeof speedObj.qty === "number" ? speedObj.qty : speedObj && speedObj.qty != null ? Number(speedObj.qty) : null;
      const avgPace = speedKmh && Number.isFinite(speedKmh) && speedKmh > 0 ? 60 / speedKmh : null; // min/km

      const resolvedSourceId =
        id ??
        stableWorkoutSourceId({
          startRaw,
          endRaw,
          name,
          durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
          distanceKm: Number.isFinite(distanceKm ?? NaN) ? (distanceKm as number) : null
        });

      rows.workouts.push({
        start,
        type: name,
        durationMin,
        distanceKm: Number.isFinite(distanceKm ?? NaN) ? (distanceKm as number) : null,
        avgHr,
        maxHr,
        avgPace,
        sourceId: resolvedSourceId
      });
    }
  }

  return { rows, warnings };
};
