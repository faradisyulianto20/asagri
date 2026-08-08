import type { LatestData } from "../api";

export function TempCard({ latest }: { latest: LatestData | null }) {
  const value = latest?.available ? latest.temperature : undefined;
  return (
    <div className="card stat temp">
      <div className="stat-label">Suhu</div>
      <div className="stat-value">
        {value != null ? value.toFixed(1) : "–"}
        <span className="stat-unit">°C</span>
      </div>
      <div className="stat-icon">🌡️</div>
    </div>
  );
}
