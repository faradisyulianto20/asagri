import { useCallback, useEffect, useState } from "react";
import { useDashboardData } from "./hooks/useDashboardData";
import { HumidityCard } from "./components/HumidityCard";
import { TempCard } from "./components/TempCard";
import { StatusChips } from "./components/StatusChips";
import { WaCard } from "./components/WaCard";
import { HistoryChart } from "./components/HistoryChart";
import { QrModal } from "./components/QrModal";
import { InfoModal } from "./components/InfoModal";
import { AdminLogin } from "./components/AdminLogin";
import { AdminSettings } from "./components/AdminSettings";
import { SimulatePage } from "./components/SimulatePage";
import { disconnectWa, fetchMe, logoutAdmin, testWa, TOKEN_KEY, USERNAME_KEY } from "./api";

type AdminAction = "settings" | "simulate" | "disconnect" | "test";

export default function App() {
  const { latest, history, wa, notify, thresholds, error } = useDashboardData();
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAutoOpened, setQrAutoOpened] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(USERNAME_KEY),
  );
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<AdminAction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);

  const showQr = Boolean(wa && !wa.connected && wa.qr);

  const clearAuth = useCallback(() => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("asagri_info_seen")) {
      setInfoOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("asagri:unauthorized", clearAuth);
    return () => window.removeEventListener("asagri:unauthorized", clearAuth);
  }, [clearAuth]);

  useEffect(() => {
    if (token) {
      fetchMe(token)
        .then((me) => {
          setUsername(me.username);
          localStorage.setItem(USERNAME_KEY, me.username);
        })
        .catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    if (showQr && !qrAutoOpened) {
      setQrAutoOpened(true);
      setQrOpen(true);
    }
  }, [showQr, qrAutoOpened]);

  useEffect(() => {
    if (wa?.connected && qrAutoOpened) {
      setQrAutoOpened(false);
      setQrOpen(false);
    }
  }, [wa?.connected, qrAutoOpened]);

  const closeInfo = () => {
    localStorage.setItem("asagri_info_seen", "1");
    setInfoOpen(false);
  };

  const runAdminAction = (action: AdminAction): Promise<void> => {
    if (action === "settings") {
      setSettingsOpen(true);
      return Promise.resolve();
    }
    if (action === "simulate") {
      setSimulateOpen(true);
      return Promise.resolve();
    }
    if (!token) return Promise.reject(new Error("Perlu login admin"));
    if (action === "disconnect") return disconnectWa(token).then(() => undefined);
    return testWa(token).then(() => undefined);
  };

  const requireAdmin = (action: AdminAction): Promise<void> => {
    if (token) return runAdminAction(action);
    setPendingAction(action);
    setLoginOpen(true);
    return Promise.resolve();
  };

  const onLoginSuccess = (t: string, name: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USERNAME_KEY, name);
    setToken(t);
    setUsername(name);
    setLoginOpen(false);
    if (pendingAction) {
      void runAdminAction(pendingAction);
      setPendingAction(null);
    }
  };

  const onLogout = async () => {
    if (token) {
      try {
        await logoutAdmin(token);
      } catch {
        /* tetap logout lokal */
      }
    }
    clearAuth();
  };

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
        <div className="header-actions">
          <span
            className={`pill ${wa?.connected ? "pill-ok" : "pill-warn"}`}
          >
            <span className="dot" />
            {wa?.connected ? "WhatsApp terhubung" : "WhatsApp belum terhubung"}
          </span>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setInfoOpen(true)}
          >
            Bantuan
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => requireAdmin("settings")}
          >
            Pengaturan
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => requireAdmin("simulate")}
          >
            Simulasi
          </button>
          {username ? (
            <span className="admin-user">
              Admin: {username}
              <button className="link-btn" type="button" onClick={onLogout}>
                Keluar
              </button>
            </span>
          ) : (
            <button
              className="btn-ghost"
              type="button"
              onClick={() => setLoginOpen(true)}
            >
              Masuk Admin
            </button>
          )}
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
          <WaCard
            wa={wa}
            notify={notify}
            admin={Boolean(token)}
            onScan={() => setQrOpen(true)}
            onDisconnect={() => requireAdmin("disconnect")}
            onTest={() => requireAdmin("test")}
          />
        </aside>
      </main>

      {qrOpen && showQr && wa?.qr && (
        <QrModal qr={wa.qr} onClose={() => setQrOpen(false)} />
      )}
      {infoOpen && <InfoModal onClose={closeInfo} />}
      {loginOpen && (
        <AdminLogin
          onSuccess={onLoginSuccess}
          onClose={() => {
            setLoginOpen(false);
            setPendingAction(null);
          }}
        />
      )}
      {settingsOpen && token && (
        <AdminSettings token={token} onClose={() => setSettingsOpen(false)} />
      )}
      {simulateOpen && token && (
        <SimulatePage
          token={token}
          thresholds={thresholds}
          latest={latest}
          onClose={() => setSimulateOpen(false)}
        />
      )}
    </div>
  );
}
