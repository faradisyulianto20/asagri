import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { HumidityCard } from "../components/HumidityCard";
import { TempCard } from "../components/TempCard";
import { StatusChips } from "../components/StatusChips";
import { HistoryChart } from "../components/HistoryChart";
import { RegisterNumberCard } from "../components/RegisterNumberCard";
import { CoachmarkTour, type TourStep } from "../components/CoachmarkTour";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

const TOUR_KEY = "asagri_tour_seen";

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='sensors']",
    title: "Suhu & Kelembaban",
    placement: "bottom",
    content: (
      <>
        <p>
          Dua kartu ini menampilkan kondisi <strong>aktuál</strong> ruangan.
          Data dikirim oleh ESP32 setiap 10 detik dan dashboard memperbaruinya
          setiap 5 detik.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Kipas</strong> otomatis nyala saat suhu ≥ 32°C, mati saat ≤ 25°C</li>
          <li><strong>Humidifier</strong> otomatis nyala saat kelembaban ≤ 61%, mati saat ≥ 83%</li>
          <li><strong>Buzzer</strong> berbunyi saat suhu &gt; 40°C atau kelembaban &lt; 50%</li>
        </ul>
      </>
    ),
  },
  {
    target: "[data-tour='chart']",
    title: "Grafik Riwayat 24 Jam",
    placement: "top",
    content: (
      <p>
        Grafik garis menampilkan riwayat <strong>suhu</strong> (garis kiri) dan{" "}
        <strong>kelembaban</strong> (garis kanan) selama 24 jam terakhir.
        Data diperbarui otomatis saat ada pembacaan baru dari sensor.
      </p>
    ),
  },
  {
    target: "[data-tour='status']",
    title: "Status Alat",
    placement: "left",
    content: (
      <>
        <p>
          Badge menunjukkan kondisi terkini relay, buzzer, dan sensor dari ESP32:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong className="text-primary">Ungu</strong> — aktif (kipas/humidifier menyala)</li>
          <li><strong className="text-warning">Kuning/amber</strong> — peringatan (sensor error / data simulasi)</li>
          <li><strong className="text-destructive">Merah</strong> — danger (buzzer berbunyi)</li>
          <li><strong>Abu-abu</strong> — tidak aktif</li>
        </ul>
      </>
    ),
  },
  {
    target: "[data-tour='register']",
    title: "Daftarkan Penerima Notifikasi",
    placement: "left",
    content: (
      <>
        <p>
          Di sini Anda bisa <strong>mendaftarkan nomor WhatsApp</strong> atau{" "}
          <strong>group</strong> untuk menerima notifikasi otomatis saat kondisi
          berubah.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Isi nama dan nomor (format internasional tanpa +) atau link undangan group</li>
          <li>Admin akan memverifikasi sebelum notifikasi aktif</li>
          <li>Gunakan tab "Cek Status" untuk melihat progress pendaftaran</li>
        </ul>
        <p className="mt-2">
          Notifikasi mencakup: kipas menyala, humidifier menyala, dan
          peringatan kondisi ekstrem.
        </p>
      </>
    ),
  },
];

export default function UserPage() {
  useDocumentTitle();
  const { latest, error, loading } = useDashboardData();
  const [tourActive, setTourActive] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setTourActive(true);
    }
  }, []);

  const closeTour = () => {
    setTourActive(false);
    localStorage.setItem(TOUR_KEY, "1");
  };

  const lastUpdate = latest?.available
    ? `Update: ${new Date(latest.created_at as string).toLocaleString("id-ID")}`
    : "Menunggu data…";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo Asagri"
            className="size-12 rounded-2xl object-cover shadow-md shadow-primary/20"
          />
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Asagri Monitor
            </h1>
            <p className="text-[13px] text-muted-foreground">{lastUpdate}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Bantuan"
            title="Bantuan"
            className="size-8 cursor-pointer rounded-full border-border bg-white shadow-sm hover:bg-muted"
            type="button"
            onClick={() => {
              setTourActive(true);
            }}
          >
            <HelpCircle />
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground">
          Gagal memuat: {error}
        </div>
      )}

      <main className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:items-start">
        <section className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-tour="sensors">
            <TempCard latest={latest} loading={loading} />
            <HumidityCard latest={latest} loading={loading} />
          </div>

          <div data-tour="chart">
            <HistoryChart />
          </div>
        </section>

        <aside className="grid gap-4">
          <div data-tour="status">
            <StatusChips latest={latest} loading={loading} />
          </div>

          <div data-tour="register">
            <RegisterNumberCard />
          </div>
        </aside>
      </main>

      <CoachmarkTour
        steps={TOUR_STEPS}
        active={tourActive}
        onClose={closeTour}
      />
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
