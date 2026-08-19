const fs = require("fs");
const path = require("path");
const express = require("express");
const qrcode = require("qrcode");
const archiver = require("archiver");
const unzipper = require("unzipper");
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");

const PORT = process.env.PORT || 4100;
const AUTH_TOKEN = process.env.AUTH_TOKEN || "ganti-token-gateway";
const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "");
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || "";
const DATA_PATH = process.env.DATA_PATH || path.resolve("./baileys_auth");
const DEVICE_NAME = process.env.DEVICE_NAME || "Asagri Monitor";

const SEND_TIMEOUT_MS = 25000;
const HEALTH_CHECK_MS = 60000;
const HEALTH_FAILURE_THRESHOLD = 3;
const RESTART_MIN_INTERVAL_MS = 30000;
const BACKUP_SYNC_MS = parseInt(process.env.BACKUP_SYNC_MS || "3600000", 10);
const TEARDOWN_TIMEOUT_MS = 15000;
const MAX_LOGOUT_STREAK = 3;

fs.mkdirSync(DATA_PATH, { recursive: true });

const logger = pino({ level: "warn" });

let sock = null;
let qrDataUrl = null;
let status = {
  connected: false,
  registered: false,
  number: null,
  starting: true,
  error: null,
};
let restarting = false;
let starting = false;
let lastRestartAttempt = 0;
let intentionalDisconnect = false;
let healthFailures = 0;
let restartCount = 0;
let lastRestartReason = null;
let bootLogoutStreak = 0;
let lastBackupTime = 0;
let saveState = null;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
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
  sock = null;
  qrDataUrl = null;
  healthFailures = 0;
  status = {
    connected: false,
    registered: false,
    number: null,
    starting: true,
    error: null,
  };
  setTimeout(() => {
    restarting = false;
    startSock();
  }, 2000);
}

function crashRecover(reason) {
  try {
    if (restarting) {
      if (sock) {
        console.error("[gateway] crash saat restart berjalan, diabaikan:", reason);
        return;
      }
      restarting = false;
      lastRestartAttempt = 0;
    }
    scheduleRestart(reason, true);
  } catch (err) {
    console.error("[gateway] crashRecover gagal:", err.message);
  }
}

process.on("unhandledRejection", (reason) => {
  const msg =
    reason instanceof Error ? reason.stack || reason.message : String(reason);
  console.error("[gateway] unhandledRejection:", msg);
  if (
    msg.includes("detached") ||
    msg.includes("Frame") ||
    msg.includes("Target closed")
  ) {
    console.error("[gateway] browser crash terdeteksi, restart segera");
    scheduleRestart(`detached/crash: ${reason instanceof Error ? reason.message : String(reason)}`, true);
  }
});

process.on("uncaughtException", (err) => {
  console.error("[gateway] uncaughtException:", err.message);
  if (
    err.message.includes("detached") ||
    err.message.includes("Frame") ||
    err.message.includes("Target closed")
  ) {
    scheduleRestart(`uncaughtException detached: ${err.message}`, true);
  } else {
    crashRecover(`uncaughtException: ${err.message}`);
  }
});

process.on("SIGTERM", () => {
  console.log("[gateway] SIGTERM diterima, menutup socket…");
  if (sock) {
    try {
      sock.end(undefined);
    } catch (err) {
      console.error("[gateway] end SIGTERM gagal:", err.message);
    }
  }
  process.exit(0);
});

async function clearSessionCompletely() {
  try {
    await fs.promises.rm(DATA_PATH, { recursive: true, force: true });
    fs.mkdirSync(DATA_PATH, { recursive: true });
    console.log("[gateway] folder sesi lokal dihapus");
  } catch (err) {
    console.error("[gateway] gagal hapus folder sesi:", err.message);
  }
  if (BACKEND_URL && BACKEND_TOKEN) {
    try {
      const res = await apiCall("/api/wa/session", { method: "DELETE" });
      console.log(
        "[gateway] sesi dihapus dari database",
        res.ok ? "" : `(status ${res.status})`
      );
    } catch (err) {
      console.error(
        "[gateway] gagal hapus sesi dari database:",
        err.message
      );
    }
  }
}

async function apiCall(urlPath, options = {}) {
  const headers = {
    ...(options.headers || {}),
    "X-API-Token": BACKEND_TOKEN,
  };
  if (options.body) headers["Content-Type"] = "application/json";
  return fetch(`${BACKEND_URL}${urlPath}`, { ...options, headers });
}

