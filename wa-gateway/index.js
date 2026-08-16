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
const HEALTH_FAILURE_THRESHOLD = 3;
const RESTART_MIN_INTERVAL_MS = 30000;
const BACKUP_SYNC_MS = parseInt(process.env.BACKUP_SYNC_MS || "3600000", 10);
const TEARDOWN_TIMEOUT_MS = 25000;
const MAX_LOGOUT_STREAK = 3;

fs.mkdirSync(DATA_PATH, { recursive: true });

let client = null;
let qrDataUrl = null;
let status = { connected: false, registered: false, number: null, starting: true, error: null };
let restarting = false;
let starting = false;
let lastRestartAttempt = 0;
let intentionalDisconnect = false;
let healthFailures = 0;
let restartCount = 0;
let lastRestartReason = null;
let bootLogoutStreak = 0;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function teardown(current) {
  if (!current) return;
  try {
    await withTimeout(current.destroy(), TEARDOWN_TIMEOUT_MS, "destroy");
  } catch (err) {
    console.error("[gateway] destroy gagal/terganggu:", err.message);
  }
}

function scheduleRestart(reason, force = false) {
  if (restarting) {
    console.log("[gateway] restart sudah berjalan, abaikan:", reason);
    return;
  }
  if (!force && Date.now() - lastRestartAttempt < RESTART_MIN_INTERVAL_MS) {
    console.warn("[gateway] restart diblokir (cooldown), alasan:", reason);
    return;
  }
  console.error("[gateway] RESTART karena:", reason);
  restarting = true;
  lastRestartAttempt = Date.now();
  restartCount += 1;
  lastRestartReason = reason;
  const current = client;
  client = null;
  qrDataUrl = null;
  healthFailures = 0;
  status = { connected: false, registered: false, number: null, starting: true, error: null };
  teardown(current).finally(() => {
    restarting = false;
    startClient();
  });
}

function crashRecover(reason) {
  try {
    if (restarting) {
      if (client) {
        console.error("[gateway] crash saat restart berjalan, diabaikan:", reason);
        return;
      }
      // flag restart macet (client sudah null) — paksa pulih
      restarting = false;
      lastRestartAttempt = 0;
    }
    scheduleRestart(reason, true);
  } catch (err) {
    console.error("[gateway] crashRecover gagal:", err.message);
  }
}

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
  console.error("[gateway] unhandledRejection:", msg);
  crashRecover(`unhandledRejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});

process.on("uncaughtException", (err) => {
  console.error("[gateway] uncaughtException:", err);
  crashRecover(`uncaughtException: ${err.message}`);
});

process.on("SIGTERM", () => {
  console.log("[gateway] SIGTERM diterima, menutup client…");
  if (client) {
    client.destroy().catch((err) => console.error("[gateway] destroy SIGTERM gagal:", err.message));
  }
  process.exit(0);
});

async function clearSessionCompletely() {
  for (const p of [
    path.join(DATA_PATH, "RemoteAuth"),
    path.join(DATA_PATH, "RemoteAuth.zip"),
  ]) {
    try {
      await fs.promises.rm(p, { recursive: true, force: true });
    } catch (err) {
      console.error("[gateway] gagal hapus file sesi lokal:", p, err.message);
    }
  }
  if (BACKEND_URL && BACKEND_TOKEN) {
    try {
      const res = await apiCall("/api/wa/session", { method: "DELETE" });
      console.log("[gateway] sesi dihapus dari database", res.ok ? "" : `(status ${res.status})`);
    } catch (err) {
      console.error("[gateway] gagal hapus sesi dari database:", err.message);
    }
  }
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
      if (!fs.existsSync(zipPath)) {
        console.warn("[gateway] zip sesi tidak ada saat cadangan:", zipPath);
        return;
      }
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
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      await fs.promises.writeFile(destPath, Buffer.from(body.data, "base64"));
      if (!fs.existsSync(destPath)) {
        console.error("[gateway] zip sesi gagal ditulis:", destPath);
        return;
      }
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
    const sendAll = async () => {
      for (const t of recipients) {
        await client.sendMessage(t, String(message));
      }
    };
    try {
      await withTimeout(sendAll(), SEND_TIMEOUT_MS, "sendMessage");
    } catch (err) {
      const unstable = (err.message || "").match(/Target closed|TargetCloseError|detached|Frame/i);
      if (unstable) {
        console.error("[gateway] browser tidak stabil saat kirim, coba sekali lagi:", err.message);
        await new Promise((r) => setTimeout(r, 1500));
        await withTimeout(sendAll(), SEND_TIMEOUT_MS, "sendMessage");
      } else {
        throw err;
      }
    }
    sendJson(res, { status: "sent", to: recipients.length });
  } catch (err) {
    console.error("[gateway] kirim pesan gagal:", err.message);
    const msg = err.message || String(err);
    if (msg.includes("timed out")) {
      scheduleRestart("sendMessage timeout — link WhatsApp diduga mati");
      return sendJson(
        res,
        { error: "kirim timeout, link WhatsApp diduga mati; restart otomatis dijalankan" },
        504
      );
    }
    if (msg.match(/Target closed|TargetCloseError/)) {
      scheduleRestart("kirim gagal — browser crash (Target closed)");
      return sendJson(
        res,
        { error: "browser WhatsApp crash saat kirim; restart otomatis dijalankan" },
        500
      );
    }
    if (msg.match(/detached|Frame/i)) {
      scheduleRestart("kirim gagal — frame WhatsApp terlepas (page reload)");
      return sendJson(
        res,
        { error: "halaman WhatsApp me-reload; restart otomatis dijalankan", retry: true },
        503
      );
    }
    sendJson(res, { error: String(err) }, 500);
  }
});

app.post("/invite", async (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`) return sendJson(res, { error: "unauthorized" }, 401);
  const { code } = req.body || {};
  if (!code) return sendJson(res, { error: "code wajib" }, 400);
  if (!client || !status.connected) return sendJson(res, { error: "whatsapp belum terhubung" }, 503);
  try {
    const info = await withTimeout(client.getInviteInfo(String(code)), 25000, "getInviteInfo");
    const rawId = info && (info.gid || info.id);
    const id =
      rawId && typeof rawId === "object" && rawId._serialized
        ? String(rawId._serialized)
        : rawId
          ? String(rawId)
          : null;
    if (!id || !id.includes("@g.us")) {
      return sendJson(res, { error: "link undangan tidak valid atau kedaluwarsa" }, 400);
    }
    sendJson(res, { id, name: info.title || info.name || null });
  } catch (err) {
    console.error("[gateway] resolve undangan grup gagal:", err.message);
    sendJson(res, { error: String(err) }, 500);
  }
});

