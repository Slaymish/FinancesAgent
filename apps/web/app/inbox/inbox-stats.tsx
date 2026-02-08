"use client";

import { Card } from "../components/ui";

type InboxStatsProps = {
  stats: {
    toClearCount: number;
    streak: number;
    autoClassifiedPercent: number;
  } | null;
};

export function InboxStats({ stats }: InboxStatsProps) {
  if (!stats) {
    return null;
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
      <Card>
        <div className="stat">
          <div className="stat-value">{stats.toClearCount}</div>
          <div className="stat-label">To Clear</div>
        </div>
      </Card>
      
      <Card>
        <div className="stat">
          <div className="stat-value">{stats.streak} 🔥</div>
          <div className="stat-label">Day Streak</div>
        </div>
      </Card>
      
      <Card>
        <div className="stat">
          <div className="stat-value">{stats.autoClassifiedPercent}%</div>
          <div className="stat-label">Auto-classified (7d)</div>
        </div>
      </Card>
    </div>
  );
}
