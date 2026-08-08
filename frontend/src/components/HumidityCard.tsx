import type { LatestData } from "../api";

export function HumidityCard({ latest }: { latest: LatestData | null }) {
  const value = latest?.available ? latest.humidity : undefined;
  return (
    <div className="card stat hum">
      <div className="stat-label">Kelembaban</div>
      <div className="stat-value">
        {value != null ? value.toFixed(1) : "–"}
        <span className="stat-unit">%</span>
      </div>
      <div className="stat-icon">💧</div>
    </div>
  );
}
