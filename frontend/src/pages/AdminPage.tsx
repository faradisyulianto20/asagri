import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FlaskConical, Menu } from "lucide-react";
import { toast } from "sonner";
import { useDashboardData } from "../hooks/useDashboardData";
import { useWaRequests } from "../hooks/useWaRequests";
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
import { AdminSidebar, type SidebarTab } from "../components/AdminSidebar";
import { AnalyticsPanel } from "../components/AnalyticsPanel";
import { disconnectWa, fetchMe, logoutAdmin, testWa, TOKEN_KEY, USERNAME_KEY } from "../api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export default function AdminPage() {
  const navigate = useNavigate();
  const { latest, history, wa, notify, thresholds, error, loading, refresh } = useDashboardData();
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(USERNAME_KEY),
  );
  const [tab, setTab] = useState<SidebarTab>("dashboard");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAutoOpened, setQrAutoOpened] = useState(false);

  const [simulateOpen, setSimulateOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const waRequests = useWaRequests(token);
  const pendingRequestCount =
    waRequests.requests?.filter((r) => r.status === "pending").length ?? 0;

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

  /* ── Sidebar drawer: Escape close, scroll lock, auto-close di desktop ── */
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = prevOverflow;
    };
  }, [sidebarOpen]);

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

  /* ── Login screen ── */
  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <header className="mb-6 flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo Asagri"
            className="size-12 rounded-2xl object-cover shadow-md shadow-primary/20"
          />
          <div>
            <h1 className="font-heading text-xl font-extrabold tracking-tight text-foreground">
              Admin Asagri
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

  const handleNavigate = (t: SidebarTab) => {
    if (t === "help") {
      setInfoOpen(true);
    } else {
      setTab(t);
    }
  };

  /* ── Tab title for header ── */
  const tabTitles: Record<SidebarTab, string> = {
    dashboard: "Dashboard",
    analytics: "Analytics",
    devices: "Devices",
    notifications: "Notifications",
    settings: "Settings",
    help: "Help Center",
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar
        active={tab}
        onNavigate={handleNavigate}
        username={username ?? "admin"}
        onLogout={onLogout}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        notificationCount={pendingRequestCount}
      />

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label="Buka menu navigasi"
              className="h-9 w-9 shrink-0 cursor-pointer rounded-xl lg:hidden"
              type="button"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                {tabTitles[tab]}
              </h2>
              <p className="text-[12px] text-muted-foreground">{lastUpdate}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={`h-8 gap-1.5 rounded-full px-3 ${
                wa?.connected
                  ? "bg-success/10 text-success"
                  : wa?.starting
                    ? "bg-info/10 text-info"
                    : wa?.error
                      ? "bg-destructive/10 text-destructive"
                      : "bg-warning/10 text-warning"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  wa?.connected
                    ? "bg-success ring-[3px] ring-success/20"
                    : wa?.starting
                      ? "bg-info ring-[3px] ring-info/20"
                      : wa?.error
                        ? "bg-destructive ring-[3px] ring-destructive/20"
                        : "bg-warning ring-[3px] ring-warning/20"
                }`}
              />
              {wa?.connected
                ? "WhatsApp terhubung"
                : wa?.starting
                  ? "Menghubungi…"
                  : wa?.error
                    ? "WhatsApp error"
                    : "WhatsApp terputus"}
            </Badge>
            <Button
              variant="outline"
              className="h-8 cursor-pointer rounded-full"
              type="button"
              onClick={() => setSimulateOpen(true)}
            >
              <FlaskConical />
              Simulasi
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground">
              Gagal memuat: {error}
            </div>
          )}

          {/* Dashboard Tab */}
          {tab === "dashboard" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:items-start">
              <section className="grid gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TempCard latest={latest} loading={loading} />
                  <HumidityCard latest={latest} loading={loading} />
                </div>
                <HistoryChart />
              </section>

              <aside className="grid gap-4">
                <StatusChips latest={latest} loading={loading} />
                <WaCard
                  wa={wa}
                  notify={notify}
                  admin
                  onScan={() => setQrOpen(true)}
                  onDisconnect={() => disconnectWa(token).then(() => undefined)}
                  onTest={() => testWa(token).then(() => undefined)}
                />
              </aside>
            </div>
          )}

          {/* Analytics Tab */}
          {tab === "analytics" && <AnalyticsPanel history={history} />}

          {/* Devices Tab */}
          {tab === "devices" && (
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <StatusChips latest={latest} loading={loading} />
              <WaCard
                wa={wa}
                notify={notify}
                admin
                onScan={() => setQrOpen(true)}
                onDisconnect={() => disconnectWa(token).then(() => undefined)}
                onTest={() => testWa(token).then(() => undefined)}
              />
            </div>
          )}

          {/* Notifications Tab */}
          {tab === "notifications" && (
            <div className="grid gap-4">
              <RequestList
                token={token}
                requests={waRequests.requests}
                error={waRequests.error}
                loading={waRequests.loading}
                reload={waRequests.reload}
              />
            </div>
          )}

          {/* Settings Tab */}
          {tab === "settings" && <AdminSettings token={token} />}
        </div>
      </div>

      {/* Modals */}
      {qrOpen && showQr && wa?.qr && (
        <QrModal qr={wa.qr} onClose={() => setQrOpen(false)} />
      )}
      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
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
