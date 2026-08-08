import { useMemo, useState } from "react";
import { simulateReading } from "../api";
import type { LatestData, SimulateResult, Thresholds } from "../api";

const TEMP_MIN = 20;
const TEMP_MAX = 45;
const HUM_MIN = 40;
const HUM_MAX = 95;

export function SimulatePage({
  token,
  thresholds,
  latest,
  onClose,
}: {
  token: string;
  thresholds: Thresholds | null;
  latest: LatestData | null;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const chip = (label: string, on: boolean, danger?: boolean) => (
    <span className={`chip ${on ? "on" : ""} ${danger ? "danger" : ""}`}>
      <span className="dot" />
      {label}
    </span>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Tutup"
        >
          ✕
        </button>
        <h2>Simulasi Paksa</h2>
        <p className="modal-sub">
          Kirim suhu &amp; kelembaban palsu ke server untuk menguji ambang dan
          notifikasi WhatsApp (data ditandai "simulasi").
        </p>

        <div className="sim-grid">
          <div className="field">
            <label>
              Suhu: <strong>{temp.toFixed(1)}°C</strong>
            </label>
            <input
              type="range"
              min={TEMP_MIN}
              max={TEMP_MAX}
              step={0.1}
              value={temp}
              onChange={(e) => setTemp(Number(e.target.value))}
            />
            <p className="hint">
              Rentang {TEMP_MIN}–{TEMP_MAX}°C (batas aman ESP).
            </p>
          </div>

          <div className="field">
            <label>
              Kelembaban: <strong>{hum.toFixed(1)}%</strong>
            </label>
            <input
              type="range"
              min={HUM_MIN}
              max={HUM_MAX}
              step={0.1}
              value={hum}
              onChange={(e) => setHum(Number(e.target.value))}
            />
            <p className="hint">
              Rentang {HUM_MIN}–{HUM_MAX}% (batas aman ESP).
            </p>
          </div>
        </div>

        <div className="info-block">
          <h3>Prediksi state (hysteresis ESP)</h3>
          <div className="chips">
            {chip("Kipas", preview.fan)}
            {chip("Humidifier", preview.humOn)}
            {chip("Buzzer", preview.buzzer, preview.buzzer)}
          </div>
        </div>

        {result && (
          <div className="info-block">
            <h3>Hasil terkirim</h3>
            <div className="chips">
              {chip("Kipas", result.relay_fan)}
              {chip("Humidifier", result.relay_humidifier)}
              {chip("Buzzer", result.buzzer, result.buzzer)}
            </div>
            <p className="hint">
              Data masuk ke riwayat (sumber: simulasi). Notifikasi WhatsApp
              terkirim hanya jika terjadi perubahan state.
            </p>
          </div>
        )}

        {error && <p className="field-error">{error}</p>}

        <button className="btn" type="button" onClick={send} disabled={busy}>
          {busy ? "Mengirim…" : "Kirim Paksa"}
        </button>
      </div>
    </div>
  );
}
