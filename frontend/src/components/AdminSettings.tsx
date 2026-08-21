import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Plus, Save, Settings, X } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminSettings,
  updateAdminSettings,
} from "../api";
import type { AdminSettings as AdminSettingsData } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PLACEHOLDER_NUMBERS = ["6281234567890"];

export function AdminSettings({ token }: { token: string }) {
  const [form, setForm] = useState<AdminSettingsData | null>(null);
  const [numbers, setNumbers] = useState<string[]>([]);
  const [numberInput, setNumberInput] = useState("");
  const [numberError, setNumberError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(id);
  }, [saved]);

  useEffect(() => {
    let alive = true;
    fetchAdminSettings(token)
      .then((data) => {
        if (!alive) return;
        setForm(data);
        setNumbers(
          data.whatsapp_to.split(",").map((x) => x.trim()).filter(Boolean),
        );
      })
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
        cooldown_minutes: String(Number(form.cooldown_minutes) || 0),
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            Pengaturan Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error || "Memuat pengaturan…"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const th = form.thresholds;
  const phoneNumbers = numbers.filter((n) => !n.endsWith("@g.us"));
  const groupIds = numbers.filter((n) => n.endsWith("@g.us"));
  const hasPlaceholder = PLACEHOLDER_NUMBERS.some((n) => numbers.includes(n));

  const syncNumbers = (next: string[]) => {
    setNumbers(next);
    set("whatsapp_to", next.join(", "));
  };

  const pushNumbers = (raw: string): boolean => {
    const parts = raw.split(",").map((x) => x.trim()).filter(Boolean);
    if (parts.length === 0) return true;
    const next = [...numbers];
    let err: string | null = null;
    for (const p of parts) {
      if (!/^\d+$/.test(p) && !p.endsWith("@g.us")) {
        err = "Format tidak valid: gunakan angka internasional tanpa tanda +, atau ID group berakhiran @g.us";
        continue;
      }
      if (next.includes(p)) {
        err = `${p} sudah terdaftar`;
        continue;
      }
      next.push(p);
    }
    setNumberError(err);
    if (next.length > numbers.length) syncNumbers(next);
    return err === null;
  };

  const handleNumberInput = (value: string) => {
    const commaIdx = value.lastIndexOf(",");
    if (commaIdx === -1) {
      setNumberInput(value);
      if (numberError) setNumberError(null);
      return;
    }
    pushNumbers(value.slice(0, commaIdx));
    setNumberInput(value.slice(commaIdx + 1));
  };

  const commitNumberInput = () => {
    if (!numberInput.trim()) return;
    if (pushNumbers(numberInput)) setNumberInput("");
  };

  const removeNumber = (n: string) => {
    syncNumbers(numbers.filter((x) => x !== n));
    if (numberError) setNumberError(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />
            Pengaturan Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="whatsapp-number">Nomor penerima WhatsApp</Label>
              {phoneNumbers.length > 0 && (
                <div className="grid gap-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Nomor HP · {phoneNumbers.length}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {phoneNumbers.map((n) => (
                      <span
                        key={n}
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-3 pr-1.5 text-xs font-medium text-foreground"
                      >
                        {n}
                        <button
                          type="button"
                          aria-label={`Hapus ${n}`}
                          className="grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeNumber(n)}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {groupIds.length > 0 && (
                <div className="grid gap-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Group WhatsApp · {groupIds.length}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {groupIds.map((n) => (
                      <span
                        key={n}
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-3 pr-1.5 text-xs font-medium text-foreground"
                      >
                        {n}
                        <button
                          type="button"
                          aria-label={`Hapus ${n}`}
                          className="grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeNumber(n)}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  id="whatsapp-number"
                  className="h-10 flex-1"
                  value={numberInput}
                  aria-invalid={numberError !== null}
                  placeholder="6281111111111 atau 12036301234567890@g.us"
                  onChange={(e) => handleNumberInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitNumberInput();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Tambah nomor"
                  className="h-10 w-10 shrink-0 cursor-pointer p-0"
                  onClick={commitNumberInput}
                >
                  <Plus />
                </Button>
              </div>
              {numberError && (
                <p className="text-xs font-semibold text-destructive">
                  {numberError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Format internasional tanpa tanda + dan tanpa awalan 0. Bisa
                ditambah ID group (…@g.us) — group juga bisa didaftarkan user
                lewat link undangan di beranda.
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
              <Label htmlFor="cooldown-minutes">
                Jeda antar notifikasi (menit)
              </Label>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ambang Tetap (dari ESP32)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-[13px]">
            <li>
              Kipas: ON saat ≥ {th.fan_on}°C, OFF saat ≤ {th.fan_off}°C
            </li>
            <li>
              Humidifier: ON saat ≤ {th.humid_on}%, OFF saat ≥ {th.humid_off}%
            </li>
            <li>
              Ekstrem: suhu &gt; {th.extreme_temp}°C atau kelembaban &lt;{" "}
              {th.extreme_humidity}%
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Ambang dikendalikan firmware ESP32 dan tidak dapat diubah dari
            sini.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
