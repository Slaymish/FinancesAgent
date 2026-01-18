// Simple demo payloads shown when a user is signed out.

export const demoPipelineLatest = {
  latestRun: {
    id: "demo-run",
    createdAt: new Date().toISOString(),
    processedIngestCount: 12,
    metricsPack: {
      generatedAt: new Date().toISOString(),
      weight: {
        latest: { date: new Date().toISOString(), weightKg: 79.4 },
        slopeKgPerDay7: -0.06,
        slopeKgPerDay14: -0.04
      },
      nutrition: {
        avgCalories7: 2250,
        avgCalories14: 2350,
        avgProteinG7: 150,
        avgProteinG14: 142
      },
      training: {
        sessions7: 4,
        sessions14: 7,
        minutes7: 210,
        minutes14: 360
      },
      sleep: {
        avgSleepMin7: 7 * 60 + 20,
        avgSleepMin14: 7 * 60 + 10
      },
      recovery: {
        avgRestingHr7: 52,
        avgRestingHr14: 54
      },
      trends: {
        weightSeries: [
          { date: "2025-01-01", weightKg: 81 },
          { date: "2025-01-05", weightKg: 80.5 },
          { date: "2025-01-10", weightKg: 80 },
          { date: "2025-01-15", weightKg: 79.7 },
          { date: "2025-01-20", weightKg: 79.4 }
        ],
        nutritionSeries: [
          { date: "2025-01-16", calories: 2200, proteinG: 145 },
          { date: "2025-01-17", calories: 2400, proteinG: 155 },
          { date: "2025-01-18", calories: 2300, proteinG: 150 }
        ],
        sleepSeries: [
          { date: "2025-01-18", minutes: 425 },
          { date: "2025-01-19", minutes: 460 },
          { date: "2025-01-20", minutes: 450 }
        ],
        trainingSeries: [
          { date: "2025-01-18", minutes: 60 },
          { date: "2025-01-19", minutes: 45 },
          { date: "2025-01-20", minutes: 50 }
        ]
      },
      levers: [
        "Keep protein above 140g/day.",
        "Hold 3-4 training sessions per week.",
        "Aim for >7h sleep on travel days."
      ],
      goalProjection: {
        targetWeightKg: 78,
        deltaToGoalKg: -1.4,
        observedSlopeKgPerDay14: -0.04,
        observedSlopeKgPerWeek: -0.28,
        projectedDaysToGoal: 35,
        projectedDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
        trend: "toward"
      }
    }
  }
};

export const demoInsightsLatest = {
  latest: {
    id: "demo-insight",
    createdAt: new Date().toISOString(),
    markdown:
      "## Weekly synthesis\n- Weight trending down at target pace.\n- Protein average above 140g/day; keep it there.\n- Sleep dipped midweek; set a pre-bed routine on travel days.\n- Training volume steady; consider one interval session for VO2.\n",
    diffFromPrev: "+ Added note on travel-day sleep\n+ Training volume steady, consider interval session\n",
    pipelineRunId: "demo-run"
  }
};

export const demoInsightsHistory = {
  docs: [
    { id: "demo-insight", createdAt: new Date().toISOString(), diffFromPrev: "(initial)", pipelineRunId: "demo-run" }
  ]
};

export const demoDataQuality = {
  range: { start: "2025-01-01", end: "2025-01-20" },
  lastIngest: {
    id: "demo-ingest",
    source: "apple-health",
    receivedAt: new Date().toISOString(),
    processedAt: new Date().toISOString()
  },
  lastPipelineRun: { id: "demo-run", createdAt: new Date().toISOString(), processedIngestCount: 12 },
  missingDays: {
    weight: [],
    nutrition: ["2025-01-14"],
    vitals: [],
    sleep: [],
    workouts: ["2025-01-13"]
  }
};
