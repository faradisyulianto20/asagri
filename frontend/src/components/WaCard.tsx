import { useState } from "react";
import type { NotifyStatus, WaStatus } from "../api";

export function WaCard({
  wa,
  notify,
  admin,
  onScan,
  onDisconnect,
  onTest,
}: {
  wa: WaStatus | null;
  notify: NotifyStatus | null;
  admin: boolean;
  onScan: () => void;
  onDisconnect: () => Promise<void>;
  onTest: () => Promise<void>;
}) {
  const connected = Boolean(wa?.connected);
  const [busy, setBusy] = useState<"test" | "disconnect" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const last = notify?.last;
  const lastText = last
    ? `${last.ok ? "Terkirim ✓" : `Gagal: ${last.error || "error"}`} · ${
        last.to?.length || 0
      } nomor · ${new Date(last.at).toLocaleTimeString("id-ID")}`
    : "Belum ada pengiriman tercatat";

  const run = async (kind: "test" | "disconnect") => {
    if (busy) return;
    setBusy(kind);
    setFeedback(null);
    try {
      if (kind === "test") {
        await onTest();
        if (admin) setFeedback("Pesan uji dikirim.");
      } else {
        await onDisconnect();
        if (admin) setFeedback("Diputus, QR baru akan muncul…");
      }
    } catch (e) {
      setFeedback(
        admin
          ? e instanceof Error
            ? e.message
            : "Aksi gagal"
          : "Perlu login admin",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card wa">
      <div className="wa-head">
        <div>
          <h2>WhatsApp Gateway</h2>
          <p className="wa-detail">{detail}</p>
          <p className={`wa-detail ${last && !last.ok ? "delivery-err" : ""}`}>
            Notifikasi terakhir: {lastText}
          </p>
        </div>
        <span className={`badge ${connected ? "badge-ok" : "badge-warn"}`}>
          {badge}
        </span>
      </div>
      {connected ? (
        <div className="wa-actions">
          <button
            className="btn"
            type="button"
            onClick={() => run("test")}
            disabled={busy !== null}
          >
            {busy === "test" ? "Mengirim…" : "Kirim Pesan Uji"}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => run("disconnect")}
            disabled={busy !== null}
          >
            {busy === "disconnect" ? "Memutus…" : "Putuskan & Ganti Nomor"}
          </button>
        </div>
      ) : (
        <button className="btn" type="button" onClick={onScan}>
          Tampilkan QR
        </button>
      )}
      {feedback && <p className="wa-feedback">{feedback}</p>}
    </div>
  );
}
