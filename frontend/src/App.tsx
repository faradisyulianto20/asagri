import { useCallback, useEffect, useState } from "react";
import { Leaf, LogOut, Settings, FlaskConical, HelpCircle, ShieldCheck, Sprout } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-md shadow-primary/20">
            <Leaf className="size-6" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Asagri Monitor
              </span>
            </h1>
            <p className="text-[13px] text-muted-foreground">{lastUpdate}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={`h-8 gap-1.5 rounded-full px-3 ${
              wa?.connected
                ? "bg-primary/10 text-primary"
                : "bg-accent/10 text-accent"
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                wa?.connected
                  ? "bg-primary shadow-[0_0_0_4px_rgba(21,128,61,0.15)]"
                  : "bg-accent shadow-[0_0_0_4px_rgba(161,98,7,0.15)]"
              }`}
            />
            {wa?.connected
              ? "WhatsApp terhubung"
              : "WhatsApp belum terhubung"}
          </Badge>
          <Button
            variant="outline"
            className="h-8 cursor-pointer rounded-full"
            type="button"
            onClick={() => setInfoOpen(true)}
          >
            <HelpCircle />
            Bantuan
          </Button>
          <Button
            variant="outline"
            className="h-8 cursor-pointer rounded-full"
            type="button"
            onClick={() => requireAdmin("settings")}
          >
            <Settings />
            Pengaturan
          </Button>
          <Button
            variant="outline"
            className="h-8 cursor-pointer rounded-full"
            type="button"
            onClick={() => requireAdmin("simulate")}
          >
            <FlaskConical />
            Simulasi
          </Button>
          {username ? (
            <Badge className="h-8 gap-1.5 rounded-full bg-muted px-3 text-foreground">
              <Sprout className="size-3.5 text-primary" />
              Admin: {username}
              <button
                className="flex cursor-pointer items-center gap-1 text-destructive hover:underline"
                type="button"
                onClick={onLogout}
              >
                <LogOut className="size-3.5" />
                Keluar
              </button>
            </Badge>
          ) : (
            <Button
              variant="outline"
              className="h-8 cursor-pointer rounded-full"
              type="button"
              onClick={() => setLoginOpen(true)}
            >
              <ShieldCheck />
              Masuk Admin
            </Button>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground">
          Gagal memuat: {error}
        </div>
      )}

      <main className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:items-start">
        <section className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TempCard latest={latest} />
            <HumidityCard latest={latest} />
          </div>
          <HistoryChart history={history} />
        </section>

        <aside className="grid gap-4">
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