app.post("/disconnect", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`) return sendJson(res, { error: "unauthorized" }, 401);

  restarting = false;
  lastRestartAttempt = 0;
  intentionalDisconnect = true;
  healthFailures = 0;
  const current = client;
  client = null;
  qrDataUrl = null;
  status = { connected: false, registered: false, number: null, starting: false, error: null };

  // Balas seketika; pembersihan & restart dijalankan di background
  sendJson(res, { status: "disconnected" });
  console.log("[gateway] sesi diputus, QR baru akan dibuat");

  if (current) {
    withTimeout(current.logout(), TEARDOWN_TIMEOUT_MS, "logout")
      .catch((err) => console.error("[gateway] logout gagal:", err.message))
      .finally(() =>
        teardown(current).finally(() => {
          clearSessionCompletely().finally(() => startClient());
        })
      );
  } else {
    clearSessionCompletely().finally(() => startClient());
  }
});

app.get("/", (_req, res) => {
  sendJson(res, {
    service: "asagri wa-gateway",
    ...status,
    restartCount,
    lastRestartReason,
    qr: status.connected ? null : qrDataUrl,
  });
});

app.get("/status", (_req, res) => {
  sendJson(res, {
    ...status,
    restartCount,
    lastRestartReason,
    qr: status.connected ? null : qrDataUrl,
  });
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
    return await withTimeout(client.getState(), 25000, "getState");
  } catch (err) {
    console.error("[gateway] getState gagal:", err.message);
    return null;
  }
}

async function checkHealth() {
  if (!client || !status.connected) return;
  const state = await getStateSafe();
  if (state === null || state !== "CONNECTED") {
    healthFailures += 1;
    console.error(
      `[gateway] health-check: state = ${state || "null"} (kegagalan ke-${healthFailures}/${HEALTH_FAILURE_THRESHOLD})`
    );
    if (healthFailures >= HEALTH_FAILURE_THRESHOLD) {
      scheduleRestart(
        `health-check: getState gagal/tidak membalas ${healthFailures}x berturut-turut`
      );
    }
    return;
  }
  healthFailures = 0;
}
setInterval(checkHealth, HEALTH_CHECK_MS);

async function startClient() {
  if (starting) {
    console.log("[gateway] startClient dilewati (start lain sedang berjalan)");
    return;
  }
  starting = true;
  try {
    await createClient();
  } finally {
    starting = false;
  }
}

async function createClient() {
  const CHROME_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    "--single-process",
    "--no-zygote",
    "--disable-accelerated-2d-canvas",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-ipc-flooding-protection",
    "--memory-pressure-off",
  ];
  const options = {
    authStrategy: new RemoteAuth({
      store: backendStore,
      clientId: null,
      dataPath: DATA_PATH,
      backupSyncIntervalMs: BACKUP_SYNC_MS,
    }),
    deviceName: DEVICE_NAME,
    browserName: DEVICE_NAME,
    puppeteer: {
      headless: true,
      args: CHROME_ARGS,
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    },
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
    bootLogoutStreak = 0;
    const state = await getStateSafe();
    status.registered = true;
    status.starting = false;
    status.number = client.info.wid.user;
    status.error = null;
    if (state === "CONNECTED") {
      status.connected = true;
      healthFailures = 0;
    } else {
      status.connected = true;
      console.warn(
        "[gateway] ready tetapi getState tidak membalas (state =",
        state || "null",
        "); biarkan tersambung, health-check akan menindaklanjuti"
      );
    }
    console.log(
      "[gateway] whatsapp siap, nomor:",
      client.info.wid.user,
      "| state:",
      state || "unknown"
    );
    if (status.connected) {
      saveNumber(client.info.wid.user);
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

    // LOGOUT berulang = sesi kemungkinan mati di sisi server.
    // Setelah beberapa kali, bersihkan sesi total & siapkan QR agar tidak
    // terjebak loop restore → LOGOUT.
    if (String(reason).toUpperCase().includes("LOGOUT") || String(reason).toLowerCase().includes("logged")) {
      bootLogoutStreak += 1;
      console.error(`[gateway] LOGOUT ke-${bootLogoutStreak}/${MAX_LOGOUT_STREAK}`);
      if (bootLogoutStreak >= MAX_LOGOUT_STREAK) {
        bootLogoutStreak = 0;
        console.error("[gateway] LOGOUT berulang, sesi dihapus total; QR baru akan disiapkan");
        clearSessionCompletely().finally(() => scheduleRestart("LOGOUT berulang — sesi dihapus", true));
        return;
      }
    }
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
