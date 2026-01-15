import type { IngestParser } from "./types.js";

// NOTE: This is intentionally a stub until we have a concrete sample
// export format (JSON/CSV) from the chosen Apple Health exporter app.
export const parseAppleHealthExport: IngestParser = (_payload) => {
  return {
    rows: {
      dailyWeights: [],
      dailyNutrition: [],
      workouts: [],
      sleepSessions: [],
      dailyVitals: []
    },
    warnings: [
      "Apple Health parser not implemented yet (need a sample export payload to target)."
    ]
  };
};
