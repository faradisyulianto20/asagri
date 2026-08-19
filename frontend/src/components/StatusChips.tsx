import type { ReactNode } from "react";
import { Fan, CloudFog, HelpCircle, Activity, Cable, Bug } from "lucide-react";
import type { LatestData } from "../api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChipDef {
  label: string;
  icon?: ReactNode;
  on?: boolean;
  warn?: boolean;
  danger?: boolean;
}

export function StatusChips({ latest }: { latest: LatestData | null }) {
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
      return "h-7 rounded-full border-accent/40 bg-accent/10 px-3 text-accent";
    if (c.on)
      return "h-7 rounded-full border-primary/40 bg-primary/10 px-3 text-primary";
    return "h-7 rounded-full border-border bg-muted/50 px-3 text-muted-foreground";
  };

  const dotClass = (c: ChipDef) => {
    if (c.danger) return "bg-destructive";
    if (c.warn) return "bg-accent";
    if (c.on) return "bg-primary shadow-[0_0_0_4px_rgba(202,219,60,0.15)]";
    return "bg-muted-foreground/50";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Alat</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.map((c) => (
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
