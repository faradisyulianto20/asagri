import type { LatestData } from "../api";

interface ChipDef {
  label: string;
  on?: boolean;
  warn?: boolean;
  danger?: boolean;
}

export function StatusChips({ latest }: { latest: LatestData | null }) {
  const items: ChipDef[] = [
    { label: "Kipas", on: latest?.relay_fan },
    { label: "Humidifier", on: latest?.relay_humidifier },
    { label: "Relay 3", on: latest?.relay_3 },
    { label: "Relay 4", on: latest?.relay_4 },
    { label: "Buzzer", danger: latest?.buzzer },
    { label: "Sensor Error", warn: latest?.sensor_error },
  ];

  return (
    <div className="card">
      <h2>Status Alat</h2>
      <div className="chips">
        {items.map((c) => (
          <span
            key={c.label}
            className={`chip ${c.on ? "on" : ""} ${c.warn ? "warn" : ""} ${c.danger ? "danger" : ""}`}
          >
            <span className="dot" />
            {c.label}
          </span>
        ))}
      </div>
      <p className="hint">Status relay, buzzer &amp; sensor dari ESP32.</p>
    </div>
  );
}