async function backupSessionToBackend() {
  if (!BACKEND_URL || !BACKEND_TOKEN) return;
  const now = Date.now();
  if (now - lastBackupTime < BACKUP_SYNC_MS) return;
  lastBackupTime = now;
  try {
    const files = await fs.promises.readdir(DATA_PATH);
    if (files.length === 0) return;
    const zipData = await new Promise((resolve, reject) => {
      const chunks = [];
      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("data", (chunk) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
      archive.glob("*", { cwd: DATA_PATH });
      archive.finalize();
    });
    const res = await apiCall("/api/wa/session", {
      method: "POST",
      body: JSON.stringify({
        data: zipData.toString("base64"),
        number: status.number || null,
      }),
    });
    if (res.ok) console.log("[gateway] sesi dicadangkan ke database");
    else
      console.error(
        "[gateway] gagal simpan sesi ke database:",
        res.status,
        await res.text()
      );
  } catch (err) {
    console.error("[gateway] gagal cadangkan sesi:", err.message);
  }
}

async function restoreSessionFromBackend() {
  if (!BACKEND_URL || !BACKEND_TOKEN) return false;
  try {
    const res = await apiCall("/api/wa/session");
    if (!res.ok) return false;
    const body = await res.json();
    if (!body.available || !body.data) return false;
    const zipBuffer = Buffer.from(body.data, "base64");
    await new Promise((resolve, reject) => {
      const writeStream = unzipper.Extract({ path: DATA_PATH });
      writeStream.on("close", resolve);
      writeStream.on("error", reject);
      writeStream.end(zipBuffer);
    });
    console.log("[gateway] sesi dipulihkan dari database");
    return true;
  } catch (err) {
    console.error("[gateway] gagal ambil sesi dari database:", err.message);
    return false;
  }
}

const app = express();
app.use(express.json({ limit: "5mb" }));

function sendJson(res, data, code = 200) {
  res.status(code).json(data);
}

app.post("/send", async (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`)
    return sendJson(res, { error: "unauthorized" }, 401);
  const { to, message } = req.body || {};
  const targets = Array.isArray(to) ? to.filter(Boolean) : [to];
  if (targets.length === 0 || !message)
    return sendJson(res, { error: "to dan message wajib" }, 400);
  if (!sock || !status.connected)
    return sendJson(res, { error: "whatsapp belum terhubung" }, 503);

  const recipients = targets.map((t) =>
    String(t).includes("@g.us") ? String(t) : `${t}@c.us`
  );
  try {
    for (const t of recipients) {
      await withTimeout(
        sock.sendMessage(t, { text: String(message) }),
        SEND_TIMEOUT_MS,
        "sendMessage"
      );
    }
    sendJson(res, { status: "sent", to: recipients.length });
  } catch (err) {
    console.error("[gateway] kirim pesan gagal:", err.message);
    const msg = err.message || String(err);
    if (msg.includes("timed out")) {
      scheduleRestart("sendMessage timeout — link WhatsApp diduga mati");
      return sendJson(
        res,
        {
          error:
            "kirim timeout, link WhatsApp diduga mati; restart otomatis dijalankan",
        },
        504
      );
    }
    if (msg.match(/Connection Closed|Connection Lost/)) {
      scheduleRestart("kirim gagal — koneksi terputus");
      return sendJson(
        res,
        {
          error: "koneksi WhatsApp terputus; restart otomatis dijalankan",
        },
        503
      );
    }
    sendJson(res, { error: String(err) }, 500);
  }
});

app.post("/invite", async (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`)
    return sendJson(res, { error: "unauthorized" }, 401);
  const { code } = req.body || {};
  if (!code) return sendJson(res, { error: "code wajib" }, 400);
  if (!sock || !status.connected)
    return sendJson(res, { error: "whatsapp belum terhubung" }, 503);
  try {
    const inviteCode = String(code).replace(
      /.*chat\.whatsapp\.com\//,
      ""
    );
    const info = await withTimeout(
      sock.groupGetInviteInfo(inviteCode),
      25000,
      "getInviteInfo"
    );
    if (!info || !info.id || !info.id.includes("@g.us")) {
      return sendJson(
        res,
        { error: "link undangan tidak valid atau kedaluwarsa" },
        400
      );
    }
    sendJson(res, { id: info.id, name: info.subject || null });
  } catch (err) {
    console.error("[gateway] resolve undangan grup gagal:", err.message);
    sendJson(res, { error: String(err) }, 500);
  }
});

