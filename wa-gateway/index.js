const express = require("express");
const qrcode = require("qrcode");
const { Client, AuthStrategy } = require("whatsapp-web.js");

const PORT = process.env.PORT || 4100;
const AUTH_TOKEN = process.env.AUTH_TOKEN || "ganti-token-gateway";
const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "");
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || "";

let client = null;
let qrDataUrl = null;
let status = { connected: false, registered: false, number: null, starting: true };

class DbAuthStrategy extends AuthStrategy {
  constructor() {
    super();
    this.state = null;
  }

  async getState() {
    if (this.state) return this.state;
    if (!BACKEND_URL || !BACKEND_TOKEN) {
      console.warn("[gateway] BACKEND_URL/BACKEND_TOKEN belum di-set, sesi tidak dipulihkan dari database");
      return null;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/wa/session`, {
        headers: { "X-API-Token": BACKEND_TOKEN },
      });
      if (!res.ok) return null;
      const body = await res.json();
      if (body.available && body.data) {
        this.state = JSON.parse(body.data);
        console.log("[gateway] sesi dipulihkan dari database", body.number ? `(nomor ${body.number})` : "");
      }
    } catch (err) {
      console.error("[gateway] gagal ambil sesi dari database:", err.message);
    }
    return this.state;
  }

  async saveState(state) {
    this.state = state;
    if (!BACKEND_URL || !BACKEND_TOKEN) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/wa/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Token": BACKEND_TOKEN,
        },
        body: JSON.stringify({ data: JSON.stringify(state) }),
      });
      if (res.ok) console.log("[gateway] sesi disimpan ke database");
      else console.error("[gateway] gagal simpan sesi ke database:", res.status, await res.text());
    } catch (err) {
      console.error("[gateway] gagal simpan sesi ke database:", err.message);
    }
  }

  async clear() {
    this.state = null;
    if (!BACKEND_URL || !BACKEND_TOKEN) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/wa/session`, {
        method: "DELETE",
        headers: { "X-API-Token": BACKEND_TOKEN },
      });
      console.log("[gateway] sesi dihapus dari database", res.ok ? "" : `(status ${res.status})`);
    } catch (err) {
      console.error("[gateway] gagal hapus sesi dari database:", err.message);
    }
  }
}

const authStrategy = new DbAuthStrategy();

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

app.post("/disconnect", async (_req, res) => {
  if (!client) return sendJson(res, { error: "client belum ada" }, 400);
  try {
    await client.logout();
  } catch (err) {
    console.error("[gateway] logout gagal:", err.message);
  }
  try {
    await client.destroy();
  } catch (err) {
    console.error("[gateway] destroy gagal:", err.message);
  }
  client = null;
  qrDataUrl = null;
  status = { connected: false, registered: false, number: null, starting: false };
  sendJson(res, { status: "disconnected" });
  console.log("[gateway] sesi diputus, QR baru akan dibuat");
  setTimeout(startClient, 1000);
});

app.get("/status", (_req, res) => {
  sendJson(res, { ...status, qr: status.connected ? null : qrDataUrl });
});

async function saveNumber(number) {
  if (!BACKEND_URL || !BACKEND_TOKEN) return;
  try {
    await fetch(`${BACKEND_URL}/api/wa/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": BACKEND_TOKEN,
      },
      body: JSON.stringify({ number }),
    });
  } catch (err) {
    console.error("[gateway] gagal simpan nomor ke database:", err.message);
  }
}

async function startClient() {
  const options = {
    authStrategy,
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
