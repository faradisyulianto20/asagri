import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { simulateReading } from "../api";
import type { LatestData, SimulateResult, Thresholds } from "../api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const TEMP_MIN = 20;
const TEMP_MAX = 45;
const HUM_MIN = 40;
const HUM_MAX = 95;

export function SimulatePage({
  token,
  thresholds,
  latest,
  onSimulated,
  onClose,
}: {
  token: string;
  thresholds: Thresholds | null;
  latest: LatestData | null;
  onSimulated?: () => void;
  onClose: () => void;
}) {
  const [temp, setTemp] = useState(30);
  const [hum, setHum] = useState(70);
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const th = thresholds ?? {
    fan_on: 32,
    fan_off: 25,
    humid_on: 61,
    humid_off: 83,
    extreme_temp: 40,
    extreme_humidity: 50,
  };

  const prevFan = latest?.relay_fan ?? false;
  const prevHum = latest?.relay_humidifier ?? false;

  const preview = useMemo(() => {
    const fan = temp >= th.fan_on ? true : temp <= th.fan_off ? false : prevFan;
    const humOn =
      hum <= th.humid_on ? true : hum >= th.humid_off ? false : prevHum;
    const buzzer = temp > th.extreme_temp || hum < th.extreme_humidity;
    return { fan, humOn, buzzer };
  }, [temp, hum, th, prevFan, prevHum]);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await simulateReading(token, temp, hum);
      setResult(r);
      onSimulated?.();
      toast.success(
        `Simulasi terkirim: ${temp.toFixed(1)}°C / ${hum.toFixed(1)}%`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Gagal mengirim simulasi: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const chip = (label: string, on: boolean, danger?: boolean) => (
    <Badge
      className={
        danger
          ? "h-7 rounded-full border-destructive/40 bg-destructive/10 px-3 text-destructive"
          : on
            ? "h-7 rounded-full border-primary/40 bg-primary/10 px-3 text-primary"
            : "h-7 rounded-full border-border bg-muted/50 px-3 text-muted-foreground"
      }
    >
      <span
        className={`size-2 rounded-full ${danger ? "bg-destructive" : on ? "bg-primary shadow-[0_0_0_4px_rgba(21,128,61,0.15)]" : "bg-muted-foreground/50"}`}
      />
      {label}
    </Badge>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Simulasi Paksa</DialogTitle>
          <DialogDescription>
            Kirim suhu &amp; kelembaban palsu ke server untuk menguji ambang dan
            notifikasi WhatsApp (data ditandai "simulasi").
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase">
                Suhu
              </Label>
              <span className="font-heading text-xl font-bold text-primary">
                {temp.toFixed(1)}°C
              </span>
            </div>
            <Slider
              value={[temp]}
              min={TEMP_MIN}
              max={TEMP_MAX}
              step={0.1}
              onValueChange={(v) => setTemp(Array.isArray(v) ? v[0] : v)}
              className="py-3"
            />
            <p className="text-xs text-muted-foreground">
              Rentang {TEMP_MIN}–{TEMP_MAX}°C (batas aman ESP).
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase">
                Kelembaban
              </Label>
              <span className="font-heading text-xl font-bold text-chart-2">
                {hum.toFixed(1)}%
              </span>
            </div>
            <Slider
              value={[hum]}
              min={HUM_MIN}
              max={HUM_MAX}
              step={0.1}
              onValueChange={(v) => setHum(Array.isArray(v) ? v[0] : v)}
              className="py-3"
            />
            <p className="text-xs text-muted-foreground">
              Rentang {HUM_MIN}–{HUM_MAX}% (batas aman ESP).
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Prediksi state (hysteresis ESP)
          </h3>
          <div className="flex flex-wrap gap-2">
            {chip("Kipas", preview.fan)}
            {chip("Humidifier", preview.humOn)}
            {chip("Buzzer", preview.buzzer, preview.buzzer)}
          </div>
        </div>

        {result && (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">
              Hasil terkirim
            </h3>
            <div className="flex flex-wrap gap-2">
              {chip("Kipas", result.relay_fan)}
              {chip("Humidifier", result.relay_humidifier)}
              {chip("Buzzer", result.buzzer, result.buzzer)}
            </div>
            <p className="mt-2 text-xs text-primary">
              Data masuk ke riwayat (sumber: simulasi). Notifikasi WhatsApp
              terkirim hanya jika terjadi perubahan state.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm font-semibold text-destructive">{error}</p>
        )}

        <Button
          type="button"
          className="h-10 w-full cursor-pointer"
          onClick={send}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              Mengirim…
            </>
          ) : (
            <>
              <Send />
              Kirim Paksa
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
