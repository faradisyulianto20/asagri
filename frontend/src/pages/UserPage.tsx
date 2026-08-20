import { Link } from "react-router-dom";
import { Leaf, ShieldCheck } from "lucide-react";
import { useDashboardData } from "../hooks/useDashboardData";
import { HumidityCard } from "../components/HumidityCard";
import { TempCard } from "../components/TempCard";
import { StatusChips } from "../components/StatusChips";
import { HistoryChart } from "../components/HistoryChart";
import { RegisterNumberCard } from "../components/RegisterNumberCard";
import { InlineHelp } from "../components/InlineHelp";
import { Toaster } from "@/components/ui/sonner";

export default function UserPage() {
  const { latest, history, error } = useDashboardData();

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

        <Link
          to="/admin"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ShieldCheck />
          Masuk Admin
        </Link>
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
          <InlineHelp title="Cara kerja sensor &amp; perangkat">
            <p>
              ESP32 membaca sensor SHT31 tiap 2 detik, lalu{" "}
              <strong>mengirim data setiap 10 detik</strong> ke server.
              Dashboard ini memperbarui tampilannya{" "}
              <strong>setiap 5 detik</strong>.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Kipas nyala saat suhu ≥ 32°C, mati saat ≤ 25°C</li>
              <li>
                Humidifier nyala saat kelembaban ≤ 61%, mati saat ≥ 83%
              </li>
              <li>
                Buzzer berbunyi saat suhu &gt; 40°C atau kelembaban &lt; 50%
              </li>
            </ul>
          </InlineHelp>

          <HistoryChart history={history} />
          <InlineHelp title="Tentang grafik riwayat 24 jam">
            <p>
              Grafik menampilkan riwayat suhu &amp; kelembaban selama 24 jam
              terakhir. Garis{" "}
              <span className="font-semibold text-foreground">kiri (suhu)</span>{" "}
              dan{" "}
              <span className="font-semibold text-foreground">
                kanan (kelembaban)
              </span>{" "}
              diperbarui otomatis saat data baru masuk dari ESP32.
            </p>
          </InlineHelp>
        </section>

        <aside className="grid gap-4">
          <StatusChips latest={latest} />
          <InlineHelp title="Tentang status alat">
            <p>
              Setiap badge menunjukkan kondisi terkini relay, buzzer, dan sensor
              dari ESP32:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Hijau</strong> — aktif (kipas/humidifier menyala)
              </li>
              <li>
                <strong>Kuning</strong> — peringatan (sensor error / data
                simulasi)
              </li>
              <li>
                <strong>Merah</strong> — danger (buzzer berbunyi)
              </li>
              <li>
                <strong>Abu-abu</strong> — tidak aktif
              </li>
            </ul>
          </InlineHelp>

          <RegisterNumberCard />
          <InlineHelp title="Cara mendaftarkan WhatsApp">
            <p>
              <strong>1. Hubungkan WhatsApp pengirim</strong> — Buka WhatsApp →{" "}
              <em>Menu → Perangkat tertaut → Tautkan perangkat</em>, lalu scan
              QR yang muncul di dashboard. Hanya{" "}
              <strong>satu nomor</strong> yang dapat tertaut sebagai pengirim.
            </p>
            <p className="mt-2">
              <strong>2. Daftarkan nomor / group penerima</strong> — Isi formulir
              di atas dengan nama dan nomor WhatsApp (format internasional tanpa
              +) atau link undangan group. Permintaan akan diverifikasi admin
              sebelum aktif.
            </p>
            <p className="mt-2">
              <strong>3. Cek status pendaftaran</strong> — Tab "Cek Status"
              untuk melihat apakah nomor/group sudah disetujui, masih menunggu,
              atau ditolak.
            </p>
            <p className="mt-2">
              <strong>Jenis notifikasi</strong> yang dikirim:
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                <strong>Kipas nyala</strong> — suhu melebihi ambang, kipas
                dinyalakan otomatis.
              </li>
              <li>
                <strong>Humidifier nyala</strong> — kelembaban di bawah ambang,
                humidifier dinyalakan otomatis.
              </li>
              <li>
                <strong>Peringatan ekstrem</strong> — suhu/kelembaban di luar
                batas aman, segera periksa ruangan.
              </li>
            </ul>
          </InlineHelp>
        </aside>
      </main>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
