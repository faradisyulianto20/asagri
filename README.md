# Asagri IoT Monitor

Backend monitoring IoT ESP32 (SHT31-D) dengan dashboard React (responsif HP & desktop) dan notifikasi WhatsApp.

```
ESP32 (.ino) --HTTPS POST--> FastAPI (Railway) --> Supabase Postgres
                               |---> React dashboard (GET /dashboard)
                               |---> wa-gateway (@whiskeysockets/baileys) --> WhatsApp
```

## Struktur

| Folder | Isi |
|---|---|
| `backend/` | FastAPI: API sensor, dashboard, logika notifikasi |
| `frontend/` | React (Vite + TypeScript + recharts): dashboard responsif |
| `wa-gateway/` | Node.js @whiskeysockets/baileys: kirim pesan WhatsApp, session + QR |
| `esp32/main.ino` | Kode ESP32 (logika asli + WiFi & HTTP POST) |
| `scripts/simulate_esp32.py` | Simulasi ESP32 tanpa hardware |

## 1. Persiapan Supabase

1. Buat project gratis di supabase.com.
2. Ambil **connection string** Postgres: Settings → Database → Connection string (mode URI).
3. Tabel dibuat otomatis saat backend pertama kali dijalankan (`sensor_readings`, `wa_session`, `app_settings`, `users`, `admin_sessions`).

## 2. Deploy backend ke Railway

1. Buat project baru di Railway, hubungkan repo (folder ini).
2. Tambah service, set **root directory = `/`** (root repo — backend kini di-build multi-stage bersama frontend React).
3. Set environment variable (salin dari `backend/.env.example`):
   - `DATABASE_URL` (dari Supabase)
   - `API_TOKEN` (token acak, akan dipakai ESP32)
   - `ADMIN_USERNAME` (username admin, default `asagri@gmail.com`)
   - `ADMIN_PASSWORD` (password admin; akun dibuat otomatis saat backend pertama dijalankan)
   - `WA_GATEWAY_URL` (URL service wa-gateway, diisi setelah langkah 3)
   - `WA_AUTH_TOKEN` (token yang dibagi dengan gateway)
   - `WHATSAPP_TO` (nomor default penerima, dipakai saat tabel `app_settings` baru dibuat)
   - ambang suhu/kelembaban opsional
4. Generate domain → misal `https://backend.up.railway.app`.

> Frontend React otomatis ter-build oleh Docker multi-stage dan disajikan
> oleh FastAPI di `/` dan `/dashboard` (same-origin, tanpa CORS).

## 3. Deploy wa-gateway ke Railway

1. Tambah service kedua, set **root directory = `wa-gateway`**.
2. Set environment variable (salin dari `wa-gateway/.env.example`):
   - `AUTH_TOKEN` (sama dengan `WA_AUTH_TOKEN` di backend)
   - `BACKEND_URL` (URL backend dari langkah 2)
   - `BACKEND_TOKEN` (sama dengan `API_TOKEN` di backend)
3. Generate domain → isi `WA_GATEWAY_URL` di backend dengan URL ini, lalu redeploy backend.
4. Opsional: `BACKUP_SYNC_MS` = interval cadangan session (ms, default `3600000`/60 mnt).
   Naikkan jika sesi WhatsApp besar agar backup yang dikirim ke backend tidak terlalu sering.

> **Catatan free tier:** aplikasi Railway "tidur" setelah idle. Backend tetap hidup karena
> ESP32 mengirim data tiap 10 detik. Jika gateway tidur, notifikasi pertama mungkin
> terlambat beberapa detik (cold start).

## 4. Hubungkan WhatsApp

1. Buka dashboard dari HP atau desktop: `https://backend.up.railway.app/`.
2. Jika WhatsApp belum terhubung, **QR code** muncul otomatis sebagai **pop-up** di tengah layar (ukuran besar, tajam). Bisa dibuka lagi lewat tombol "Tampilkan QR" di kartu WhatsApp Gateway.
3. Scan dengan WhatsApp **nomor pengirim** (Menu → Perangkat tertaut → Tautkan perangkat).
4. Session otomatis tersimpan (volume + cadangan di Supabase), jadi tidak perlu scan ulang sering-sering.
5. Untuk mengganti nomor pengirim: klik **"Putuskan & Ganti Nomor"** di kartu WhatsApp Gateway (butuh password admin) → QR baru muncul otomatis.