app.post("/disconnect", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`)
    return sendJson(res, { error: "unauthorized" }, 401);

  restarting = false;
  lastRestartAttempt = 0;
  intentionalDisconnect = true;
  healthFailures = 0;
  sock = null;
  qrDataUrl = null;
  status = {
    connected: false,
    registered: false,
    number: null,
    starting: false,
    error: null,
  };

  sendJson(res, { status: "disconnected" });
  console.log("[gateway] sesi diputus, QR baru akan dibuat");

  clearSessionCompletely().finally(() => startSock());
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
    data_path: DATA_PATH,
    engine: "baileys",
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

async function checkHealth() {
  if (!sock || !status.connected) return;
  try {
    const state = sock.ws.readyState;
    if (state !== 1) {
      healthFailures += 1;
      console.error(
        `[gateway] health-check: ws.readyState = ${state} (kegagalan ke-${healthFailures}/${HEALTH_FAILURE_THRESHOLD})`
      );
      if (healthFailures >= HEALTH_FAILURE_THRESHOLD) {
        scheduleRestart(
          `health-check: WebSocket tidak connected ${healthFailures}x berturut-turut`
        );
      }
      return;
    }
    healthFailures = 0;
  } catch (err) {
    healthFailures += 1;
    console.error(
      `[gateway] health-check error: ${err.message} (kegagalan ke-${healthFailures}/${HEALTH_FAILURE_THRESHOLD})`
    );
    if (healthFailures >= HEALTH_FAILURE_THRESHOLD) {
      scheduleRestart(
        `health-check: error ${healthFailures}x berturut-turut`
      );
    }
  }
}
setInterval(checkHealth, HEALTH_CHECK_MS);

async function startSock() {
  if (starting) {
    console.log("[gateway] startSock dilewati (start lain sedang berjalan)");
    return;
  }
  starting = true;
  try {
    await createSock();
  } finally {
    starting = false;
  }
}

async function createSock() {
  const restored = await restoreSessionFromBackend();

  const { state, saveCreds } = await useMultiFileAuthState(DATA_PATH);
  saveState = saveCreds;

  let version;
  try {
    const { version: v } = await fetchLatestBaileysVersion();
    version = v;
    console.log("[gateway] WA Web version:", v.join("."));
  } catch (err) {
    console.error("[gateway] gagal fetch WA version, pakai default:", err.message);
    version = [2, 3000, 1037673340];
  }

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.macOS(DEVICE_NAME),
    printQRInTerminal: false,
    logger,
    qrTimeout: 60000,
    getMessage: async () => undefined,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        qrDataUrl = await qrcode.toDataURL(qr, { width: 400, margin: 2 });
      } catch {
        qrDataUrl = null;
      }
      status.connected = false;
      status.error = null;
      console.log("[gateway] QR baru tersedia, scan lewat dashboard");
    }

    if (connection === "connecting") {
      status.starting = true;
      console.log("[gateway] menghubungkan ke WhatsApp...");
    }

    if (connection === "open") {
      bootLogoutStreak = 0;
      status.registered = true;
      status.starting = false;
      status.connected = true;
      status.number = sock.user?.id?.replace(/:.*@/, "@")?.split("@")[0] || null;
      status.error = null;
      healthFailures = 0;
      console.log("[gateway] whatsapp siap, nomor:", status.number);
      if (status.number) saveNumber(status.number);
      backupSessionToBackend();
    }

    if (connection === "close") {
      status.connected = false;
      status.registered = false;
      status.starting = false;

      if (intentionalDisconnect) {
        intentionalDisconnect = false;
        status.error = null;
        console.log("[gateway] terputus disengaja");
        return;
      }

      const statusCode =
        (lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error
          : null)?.output?.statusCode ?? null;

      const reasonStr = lastDisconnect?.error?.message || "unknown";
      status.error = `Terputus: ${reasonStr} (code: ${statusCode})`;
      console.error("[gateway] terputus:", reasonStr, "code:", statusCode);

      if (
        statusCode === DisconnectReason.loggedOut ||
        statusCode === DisconnectReason.badSession ||
        statusCode === DisconnectReason.connectionReplaced
      ) {
        bootLogoutStreak += 1;
        console.error(
          `[gateway] LOGOUT/bad ke-${bootLogoutStreak}/${MAX_LOGOUT_STREAK}`
        );
        if (bootLogoutStreak >= MAX_LOGOUT_STREAK) {
          bootLogoutStreak = 0;
          console.error(
            "[gateway] LOGOUT berulang, sesi dihapus total; QR baru akan disiapkan"
          );
          clearSessionCompletely().finally(() =>
            scheduleRestart("LOGOUT berulang — sesi dihapus", true)
          );
          return;
        }
      }

      if (statusCode === DisconnectReason.restartRequired) {
        console.log("[gateway] restart required oleh WhatsApp, reconnect...");
        setTimeout(() => startSock(), 2000);
        return;
      }

      setTimeout(() => scheduleRestart(`terputus: ${reasonStr}`), 5000);
    }
  });

  sock.ev.on("creds.update", async () => {
    if (saveState) await saveState();
    backupSessionToBackend();
  });

  try {
    if (!restored) {
      console.log("[gateway] tidak ada sesi tersimpan, menunggu QR scan...");
    }
  } catch (err) {
    console.error("[gateway] initialization error:", err.message);
    status.starting = false;
    setTimeout(
      () => scheduleRestart(`initialize gagal: ${err.message}`),
      5000
    );
  }
}

app.listen(PORT, () => {
  console.log(`[gateway] wa-gateway berjalan di port ${PORT} (engine: baileys)`);
  if (!BACKEND_URL || !BACKEND_TOKEN) {
    console.warn(
      "[gateway] PERINGATAN: BACKEND_URL/BACKEND_TOKEN belum di-set, sesi tidak tersimpan di database!"
    );
  }
  startSock();
});
