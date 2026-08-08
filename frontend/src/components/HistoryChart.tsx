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

export function HistoryChart({ history }: { history: HistoryPoint[] }) {
  const data = history.map((r) => ({
    time: new Date(r.time).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    Suhu: Number(r.temperature.toFixed(1)),
    Kelembaban: Number(r.humidity.toFixed(1)),
  }));

  if (data.length === 0) {
    return <div className="chart-empty">Belum ada data 24 jam terakhir</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ece4c8" />
        <XAxis
          dataKey="time"
          tick={{ fill: "#8a8f7c", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "#a4b416", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={42}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fill: "#a88aed", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={42}
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #ece4c8",
            borderRadius: 12,
            fontFamily: "Poppins, sans-serif",
            fontSize: 12,
          }}
          labelStyle={{ color: "#26312e", fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#26312e" }} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="Suhu"
          stroke="#a4b416"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="Kelembaban"
          stroke="#a88aed"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
