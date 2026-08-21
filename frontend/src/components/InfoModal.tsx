import type { ReactNode } from "react";
import { MessageSquareText, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function InfoBlock({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <div className="space-y-2 text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}

export function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto text-left">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Selamat Datang di Asagri Monitor
          </DialogTitle>
          <DialogDescription>
            Dashboard pemantauan suhu &amp; kelembaban ruangan berbasis ESP32.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <InfoBlock
            icon={<img src="/logo.png" alt="" className="size-4 object-contain" />}
            title="Cara kerja"
          >
            <p>
              ESP32 membaca sensor SHT31 tiap 2 detik, lalu{" "}
              <strong>mengirim data setiap 10 detik</strong> ke server.
              Dashboard ini memperbarui tampilannya{" "}
              <strong>setiap 5 detik</strong>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Kipas nyala saat suhu ≥ 32°C, mati saat ≤ 25°C</li>
              <li>
                Humidifier nyala saat kelembaban ≤ 61%, mati saat ≥ 83%
              </li>
              <li>
                Buzzer berbunyi saat suhu &gt; 40°C atau kelembaban &lt; 50%
              </li>
            </ul>
          </InfoBlock>

          <InfoBlock
            icon={<MessageSquareText className="size-4" />}
            title="Notifikasi WhatsApp"
          >
            <p>
              Saat kondisi berubah, WhatsApp akan mengirim pesan ke nomor-nomor
              yang didaftarkan admin. Isi pesannya:
            </p>
            <ul className="list-disc space-y-1 pl-5">
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
            <p>
              Teks pesan dapat diubah bebas oleh admin di menu{" "}
              <strong>Pengaturan</strong>.
            </p>
          </InfoBlock>

          <InfoBlock
            icon={<Smartphone className="size-4" />}
            title="Hubungkan WhatsApp"
          >
            <p>
              Buka WhatsApp → <em>Menu → Perangkat tertaut → Tautkan perangkat</em>
              , lalu scan QR yang muncul di dashboard. Hanya{" "}
              <strong>satu nomor</strong> yang dapat tertaut sebagai pengirim.
            </p>
          </InfoBlock>

          <div className="flex items-start gap-2 rounded-2xl bg-primary/10 p-4 text-[13px] text-primary">
            <Sparkles className="mt-0.5 size-4 shrink-0" />
            <p>
              Menu <strong>Pengaturan</strong> &amp;{" "}
              <strong>Simulasi</strong> hanya untuk admin (memerlukan
              password).
            </p>
          </div>
        </div>

        <Button
          type="button"
          className="h-10 w-full cursor-pointer"
          onClick={onClose}
        >
          Mulai
        </Button>
      </DialogContent>
    </Dialog>
  );
}
