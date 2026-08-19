import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Leaf, HelpCircle, ShieldCheck } from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";
import { HumidityCard } from "../components/HumidityCard";
import { TempCard } from "../components/TempCard";
import { StatusChips } from "../components/StatusChips";
import { HistoryChart } from "../components/HistoryChart";
import { InfoModal } from "../components/InfoModal";
import { RegisterNumberCard } from "../components/RegisterNumberCard";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export default function UserPage() {
  const { latest, history, error } = useDashboardData();
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("asagri_info_seen")) {
      setInfoOpen(true);
    }
  }, []);

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
          <Button
            variant="outline"
            className="h-8 cursor-pointer rounded-full"
            type="button"
            onClick={() => setInfoOpen(true)}
          >
            <HelpCircle />
            Bantuan
          </Button>
          <Link
            to="/admin"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <ShieldCheck />
            Masuk Admin
          </Link>
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
          <RegisterNumberCard />
        </aside>
      </main>

      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
