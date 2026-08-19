import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Leaf,
  LogOut,
  Settings,
  FlaskConical,
  HelpCircle,
  ListChecks,
  LayoutDashboard,
  Sprout,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboardData } from "../hooks/useDashboardData";
import { HumidityCard } from "../components/HumidityCard";
import { TempCard } from "../components/TempCard";
import { StatusChips } from "../components/StatusChips";
import { WaCard } from "../components/WaCard";
import { HistoryChart } from "../components/HistoryChart";
import { QrModal } from "../components/QrModal";
import { InfoModal } from "../components/InfoModal";
import { AdminLogin } from "../components/AdminLogin";
import { AdminSettings } from "../components/AdminSettings";
import { SimulatePage } from "../components/SimulatePage";
import { RequestList } from "../components/RequestList";
import { disconnectWa, fetchMe, logoutAdmin, testWa, TOKEN_KEY, USERNAME_KEY } from "../api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

type Tab = "dashboard" | "requests";

export default function AdminPage() {
  const navigate = useNavigate();
  const { latest, history, wa, notify, thresholds, error, refresh } = useDashboardData();
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(USERNAME_KEY),
  );
  const [tab, setTab] = useState<Tab>("dashboard");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAutoOpened, setQrAutoOpened] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const showQr = Boolean(wa && !wa.connected && wa.qr);

  const clearAuth = useCallback(() => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
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

  const onLoginSuccess = (t: string, name: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USERNAME_KEY, name);
    setToken(t);
    setUsername(name);
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
    toast.success("Berhasil keluar");
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-md shadow-primary/20">
            <Leaf className="size-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Admin Asagri
              </span>
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Login untuk mengelola monitor
            </p>
          </div>
        </header>
        <AdminLogin onSuccess={onLoginSuccess} onClose={() => navigate("/")} />
        <div className="mt-4 text-center">
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Kembali ke beranda
          </Link>
        </div>
        <Toaster position="top-right" richColors closeButton />
      </div>
    );
  }

  const lastUpdate = latest?.available
    ? `Update: ${new Date(latest.created_at as string).toLocaleString("id-ID")}`
    : "Menunggu data…";

  const tabClass = (active: boolean) =>
    `h-8 cursor-pointer rounded-full px-3 text-[13px] font-semibold transition-colors ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

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
                  ? "bg-primary shadow-[0_0_0_4px_rgba(202,219,60,0.15)]"
                  : "bg-accent shadow-[0_0_0_4px_rgba(168,138,236,0.15)]"
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
            onClick={() => setSimulateOpen(true)}
          >
            <FlaskConical />
            Simulasi
          </Button>
          <Button
            variant="outline"
            className="h-8 cursor-pointer rounded-full"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings />
            Pengaturan
          </Button>
          <Link
            to="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <ShieldCheck />
            Beranda
          </Link>
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
        </div>
      </header>

      <nav className="mb-4 flex gap-1 rounded-full bg-muted/60 p-1 sm:w-fit">
        <button
          type="button"
          className={tabClass(tab === "dashboard")}
          onClick={() => setTab("dashboard")}
        >
          <span className="flex items-center gap-1.5">
            <LayoutDashboard className="size-3.5" />
            Dashboard
          </span>
        </button>
        <button
          type="button"
          className={tabClass(tab === "requests")}
          onClick={() => setTab("requests")}
        >
          <span className="flex items-center gap-1.5">
            <ListChecks className="size-3.5" />
            Permintaan Nomor
          </span>
        </button>
      </nav>

      {tab === "requests" ? (
        <RequestList token={token} />
      ) : (
        <>
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
                admin
                onScan={() => setQrOpen(true)}
                onDisconnect={() => disconnectWa(token).then(() => undefined)}
                onTest={() => testWa(token).then(() => undefined)}
              />
            </aside>
          </main>
        </>
      )}

      {qrOpen && showQr && wa?.qr && (
        <QrModal qr={wa.qr} onClose={() => setQrOpen(false)} />
      )}
      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
      {settingsOpen && (
        <AdminSettings token={token} onClose={() => setSettingsOpen(false)} />
      )}
      {simulateOpen && (
        <SimulatePage
          token={token}
          thresholds={thresholds}
          latest={latest}
          onSimulated={() => refresh()}
          onClose={() => setSimulateOpen(false)}
        />
      )}
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
