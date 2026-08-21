import { useMemo } from "react";
import {
  Thermometer,
  Droplets,
  Fan,
  CloudFog,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { HistoryPoint } from "../api";
import { HistoryChart } from "./HistoryChart";
import { Card, CardContent } from "@/components/ui/card";

function StatCard({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: `${color}18` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-xl font-bold text-foreground">
            {value}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {unit}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPanel({ history }: { history: HistoryPoint[] }) {
  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        avgTemp: "—",
        minTemp: "—",
        maxTemp: "—",
        avgHum: "—",
        minHum: "—",
        maxHum: "—",
        fanUp: "—",
        humidUp: "—",
        count: 0,
      };
    }

    const temps = history.map((h) => h.temperature);
    const hums = history.map((h) => h.humidity);
    const fanOn = history.filter((h) => h.relay_fan).length;
    const humidOn = history.filter((h) => h.relay_humidifier).length;
    const total = history.length;

    const avg = (arr: number[]) =>
      (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
    const pct = (on: number) =>
      total > 0 ? `${((on / total) * 100).toFixed(0)}%` : "—";

    return {
      avgTemp: avg(temps),
      minTemp: Math.min(...temps).toFixed(1),
      maxTemp: Math.max(...temps).toFixed(1),
      avgHum: avg(hums),
      minHum: Math.min(...hums).toFixed(1),
      maxHum: Math.max(...hums).toFixed(1),
      fanUp: pct(fanOn),
      humidUp: pct(humidOn),
      count: total,
    };
  }, [history]);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={<Thermometer className="size-5" />}
          label="Avg Suhu"
          value={stats.avgTemp}
          unit="°C"
          color="#cadb3c"
        />
        <StatCard
          icon={<TrendingDown className="size-5" />}
          label="Min Suhu"
          value={stats.minTemp}
          unit="°C"
          color="#a88aec"
        />
        <StatCard
          icon={<TrendingUp className="size-5" />}
          label="Max Suhu"
          value={stats.maxTemp}
          unit="°C"
          color="#dc2626"
        />
        <StatCard
          icon={<Droplets className="size-5" />}
          label="Avg Kelembaban"
          value={stats.avgHum}
          unit="%"
          color="#3b82f6"
        />
        <StatCard
          icon={<TrendingDown className="size-5" />}
          label="Min Kelembaban"
          value={stats.minHum}
          unit="%"
          color="#a88aec"
        />
        <StatCard
          icon={<TrendingUp className="size-5" />}
          label="Max Kelembaban"
          value={stats.maxHum}
          unit="%"
          color="#f97316"
        />
        <StatCard
          icon={<Fan className="size-5" />}
          label="Kipas Uptime"
          value={stats.fanUp}
          unit=""
          color="#16a34a"
        />
        <StatCard
          icon={<CloudFog className="size-5" />}
          label="Humidifier Uptime"
          value={stats.humidUp}
          unit=""
          color="#0ea5e9"
        />
      </div>

      <HistoryChart />

      {stats.count > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {stats.count} data points dalam 24 jam terakhir
        </p>
      )}
    </div>
  );
}
