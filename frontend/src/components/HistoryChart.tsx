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
import type { HistoryPoint } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HistoryChart({ history }: { history: HistoryPoint[] }) {
  const data = history.map((r) => ({
    time: new Date(r.time).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    Suhu: Number(r.temperature.toFixed(1)),
    Kelembaban: Number(r.humidity.toFixed(1)),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat 24 Jam</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="grid h-[300px] place-items-center text-sm text-muted-foreground">
            Belum ada data 24 jam terakhir
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={data}
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
        )}
      </CardContent>
    </Card>
  );
}
