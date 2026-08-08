import { useEffect, useState } from "react";
import {
  fetchAdminSettings,
  updateAdminSettings,
} from "../api";
import type { AdminSettings as AdminSettingsData } from "../api";

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
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [token]);

  if (!form) {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="modal modal-wide">
          <p className="modal-sub">{error || "Memuat pengaturan…"}</p>
        </div>
      </div>
    );
  }

  const set = (key: keyof AdminSettingsData, value: string) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const th = form.thresholds;
  const hasPlaceholder = PLACEHOLDER_NUMBERS.some((n) =>
    form.whatsapp_to.split(",").map((x) => x.trim()).includes(n),
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
        <h2>Pengaturan Admin</h2>
        <p className="modal-sub">
          Pesan notifikasi &amp; daftar penerima WhatsApp.
        </p>

        <form onSubmit={save} className="settings-form">
          <div className="field">
            <label>Nomor penerima (pisahkan dengan koma)</label>
            <textarea
              rows={2}
              value={form.whatsapp_to}
              onChange={(e) => set("whatsapp_to", e.target.value)}
              placeholder="6281111111111, 6282222222222"
            />
            <p className="hint">
              Format internasional tanpa tanda + dan tanpa awalan 0.
            </p>
            {hasPlaceholder && (
              <p className="field-error">
                ⚠️ Masih ada nomor default/placeholder (6281234567890). Ganti
                dengan nomor WhatsApp asli agar notifikasi sampai.
              </p>
            )}
          </div>

          <div className="field">
            <label>Pesan kipas menyala</label>
            <textarea
              rows={3}
              value={form.msg_fan_on}
              onChange={(e) => set("msg_fan_on", e.target.value)}
            />
            <p className="hint">
              Bisa pakai placeholder: {"{temperature}"} dan {"{threshold}"}
            </p>
          </div>

          <div className="field">
            <label>Pesan humidifier menyala</label>
            <textarea
              rows={3}
              value={form.msg_humid_on}
              onChange={(e) => set("msg_humid_on", e.target.value)}
            />
            <p className="hint">
              Bisa pakai placeholder: {"{humidity}"} dan {"{threshold}"}
            </p>
          </div>

          <div className="field">
            <label>Pesan kondisi ekstrem</label>
            <textarea
              rows={3}
              value={form.msg_extreme}
              onChange={(e) => set("msg_extreme", e.target.value)}
            />
            <p className="hint">
              Bisa pakai placeholder: {"{temperature}"} dan {"{humidity}"}
            </p>
          </div>

          <div className="field">
            <label>Jeda antar notifikasi (menit)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.cooldown_minutes}
              onChange={(e) => set("cooldown_minutes", e.target.value)}
            />
          </div>

          <div className="info-block">
            <h3>Ambang tetap (dari ESP32)</h3>
            <ul>
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
            <p className="hint">
              Ambang dikendalikan firmware ESP32 dan tidak dapat diubah dari
              sini.
            </p>
          </div>

          {error && <p className="field-error">{error}</p>}
          {saved && <p className="field-ok">Pengaturan tersimpan ✓</p>}

          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </form>
      </div>
    </div>
  );
}
