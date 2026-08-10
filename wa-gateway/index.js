const fs = require("fs");
const path = require("path");
const express = require("express");
const qrcode = require("qrcode");
const { Client, RemoteAuth } = require("whatsapp-web.js");

const PORT = process.env.PORT || 4100;
const AUTH_TOKEN = process.env.AUTH_TOKEN || "ganti-token-gateway";
const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "");
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || "";
const DATA_PATH = process.env.DATA_PATH || path.resolve("./.wwebjs_auth");

fs.mkdirSync(DATA_PATH, { recursive: true });

let client = null;
let qrDataUrl = null;
let status = { connected: false, registered: false, number: null, starting: true };

async function apiCall(urlPath, options = {}) {
  const headers = { ...(options.headers || {}), "X-API-Token": BACKEND_TOKEN };
  if (options.body) headers["Content-Type"] = "application/json";
  return fetch(`${BACKEND_URL}${urlPath}`, { ...options, headers });
}

const backendStore = {
  async sessionExists() {
    if (!BACKEND_URL || !BACKEND_TOKEN) return false;
    try {
      const res = await apiCall("/api/wa/session");
      if (!res.ok) return false;
      const body = await res.json();
      return Boolean(body.available && body.data);
    } catch (err) {
      console.error("[gateway] gagal cek sesi di database:", err.message);
      return false;
    }
  },

  async save({ session }) {
    if (!BACKEND_URL || !BACKEND_TOKEN) return;
    try {
      const zipPath = path.join(DATA_PATH, `${session}.zip`);
      const zip = await fs.promises.readFile(zipPath);
      const res = await apiCall("/api/wa/session", {
        method: "POST",
        body: JSON.stringify({ data: zip.toString("base64") }),
      });
      if (res.ok) console.log("[gateway] sesi dicadangkan ke database");
      else console.error("[gateway] gagal simpan sesi ke database:", res.status, await res.text());
    } catch (err) {
      console.error("[gateway] gagal baca/unggah sesi:", err.message);
    }
  },

  async extract({ session, path: destPath }) {
    if (!BACKEND_URL || !BACKEND_TOKEN) return;
    try {
      const res = await apiCall("/api/wa/session");
      if (!res.ok) return;
      const body = await res.json();
      if (!body.available || !body.data) return;
      await fs.promises.writeFile(destPath, Buffer.from(body.data, "base64"));
      console.log("[gateway] sesi dipulihkan dari database");
    } catch (err) {
      console.error("[gateway] gagal ambil sesi dari database:", err.message);
    }
  },

  async delete() {
    if (!BACKEND_URL || !BACKEND_TOKEN) return;
    try {
      const res = await apiCall("/api/wa/session", { method: "DELETE" });
      console.log("[gateway] sesi dihapus dari database", res.ok ? "" : `(status ${res.status})`);
    } catch (err) {
      console.error("[gateway] gagal hapus sesi dari database:", err.message);
    }
  },
};

const app = express();
app.use(express.json({ limit: "5mb" }));

function sendJson(res, data, code = 200) {
  res.status(code).json(data);
}

app.post("/send", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`) return sendJson(res, { error: "unauthorized" }, 401);
  const { to, message } = req.body || {};
  const targets = Array.isArray(to) ? to.filter(Boolean) : [to];
  if (targets.length === 0 || !message) return sendJson(res, { error: "to dan message wajib" }, 400);
  if (!status.connected) return sendJson(res, { error: "whatsapp belum terhubung" }, 503);

  const recipients = targets.map((t) => (String(t).includes("@g.us") ? String(t) : `${t}@c.us`));
  Promise.all(recipients.map((t) => client.sendMessage(t, String(message))))
    .then(() => sendJson(res, { status: "sent", to: recipients.length }))
    .catch((err) => sendJson(res, { error: String(err) }, 500));
});

app.post("/disconnect", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`) return sendJson(res, { error: "unauthorized" }, 401);

  const current = client;
  client = null;
  qrDataUrl = null;
  status = { connected: false, registered: false, number: null, starting: false };

  // Balas seketika; pembersihan & restart dijalankan di background
  sendJson(res, { status: "disconnected" });
  console.log("[gateway] sesi diputus, QR baru akan dibuat");

  const bounded = (promise) =>
    Promise.race([promise, new Promise((r) => setTimeout(r, 8000))]);

  if (current) {
    bounded(current.logout().catch((err) => console.error("[gateway] logout gagal:", err.message)))
      .finally(() =>
        bounded(current.destroy().catch((err) => console.error("[gateway] destroy gagal:", err.message)))
      )
      .finally(() => startClient());
  } else {
    setTimeout(startClient, 1000);
  }
});

app.get("/", (_req, res) => {
  sendJson(res, { service: "asagri wa-gateway", ...status, qr: status.connected ? null : qrDataUrl });
});

app.get("/status", (_req, res) => {
  sendJson(res, { ...status, qr: status.connected ? null : qrDataUrl });
});

async function saveNumber(number) {
  if (!BACKEND_URL || !BACKEND_TOKEN) return;
  try {
    await apiCall("/api/wa/session", {
      method: "POST",
      body: JSON.stringify({ number }),
    });
  } catch (err) {
    console.error("[gateway] gagal simpan nomor ke database:", err.message);
  }
}

async function startClient() {
  const options = {
    authStrategy: new RemoteAuth({
      store: backendStore,
      clientId: null,
      dataPath: DATA_PATH,
      backupSyncIntervalMs: 60000,
    }),
    puppeteer: process.env.CHROMIUM_PATH
      ? { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"], executablePath: process.env.CHROMIUM_PATH }
      : { headless: true },
  };

  client = new Client(options);

  client.on("qr", async (qr) => {
    try {
      qrDataUrl = await qrcode.toDataURL(qr, { width: 400, margin: 2 });
    } catch {
      qrDataUrl = null;
    }
    status.connected = false;
    console.log("[gateway] QR baru tersedia, scan lewat dashboard");
  });

  client.on("ready", () => {
    status.connected = true;
    status.starting = false;
    status.number = client.info.wid.user;
    console.log("[gateway] whatsapp siap, nomor:", client.info.wid.user);
    saveNumber(client.info.wid.user);
  });

  client.on("disconnected", (reason) => {
    status.connected = false;
    status.registered = false;
    console.log("[gateway] terputus:", reason);
  });

  try {
    await client.initialize();
  } catch (err) {
    console.error("[gateway] initialize gagal:", err.message);
    status.starting = false;
  }
}

app.listen(PORT, () => {
  console.log(`[gateway] wa-gateway berjalan di port ${PORT}`);
  if (!BACKEND_URL || !BACKEND_TOKEN) {
    console.warn("[gateway] PERINGATAN: BACKEND_URL/BACKEND_TOKEN belum di-set, sesi tidak tersimpan di database!");
  }
  startClient();
});
