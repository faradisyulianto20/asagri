import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminSettings,
  updateAdminSettings,
} from "../api";
import type { AdminSettings as AdminSettingsData } from "../api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PLACEHOLDER_NUMBERS = ["6281234567890"];

export function AdminSettings({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AdminSettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAdminSettings(token)
      .then((data) => alive && setForm(data))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Gagal memuat pengaturan: ${msg}`);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const set = (key: keyof AdminSettingsData, value: string) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !form) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateAdminSettings(token, {
        whatsapp_to: form.whatsapp_to,
        msg_fan_on: form.msg_fan_on,
        msg_humid_on: form.msg_humid_on,
        msg_extreme: form.msg_extreme,
        cooldown_minutes: form.cooldown_minutes,
      });
      setForm(updated);
      setSaved(true);
      toast.success("Pengaturan tersimpan");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Gagal menyimpan: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  if (!form) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pengaturan Admin</DialogTitle>
            <DialogDescription>
              {error || "Memuat pengaturan…"}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const th = form.thresholds;
  const hasPlaceholder = PLACEHOLDER_NUMBERS.some((n) =>
    form.whatsapp_to.split(",").map((x) => x.trim()).includes(n),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pengaturan Admin</DialogTitle>
          <DialogDescription>
            Pesan notifikasi &amp; daftar penerima WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="whatsapp-to">
              Nomor penerima (pisahkan dengan koma)
            </Label>
            <Textarea
              id="whatsapp-to"
              rows={2}
              value={form.whatsapp_to}
              onChange={(e) => set("whatsapp_to", e.target.value)}
              placeholder="6281111111111, 12036301234567890@g.us"
            />
            <p className="text-xs text-muted-foreground">
              Format internasional tanpa tanda + dan tanpa awalan 0. Bisa
              ditambah ID group (…@g.us) — group juga bisa didaftarkan user lewat
              link undangan di beranda.
            </p>
            {hasPlaceholder && (
              <p className="text-xs font-semibold text-destructive">
                ⚠️ Masih ada nomor default/placeholder (6281234567890). Ganti
                dengan nomor WhatsApp asli agar notifikasi sampai.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="msg-fan-on">Pesan kipas menyala</Label>
            <Textarea
              id="msg-fan-on"
              rows={3}
              value={form.msg_fan_on}
              onChange={(e) => set("msg_fan_on", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Bisa pakai placeholder: {"{temperature}"} dan {"{threshold}"}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="msg-humid-on">Pesan humidifier menyala</Label>
            <Textarea
              id="msg-humid-on"
              rows={3}
              value={form.msg_humid_on}
              onChange={(e) => set("msg_humid_on", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Bisa pakai placeholder: {"{humidity}"} dan {"{threshold}"}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="msg-extreme">Pesan kondisi ekstrem</Label>
            <Textarea
              id="msg-extreme"
              rows={3}
              value={form.msg_extreme}
              onChange={(e) => set("msg_extreme", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Bisa pakai placeholder: {"{temperature}"} dan {"{humidity}"}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cooldown-minutes">Jeda antar notifikasi (menit)</Label>
            <Input
              id="cooldown-minutes"
              type="number"
              min={0}
              step={1}
              className="h-10"
              value={form.cooldown_minutes}
              onChange={(e) => set("cooldown_minutes", e.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Ambang tetap (dari ESP32)
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-[13px]">
              <li>
                Kipas: ON saat ≥ {th.fan_on}°C, OFF saat ≤ {th.fan_off}°C
              </li>
              <li>
                Humidifier: ON saat ≤ {th.humid_on}%, OFF saat ≥{" "}
                {th.humid_off}%
              </li>
              <li>
                Ekstrem: suhu &gt; {th.extreme_temp}°C atau kelembaban &lt;{" "}
                {th.extreme_humidity}%
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Ambang dikendalikan firmware ESP32 dan tidak dapat diubah dari
              sini.
            </p>
          </div>

          {error && (
            <p className="text-sm font-semibold text-destructive">{error}</p>
          )}
          {saved && (
            <p className="text-sm font-semibold text-primary">
              Pengaturan tersimpan ✓
            </p>
          )}

          <Button
            type="submit"
            className="h-10 w-full cursor-pointer"
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" />
                Menyimpan…
              </>
            ) : (
              <>
                <Save />
                Simpan
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
