import { useEffect, useState } from "react";
import { useDashboardData } from "./hooks/useDashboardData";
import { HumidityCard } from "./components/HumidityCard";
import { TempCard } from "./components/TempCard";
import { StatusChips } from "./components/StatusChips";
import { WaCard } from "./components/WaCard";
import { HistoryChart } from "./components/HistoryChart";
import { QrModal } from "./components/QrModal";

export default function App() {
  const { latest, history, wa, error } = useDashboardData();
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAutoOpened, setQrAutoOpened] = useState(false);

  const showQr = Boolean(wa && !wa.connected && wa.qr);

  useEffect(() => {
    if (showQr && !qrAutoOpened) {
      setQrAutoOpened(true);
      setQrOpen(true);
    }
  }, [showQr, qrAutoOpened]);

  const lastUpdate = latest?.available
    ? `Update: ${new Date(latest.created_at as string).toLocaleString("id-ID")}`
    : "Menunggu data…";

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">🌱</div>
          <div>
            <h1 className="gradient-text">Asagri Monitor</h1>
            <p className="sub">{lastUpdate}</p>
          </div>
        </div>
        <div className="header-status">
          <span
            className={`pill ${wa?.connected ? "pill-ok" : "pill-warn"}`}
          >
            <span className="dot" />
            {wa?.connected ? "WhatsApp terhubung" : "WhatsApp belum terhubung"}
          </span>
        </div>
      </header>

      {error && <div className="banner-error">Gagal memuat: {error}</div>}

      <main className="grid">
        <section className="main-col">
          <div className="stats-row">
            <TempCard latest={latest} />
            <HumidityCard latest={latest} />
          </div>
          <div className="card">
            <h2>Riwayat 24 Jam</h2>
            <HistoryChart history={history} />
          </div>
        </section>

        <aside className="side-col">
          <StatusChips latest={latest} />
          <WaCard wa={wa} onScan={() => setQrOpen(true)} />
        </aside>
      </main>

      {qrOpen && showQr && wa?.qr && (
        <QrModal qr={wa.qr} onClose={() => setQrOpen(false)} />
      )}
    </div>
  );
}
