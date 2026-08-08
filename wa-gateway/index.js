const express = require("express");
const qrcode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const PORT = process.env.PORT || 4100;
const AUTH_TOKEN = process.env.AUTH_TOKEN || "ganti-token-gateway";
const SESSION_DIR = process.env.SESSION_DIR || "./session";
const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "");
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || "";

let client = null;
let qrDataUrl = null;
let lastSession = null;
let status = { connected: false, registered: false, number: null, starting: true };

const app = express();
app.use(express.json({ limit: "5mb" }));

function sendJson(res, data, code = 200) {
  res.status(code).json(data);
}

app.post("/send", (req, res) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${AUTH_TOKEN}`) return sendJson(res, { error: "unauthorized" }, 401);
  const { to, message } = req.body || {};
  if (!to || !message) return sendJson(res, { error: "to dan message wajib" }, 400);
  if (!status.connected) return sendJson(res, { error: "whatsapp belum terhubung" }, 503);

  client
    .sendMessage(to.includes("@g.us") ? to : `${to}@c.us`, String(message))
    .then(() => sendJson(res, { status: "sent" }))
    .catch((err) => sendJson(res, { error: String(err) }, 500));
});

app.get("/status", (_req, res) => {
  sendJson(res, { ...status, qr: status.connected ? null : qrDataUrl });
});

async function backupSession(session) {
  if (!BACKEND_URL || !BACKEND_TOKEN) return;
  try {
    await fetch(`${BACKEND_URL}/api/wa/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": BACKEND_TOKEN,
      },
      body: JSON.stringify({ data: JSON.stringify(session) }),
    });
    console.log("[gateway] session dicadangkan ke backend");
  } catch (err) {
    console.error("[gateway] gagal cadangkan session:", err.message);
  }
}

async function restoreSession() {
  if (!BACKEND_URL || !BACKEND_TOKEN) return null;
  try {
    const resp = await fetch(`${BACKEND_URL}/api/wa/session`, {
      headers: { "X-API-Token": BACKEND_TOKEN },
    });
    const data = await resp.json();
    if (data.available) {
      lastSession = JSON.parse(data.data);
      return lastSession;
    }
  } catch (err) {
    console.error("[gateway] gagal ambil session cadangan:", err.message);
  }
  return null;
}

async function startClient() {
  const options = {
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
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

  client.on("authenticated", async (session) => {
    lastSession = session;
    qrDataUrl = null;
    console.log("[gateway] whatsapp terautentikasi");
    backupSession(session);
  });

  client.on("ready", () => {
    status.connected = true;
    status.starting = false;
    status.number = client.info.wid.user;
    console.log("[gateway] whatsapp siap, nomor:", client.info.wid.user);
  });

  client.on("disconnected", (reason) => {
    status.connected = false;
    status.registered = false;
    console.log("[gateway] terputus:", reason);
  });

  if (!lastSession) {
    const restored = await restoreSession();
    if (restored) {
      try {
        await client.restoreSession(restored);
      } catch (err) {
        console.error("[gateway] restore session gagal:", err.message);
      }
    }
  }

  try {
    await client.initialize();
  } catch (err) {
    console.error("[gateway] initialize gagal:", err.message);
    status.starting = false;
  }
}

app.listen(PORT, () => {
  console.log(`[gateway] wa-gateway berjalan di port ${PORT}`);
  startClient();
});
