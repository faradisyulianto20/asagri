import { Droplets } from "lucide-react";
import type { LatestData } from "../api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function HumidityCard({ latest, loading }: { latest: LatestData | null; loading?: boolean }) {
  const value = latest?.available ? latest.humidity : undefined;

  return (
    <Card className="relative flex min-h-[150px] flex-col justify-between overflow-hidden p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-chart-2 to-primary" />
      <div className="flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-xl bg-chart-2/10 text-chart-2">
          <Droplets className="size-5" />
        </span>
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Kelembaban
        </span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      ) : (
        <>
          <div className="font-heading text-5xl font-bold leading-none">
            {value != null ? value.toFixed(1) : "\u2013"}
            <span className="ml-1 text-xl font-medium text-muted-foreground">%</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Kelembaban udara ruangan saat ini
          </div>
        </>
      )}
    </Card>
  );
}
