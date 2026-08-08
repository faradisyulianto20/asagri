import type { WaStatus } from "../api";

export function WaCard({
  wa,
  onScan,
}: {
  wa: WaStatus | null;
  onScan: () => void;
}) {
  const connected = Boolean(wa?.connected);
  const detail = connected
    ? wa?.number
      ? `Nomor: ${wa.number}`
      : "Gateway terhubung"
    : wa?.error || "Scan QR untuk menghubungkan";

  const badge = connected
    ? "Terhubung"
    : wa?.starting
      ? "Menghubungi…"
      : "Belum terhubung";

  return (
    <div className="card wa">
      <div className="wa-head">
        <div>
          <h2>WhatsApp Gateway</h2>
          <p className="wa-detail">{detail}</p>
        </div>
        <span className={`badge ${connected ? "badge-ok" : "badge-warn"}`}>
          {badge}
        </span>
      </div>
      {!connected && (
        <button className="btn" type="button" onClick={onScan}>
          Tampilkan QR
        </button>
      )}
    </div>
  );
}
