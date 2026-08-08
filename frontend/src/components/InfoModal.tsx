import { useEffect } from "react";

export function InfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        <h2>Selamat Datang di Asagri Monitor 🌱</h2>
        <p className="modal-sub">
          Dashboard pemantauan suhu &amp; kelembaban ruangan berbasis ESP32.
        </p>

        <div className="info-block">
          <h3>Cara kerja</h3>
          <p>
            ESP32 membaca sensor SHT31 tiap 2 detik, lalu{" "}
            <strong>mengirim data setiap 10 detik</strong> ke server. Dashboard
            ini memperbarui tampilannya <strong>setiap 5 detik</strong>.
          </p>
          <p>
            Kipas &amp; humidifier dikendalikan <em>otomatis</em> oleh ESP32
            sesuai ambang tetap (sama seperti yang tertanam di firmware):
          </p>
          <ul>
            <li>Kipas nyala saat suhu ≥ 32°C, mati saat ≤ 25°C</li>
            <li>Humidifier nyala saat kelembaban ≤ 61%, mati saat ≥ 83%</li>
            <li>Buzzer berbunyi saat suhu &gt; 40°C atau kelembaban &lt; 50%</li>
          </ul>
        </div>

        <div className="info-block">
          <h3>Notifikasi WhatsApp</h3>
          <p>
            Saat kondisi berubah, WhatsApp akan mengirim pesan ke nomor-nomor
            yang didaftarkan admin. Isi pesannya:
          </p>
          <ul>
            <li>
              ⚠️ <strong>Kipas nyala</strong> — suhu melebihi ambang, kipas
              dinyalakan otomatis.
            </li>
            <li>
              💧 <strong>Humidifier nyala</strong> — kelembaban di bawah ambang,
              humidifier dinyalakan otomatis.
            </li>
            <li>
              🚨 <strong>Peringatan ekstrem</strong> — suhu/kelembaban di luar
              batas aman, segera periksa ruangan.
            </li>
          </ul>
          <p>
            Teks pesan dapat diubah bebas oleh admin di menu{" "}
            <strong>Pengaturan</strong>.
          </p>
        </div>

        <div className="info-block">
          <h3>Hubungkan WhatsApp</h3>
          <p>
            Buka WhatsApp → <em>Menu → Perangkat tertaut → Tautkan perangkat</em>
            , lalu scan QR yang muncul di dashboard. Hanya{" "}
            <strong>satu nomor</strong> yang dapat tertaut sebagai pengirim.
          </p>
        </div>

        <p className="modal-note">
          Menu <strong>Pengaturan</strong> &amp; <strong>Simulasi</strong> hanya
          untuk admin (memerlukan password).
        </p>

        <button className="btn" type="button" onClick={onClose}>
          Mulai
        </button>
      </div>
    </div>
  );
}
