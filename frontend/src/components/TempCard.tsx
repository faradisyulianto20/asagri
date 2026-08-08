import { Thermometer } from "lucide-react";
import type { LatestData } from "../api";
import { Card } from "@/components/ui/card";

export function TempCard({ latest }: { latest: LatestData | null }) {
  const value = latest?.available ? latest.temperature : undefined;
  return (
    <Card className="relative flex min-h-[150px] flex-col justify-between overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-secondary" />
      <div className="flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Thermometer className="size-5" />
        </span>
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Suhu
        </span>
      </div>
      <div className="font-heading text-5xl font-bold leading-none">
        {value != null ? value.toFixed(1) : "–"}
        <span className="ml-1 text-xl font-medium text-muted-foreground">
          °C
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        Suhu udara ruangan saat ini
      </div>
    </Card>
  );
}
