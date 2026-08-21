import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchHistory } from "../api";
import type { HistoryPoint } from "../api";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const RANGES = [
  {
    hours: 1,
    label: "1 Jam",
    title: "Riwayat 1 Jam",
    empty: "Belum ada data 1 jam terakhir",
    tick: (d: Date) =>
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  },
  {
    hours: 6,
    label: "6 Jam",
    title: "Riwayat 6 Jam",
    empty: "Belum ada data 6 jam terakhir",
    tick: (d: Date) =>
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  },
  {
    hours: 24,
    label: "24 Jam",
    title: "Riwayat 24 Jam",
    empty: "Belum ada data 24 jam terakhir",
    tick: (d: Date) =>
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  },
  {
    hours: 72,
    label: "3 Hari",
    title: "Riwayat 3 Hari",
    empty: "Belum ada data 3 hari terakhir",
    tick: (d: Date) =>
      d.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
  },
  {
    hours: 168,
    label: "1 Minggu",
    title: "Riwayat 1 Minggu",
    empty: "Belum ada data 1 minggu terakhir",
    tick: (d: Date) =>
      d.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
  },
  {
    hours: 720,
    label: "1 Bulan",
    title: "Riwayat 1 Bulan",
    empty: "Belum ada data 1 bulan terakhir",
    tick: (d: Date) =>
      d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
  },
] as const;

export function HistoryChart() {
  const [rangeIdx, setRangeIdx] = useState(2);
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const range = RANGES[rangeIdx];

  const load = useCallback(async (hours: number, showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      const h = await fetchHistory(hours);
      setData(h);
    } catch {
      /* biarkan data lama tetap tampil saat gagal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range.hours, true);
    const interval = range.hours <= 24 ? 10_000 : 60_000;
    const id = setInterval(() => load(range.hours, false), interval);
    return () => clearInterval(id);
  }, [range.hours, load]);

  const chartData = data.map((r) => ({
    time: range.tick(new Date(r.time)),
    Suhu: Number(r.temperature.toFixed(1)),
    Kelembaban: Number(r.humidity.toFixed(1)),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{range.title}</CardTitle>
        <CardAction>
          <select
            aria-label="Pilih rentang riwayat"
            value={rangeIdx}
            onChange={(e) => setRangeIdx(Number(e.target.value))}
            className="h-7 cursor-pointer appearance-none rounded-lg border border-input bg-background px-2.5 pr-7 text-xs font-medium text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.5rem center",
            }}
          >
            {RANGES.map((r, i) => (
              <option key={r.hours} value={i}>
                {r.label}
              </option>
            ))}
          </select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading && chartData.length === 0 ? (
          <Skeleton className="h-[300px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="grid h-[300px] place-items-center text-sm text-muted-foreground">
            {range.empty}
          </div>
        ) : (
          <div
            className={
              loading
                ? "opacity-50 transition-opacity duration-200"
                : "transition-opacity duration-200"
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -4, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "var(--chart-1)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: "var(--chart-2)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                    fontSize: 12,
                  }}
                  labelStyle={{
                    color: "var(--foreground)",
                    fontWeight: 600,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Suhu"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Kelembaban"
                  stroke="var(--chart-2)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
