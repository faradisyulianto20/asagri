import type { ReactNode } from "react";
import { Fan, CloudFog, HelpCircle, Activity, Cable, Bug } from "lucide-react";
import type { LatestData } from "../api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ChipDef {
  label: string;
  icon?: ReactNode;
  on?: boolean;
  warn?: boolean;
  danger?: boolean;
}

export function StatusChips({ latest, loading }: { latest: LatestData | null; loading?: boolean }) {
  const items: ChipDef[] = [
    { label: "Kipas", icon: <Fan />, on: latest?.relay_fan },
    { label: "Humidifier", icon: <CloudFog />, on: latest?.relay_humidifier },
    { label: "Relay 3", icon: <Activity />, on: latest?.relay_3 },
    { label: "Relay 4", icon: <Activity />, on: latest?.relay_4 },
    { label: "Buzzer", icon: <Bug />, danger: latest?.buzzer },
    { label: "Sensor Error", icon: <Cable />, warn: latest?.sensor_error },
    { label: "Data Simulasi", icon: <HelpCircle />, warn: latest?.source === "simulasi" },
  ];

  const badgeClass = (c: ChipDef) => {
    if (c.danger)
      return "h-7 rounded-full border-destructive/40 bg-destructive/10 px-3 text-destructive";
    if (c.warn)
      return "h-7 rounded-full border-warning/40 bg-warning/10 px-3 text-warning";
    if (c.on)
      return "h-7 rounded-full border-primary/40 bg-primary/10 px-3 text-primary";
    return "h-7 rounded-full border-border bg-muted/50 px-3 text-muted-foreground";
  };

  const dotClass = (c: ChipDef) => {
    if (c.danger) return "bg-destructive";
    if (c.warn) return "bg-warning";
    if (c.on) return "bg-primary ring-[3px] ring-primary/20";
    return "bg-muted-foreground/50";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Alat</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))
          : items.map((c) => (
              <Badge key={c.label} className={badgeClass(c)}>
                <span className={`size-2 rounded-full ${dotClass(c)}`} />
                {c.icon}
                {c.label}
              </Badge>
            ))}
      </CardContent>
      <div className="px-6 pb-4 text-xs text-muted-foreground">
        Status relay, buzzer &amp; sensor dari ESP32.
      </div>
    </Card>
  );
}