> Hanya **satu** nomor pengirim yang bisa tertaut. Penerima notifikasi bisa **banyak nomor dan group WhatsApp**,
> diatur di menu **Pengaturan** (pisahkan dengan koma) atau lewat daftar permintaan (persetujuan admin).

## 4b. Fitur dashboard (dari browser)

- **Popup instruksi** muncul otomatis saat pertama kali membuka dashboard, bisa dibuka lagi lewat tombol **Bantuan**.
- **Bantuan**: menjelaskan cara kerja, ambang tetap ESP32, dan isi pesan notifikasi.
- **Pengaturan** (admin): daftar nomor penerima WhatsApp (banyak nomor, dipisah koma), teks pesan notifikasi
  (placeholder: `{temperature}`, `{humidity}`, `{threshold}`), dan jeda antar notifikasi. Ambang suhu/kelembaban
  ditampilkan *read-only* karena sudah pakem di firmware ESP32.
- **Daftar penerima** (publik, tanpa login): kartu "Daftarkan Penerima Notifikasi" di beranda — mode **Nomor**
  (isi nomor WhatsApp) atau **Group** (isi *link undangan group*, mis. `https://chat.whatsapp.com/xxxx`).
  Link undangan di-resolve otomatis jadi ID group (`…@g.us`) oleh gateway, lalu menunggu persetujuan admin.
  Cara ambil link: buka group di WhatsApp → Info → Undang lewat link → Salin tautan.
- **Simulasi** (admin): kirim suhu & kelembaban "paksa" ke server untuk menguji ambang dan notifikasi tanpa
  menyentuh ESP32. Data simulasi ditandai `source="simulasi"` dan tampil sebagai chip "Data Simulasi" di dashboard.
- **Login admin** (username + password dari `ADMIN_USERNAME`/`ADMIN_PASSWORD`): dashboard tetap terbuka untuk umum,
  hanya halaman Pengaturan/Simulasi/Putuskan yang dilindungi. Sesi disimpan di tabel `admin_sessions`
  (token di-hash, berlaku 7 hari) dan token tersimpan di `localStorage` browser. Ada tombol **Keluar**.
- **Status notifikasi** tampil di kartu WhatsApp Gateway (terkirim/gagal + penerima + waktu). Tombol
  **Kirim Pesan Uji** (admin) untuk memverifikasi gateway & nomor penerima. Kegagalan kirim **tidak** mengunci
  cooldown — akan dicoba lagi pada pembacaan berikutnya.

## 5. ESP32

1. Buka `esp32/main.ino` di Arduino IDE (board: ESP32).
2. Ganti konstanta di bagian atas:
   - `WIFI_SSID`, `WIFI_PASS`
   - `API_URL` → `https://backend.up.railway.app/api/sensor`
   - `API_TOKEN` → token yang sama dengan `API_TOKEN` di backend
3. Upload. Logika relay/buzzer/LCD tetap sama seperti kode asli Anda.
4. Cek Serial Monitor: muncul `Kirim OK (HTTP 200)`.

## 6. Pengembangan frontend (dev mode)

```bash
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

# di terminal lain, jalankan simulasi:
python scripts/simulate_esp32.py --url http://localhost:8000 --token <API_TOKEN>

# di terminal lain, jalankan Vite (proxy /api → localhost:8000):
cd frontend && npm install && npm run dev
```

Buka `http://localhost:5173` — suhu naik-turun otomatis akan memicu status relay
dan notifikasi WhatsApp.

### Build frontend untuk produksi

```bash
cd frontend && npm run build
# hasil di frontend/dist, otomatis disajikan backend jika dist ada.
# (di Railway ini dilakukan otomatis oleh Docker multi-stage)
```

