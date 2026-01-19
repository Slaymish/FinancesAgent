"use client";

import { useMemo, useState } from "react";
import { Card } from "../components/ui";

type Preferences = {
  targetWeightKg: number | null;
  targetCalories: number | null;
  targetProteinG: number | null;
  targetFatG: number | null;
  targetCarbsG: number | null;
  targetSleepHours: number | null;
  targetTrainingSessions: number | null;
  targetFibreG: number | null;
};

type FieldKey = keyof Preferences;

type PreferencesFormProps = {
  initial: Preferences | null;
};

function formatNumber(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseOptionalNumber(label: string, value: string, options?: { min?: number; int?: boolean }): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    throw new Error(`Enter a valid ${label}.`);
  }
  if (options?.int && !Number.isInteger(parsed)) {
    throw new Error(`Enter a whole number for ${label}.`);
  }
  if (options?.min != null && parsed < options.min) {
    throw new Error(`${label} must be at least ${options.min}.`);
  }
  return parsed;
}

export default function PreferencesForm({ initial }: PreferencesFormProps) {
  const [baseline, setBaseline] = useState<Preferences | null>(initial);
  const [form, setForm] = useState<Record<FieldKey, string>>({
    targetWeightKg: formatNumber(initial?.targetWeightKg ?? null),
    targetCalories: formatNumber(initial?.targetCalories ?? null),
    targetProteinG: formatNumber(initial?.targetProteinG ?? null),
    targetFatG: formatNumber(initial?.targetFatG ?? null),
    targetCarbsG: formatNumber(initial?.targetCarbsG ?? null),
    targetSleepHours: formatNumber(initial?.targetSleepHours ?? null),
    targetTrainingSessions: formatNumber(initial?.targetTrainingSessions ?? null),
    targetFibreG: formatNumber(initial?.targetFibreG ?? null)
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!baseline) return Object.values(form).some((value) => value.trim() !== "");
    return (
      form.targetWeightKg !== formatNumber(baseline.targetWeightKg) ||
      form.targetCalories !== formatNumber(baseline.targetCalories) ||
      form.targetProteinG !== formatNumber(baseline.targetProteinG) ||
      form.targetFatG !== formatNumber(baseline.targetFatG) ||
      form.targetCarbsG !== formatNumber(baseline.targetCarbsG) ||
      form.targetSleepHours !== formatNumber(baseline.targetSleepHours) ||
      form.targetTrainingSessions !== formatNumber(baseline.targetTrainingSessions) ||
      form.targetFibreG !== formatNumber(baseline.targetFibreG)
    );
  }, [baseline, form]);

  function setField(key: FieldKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage(null);

    try {
      const payload = {
        targetWeightKg: parseOptionalNumber("target weight", form.targetWeightKg, { min: 0.1 }),
        targetCalories: parseOptionalNumber("target calories", form.targetCalories, { min: 1, int: true }),
        targetProteinG: parseOptionalNumber("protein target", form.targetProteinG, { min: 0 }),
        targetFatG: parseOptionalNumber("fat target", form.targetFatG, { min: 0 }),
        targetCarbsG: parseOptionalNumber("carbs target", form.targetCarbsG, { min: 0 }),
        targetSleepHours: parseOptionalNumber("sleep target", form.targetSleepHours, { min: 0 }),
        targetTrainingSessions: parseOptionalNumber("training target", form.targetTrainingSessions, { min: 0, int: true }),
        targetFibreG: parseOptionalNumber("fiber target", form.targetFibreG, { min: 0 })
      };

      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const body = (await res.json().catch(() => ({}))) as { preferences?: Preferences; error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save preferences");
      }

      if (body.preferences) {
        setForm({
          targetWeightKg: formatNumber(body.preferences.targetWeightKg),
          targetCalories: formatNumber(body.preferences.targetCalories),
          targetProteinG: formatNumber(body.preferences.targetProteinG),
          targetFatG: formatNumber(body.preferences.targetFatG),
          targetCarbsG: formatNumber(body.preferences.targetCarbsG),
          targetSleepHours: formatNumber(body.preferences.targetSleepHours),
          targetTrainingSessions: formatNumber(body.preferences.targetTrainingSessions),
          targetFibreG: formatNumber(body.preferences.targetFibreG)
        });
        setBaseline(body.preferences);
      }

      setStatus("saved");
      setMessage("Preferences saved.");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to save preferences");
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <Card title="Goal targets" subtitle="Used for projections.">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="targetWeightKg">Target weight (kg)</label>
            <input
              id="targetWeightKg"
              inputMode="decimal"
              type="number"
              step="0.1"
              placeholder="e.g. 75"
              className="input"
              value={form.targetWeightKg}
              onChange={(event) => setField("targetWeightKg", event.target.value)}
            />
            <p className="field-hint">Used for pace + arrival date.</p>
          </div>
        </div>
      </Card>

      <Card title="MacroFactor targets" subtitle="Optional macros.">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="targetCalories">Target calories (kcal)</label>
            <input
              id="targetCalories"
              inputMode="numeric"
              type="number"
              step="1"
              placeholder="e.g. 2200"
              className="input"
              value={form.targetCalories}
              onChange={(event) => setField("targetCalories", event.target.value)}
            />
            <p className="field-hint">Optional daily calorie goal.</p>
          </div>

          <div className="field">
            <label htmlFor="targetProteinG">Protein (g)</label>
            <input
              id="targetProteinG"
              inputMode="decimal"
              type="number"
              step="1"
              placeholder="e.g. 160"
              className="input"
              value={form.targetProteinG}
              onChange={(event) => setField("targetProteinG", event.target.value)}
            />
            <p className="field-hint">Leave blank if not tracking macros.</p>
          </div>

          <div className="field">
            <label htmlFor="targetFatG">Fat (g)</label>
            <input
              id="targetFatG"
              inputMode="decimal"
              type="number"
              step="1"
              placeholder="e.g. 70"
              className="input"
              value={form.targetFatG}
              onChange={(event) => setField("targetFatG", event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="targetCarbsG">Carbs (g)</label>
            <input
              id="targetCarbsG"
              inputMode="decimal"
              type="number"
              step="1"
              placeholder="e.g. 220"
              className="input"
              value={form.targetCarbsG}
              onChange={(event) => setField("targetCarbsG", event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="targetFibreG">Fiber (g)</label>
            <input
              id="targetFibreG"
              inputMode="decimal"
              type="number"
              step="1"
              placeholder="e.g. 30"
              className="input"
              value={form.targetFibreG}
              onChange={(event) => setField("targetFibreG", event.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card title="Recovery + training" subtitle="Baselines for sleep + cadence.">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="targetSleepHours">Sleep target (hours)</label>
            <input
              id="targetSleepHours"
              inputMode="decimal"
              type="number"
              step="0.1"
              placeholder="e.g. 7.5"
              className="input"
              value={form.targetSleepHours}
              onChange={(event) => setField("targetSleepHours", event.target.value)}
            />
            <p className="field-hint">Optional sleep baseline.</p>
          </div>

          <div className="field">
            <label htmlFor="targetTrainingSessions">Training sessions per week</label>
            <input
              id="targetTrainingSessions"
              inputMode="numeric"
              type="number"
              step="1"
              placeholder="e.g. 4"
              className="input"
              value={form.targetTrainingSessions}
              onChange={(event) => setField("targetTrainingSessions", event.target.value)}
            />
            <p className="field-hint">Helps spot cadence gaps.</p>
          </div>
        </div>
      </Card>

      <div className="form-actions">
        <button className="button" type="submit" disabled={status === "saving" || !isDirty}>
          {status === "saving" ? "Saving..." : "Save preferences"}
        </button>
        <span className={`form-status ${status === "error" ? "warn" : ""}`.trim()}>
          {message ?? ""}
        </span>
      </div>
    </form>
  );
}
