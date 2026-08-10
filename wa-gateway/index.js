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
const DEVICE_NAME = process.env.DEVICE_NAME || "Asagri Monitor";

const SEND_TIMEOUT_MS = 25000;
const HEALTH_CHECK_MS = 60000;
const RESTART_MIN_INTERVAL_MS = 30000;

fs.mkdirSync(DATA_PATH, { recursive: true });

let client = null;
let qrDataUrl = null;
let status = { connected: false, registered: false, number: null, starting: true, error: null };
let restarting = false;
let lastRestartAttempt = 0;
let intentionalDisconnect = false;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function scheduleRestart(reason) {
  if (!client) return;
  if (restarting) {
    console.log("[gateway] restart sudah berjalan, abaikan:", reason);
    return;
  }
  if (Date.now() - lastRestartAttempt < RESTART_MIN_INTERVAL_MS) {
    console.warn("[gateway] restart diblokir (cooldown), alasan:", reason);
    return;
  }
  console.error("[gateway] RESTART karena:", reason);
  restarting = true;
  lastRestartAttempt = Date.now();
  const current = client;
  client = null;
  qrDataUrl = null;
  status = { connected: false, registered: false, number: null, starting: true, error: null };
  const bounded = (promise) =>
    Promise.race([promise, new Promise((r) => setTimeout(r, 8000))]);
  (current
    ? bounded(current.destroy().catch((err) => console.error("[gateway] destroy gagal:", err.message)))
    : Promise.resolve()
  ).finally(() => {
    restarting = false;
    startClient();
  });
}

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

app.post("/send", async (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`) return sendJson(res, { error: "unauthorized" }, 401);
  const { to, message } = req.body || {};
  const targets = Array.isArray(to) ? to.filter(Boolean) : [to];
  if (targets.length === 0 || !message) return sendJson(res, { error: "to dan message wajib" }, 400);
  if (!client || !status.connected) return sendJson(res, { error: "whatsapp belum terhubung" }, 503);

  const recipients = targets.map((t) => (String(t).includes("@g.us") ? String(t) : `${t}@c.us`));
  try {
    await withTimeout(
      Promise.all(recipients.map((t) => client.sendMessage(t, String(message)))),
      SEND_TIMEOUT_MS,
      "sendMessage"
    );
    sendJson(res, { status: "sent", to: recipients.length });
  } catch (err) {
    console.error("[gateway] kirim pesan gagal:", err.message);
    if (err.message.includes("timed out")) {
      scheduleRestart("sendMessage timeout — link WhatsApp diduga mati");
      return sendJson(
        res,
        { error: "kirim timeout, link WhatsApp diduga mati; restart otomatis dijalankan" },
        504
      );
    }
    sendJson(res, { error: String(err) }, 500);
  }
});

app.post("/disconnect", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`) return sendJson(res, { error: "unauthorized" }, 401);

  restarting = false;
  lastRestartAttempt = 0;
  intentionalDisconnect = true;
  const current = client;
  client = null;
  qrDataUrl = null;
  status = { connected: false, registered: false, number: null, starting: false, error: null };

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

app.get("/env", (_req, res) => {
  sendJson(res, {
    port: PORT,
    auth_token_set: Boolean(process.env.AUTH_TOKEN),
    backend_url_set: Boolean(process.env.BACKEND_URL),
    backend_token_set: Boolean(process.env.BACKEND_TOKEN),
    backend_url: process.env.BACKEND_URL || null,
    chromium_set: Boolean(process.env.CHROMIUM_PATH),
    data_path: DATA_PATH,
  });
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

async function getStateSafe() {
  if (!client) return null;
  try {
    return await withTimeout(client.getState(), 10000, "getState");
  } catch (err) {
    console.error("[gateway] getState gagal:", err.message);
    return null;
  }
}

async function checkHealth() {
  if (!client || !status.connected) return;
  const state = await getStateSafe();
  if (state === null) {
    scheduleRestart("health-check: getState gagal/tidak membalas");
    return;
  }
  if (state !== "CONNECTED") {
    console.error("[gateway] health-check: state =", state);
    scheduleRestart(`health-check: state = ${state}`);
  }
}
setInterval(checkHealth, HEALTH_CHECK_MS);

async function startClient() {
  const options = {
    authStrategy: new RemoteAuth({
      store: backendStore,
      clientId: null,
      dataPath: DATA_PATH,
      backupSyncIntervalMs: 60000,
    }),
    deviceName: DEVICE_NAME,
    browserName: DEVICE_NAME,
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
    status.error = null;
    console.log("[gateway] QR baru tersedia, scan lewat dashboard");
  });

  client.on("auth_failure", (msg) => {
    status.connected = false;
    status.registered = false;
    status.error = msg ? `Link gagal: ${msg}` : "Link gagal";
    console.error("[gateway] auth failure:", msg);
  });

  client.on("ready", async () => {
    const state = await getStateSafe();
    status.connected = state === "CONNECTED";
    status.starting = false;
    status.number = client.info.wid.user;
    status.error = null;
    console.log(
      "[gateway] whatsapp siap, nomor:",
      client.info.wid.user,
      "| state:",
      state || "unknown"
    );
    if (status.connected) {
      saveNumber(client.info.wid.user);
    } else {
      scheduleRestart(`ready tetapi state tidak CONNECTED (${state || "unknown"})`);
    }
  });

  client.on("disconnected", (reason) => {
    status.connected = false;
    status.registered = false;
    if (intentionalDisconnect) {
      intentionalDisconnect = false;
      status.error = null;
      console.log("[gateway] terputus disengaja:", reason);
      return;
    }
    status.error = `Terputus: ${reason}`;
    console.error("[gateway] terputus:", reason);
    setTimeout(() => scheduleRestart(`terputus: ${reason}`), 10000);
  });

  try {
    await client.initialize();
  } catch (err) {
    console.error("[gateway] initialize gagal:", err.message);
    status.starting = false;
    setTimeout(() => scheduleRestart(`initialize gagal: ${err.message}`), 5000);
  }
}

app.listen(PORT, () => {
  console.log(`[gateway] wa-gateway berjalan di port ${PORT}`);
  if (!BACKEND_URL || !BACKEND_TOKEN) {
    console.warn("[gateway] PERINGATAN: BACKEND_URL/BACKEND_TOKEN belum di-set, sesi tidak tersimpan di database!");
  }
  startClient();
});