## API

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/sensor` | ESP32 mengirim data (header `X-API-Token`) |
| GET | `/api/latest` | Data terbaru (suhu, kelembaban, relay, buzzer, sensor_error, source) |
| GET | `/api/history?hours=24` | Riwayat grafik |
| GET | `/api/thresholds` | Ambang suhu/kelembaban (publik, untuk UI) |
| POST | `/api/auth/login` | Login admin → token sesi |
| POST | `/api/auth/logout` | Hapus sesi admin |
| GET | `/api/auth/me` | Cek sesi admin & ambil username |
| GET | `/api/settings` | Pengaturan admin (header `X-Admin-Token`) |
| PUT | `/api/settings` | Simpan pengaturan admin (header `X-Admin-Token`) |
| POST | `/api/simulate` | Simulasikan suhu/kelembaban paksa (header `X-Admin-Token`) |
| GET | `/api/wa/status` | Status WhatsApp + QR |
| GET | `/api/notify/status` | Status pengiriman notifikasi terakhir (ok/error/penerima) |
| POST | `/api/wa/test` | Kirim pesan uji ke penerima (header `X-Admin-Token`) |
| POST | `/api/wa/disconnect` | Putuskan WhatsApp & minta QR baru (header `X-Admin-Token`) |
| POST | `/api/wa/session` | Cadangan session (dipakai gateway) |
| GET | `/api/wa/session` | Ambil session cadangan (dipakai gateway) |
| GET | `/dashboard` | Dashboard React (alias dari `/`) |

## Keamanan

- `API_TOKEN` melindungi endpoint sensor & session.
- `AUTH_TOKEN` melindungi `/send` di gateway.
- Login admin (username + password) menghasilkan token sesi (di-hash di tabel `admin_sessions`); header `X-Admin-Token`
  dipakai untuk `/api/settings`, `/api/simulate`, `/api/wa/disconnect`, dan endpoint `auth`.
- whatsapp-web.js **tidak resmi** — ada risiko nomor diblokir. Gunakan nomor cadangan jika memungkinkan.
- @whiskeysockets/baileys mendukung passkey WhatsApp terbaru (Shortcake/CRSC) untuk linking device.

## Troubleshooting / Debug

### Gateway WhatsApp tidak stabil (restart berulang, crash)

- Cek log gateway di Railway, cari kata kunci: `RESTART karena`, `unhandledRejection`,
  `uncaughtException`, `terputus`, `LOGOUT`.
- Cek status langsung: `curl https://<gateway-url>/status` → lihat `connected`, `number`,
  `restartCount`, `lastRestartReason`. Endpoint `/env` menampilkan konfigurasi yang dibaca proses.
- Gateway kini menggunakan **@whiskeysockets/baileys** (bukan whatsapp-web.js), yang mendukung
  passkey WhatsApp terbaru (Shortcake/CRSC). Tidak perlu Chromium/Puppeteer.
- Restart berulang dengan `LOGOUT` (beberapa kali beruntun) = sesi mati di sisi WhatsApp →
  gateway otomatis menghapus sesi & menampilkan QR baru; **scan ulang** di dashboard.
- Pastikan `BACKEND_URL`/`BACKEND_TOKEN` gateway mengarah ke backend yang sama dengan
  `WA_AUTH_TOKEN`/`API_TOKEN`; kalau salah, session tidak tersimpan di database.

### Fitur group WhatsApp tidak bekerja

1. Pastikan gateway **terhubung** (kartu WhatsApp Gateway di dashboard = "Terhubung");
   resolve link undangan butuh gateway aktif.
2. Kirim link undangan yang benar (`https://chat.whatsapp.com/xxxx`, bukan ID group atau URL lain).
3. Uji langsung endpoint gateway:
   ```bash
   curl -X POST https://<gateway-url>/invite \
     -H "Authorization: Bearer <AUTH_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"code":"KODE_DARI_LINK"}'
   ```
   - Berhasil → `{ "id": "120363…@g.us", "name": "Nama Group" }`.
   - `link undangan tidak valid` → link salah/kedaluwarsa.
   - `whatsapp belum terhubung` → gateway belum connected.
4. Setelah disetujui admin, pesan selamat datang dikirim **ke group** — kalau tidak muncul,
   cek status pengiriman terakhir di kartu WhatsApp Gateway / endpoint `/api/notify/status`.
5. Kirim manual untuk verifikasi: isi ID group (`…@g.us`) ke kolom "Nomor penerima" di
   **Pengaturan**, lalu tombol **Kirim Pesan Uji**.
