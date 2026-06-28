require("dotenv").config();
const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Store active monitors in memory
// key = sessionId, value = { intervalId, timeoutId, url, email, status }
const activeMonitors = {};

// ─── Gmail transporter ────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// ─── Send alert email ─────────────────────────────────────────────────────────
async function sendAlert(email, url) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Site Watcher 🔍" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `✅ ${url} is back online!`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #16a34a; margin-top: 0;">🟢 Website is back online!</h2>
        <p style="color: #374151; font-size: 16px;">Good news — the website you were monitoring just responded successfully.</p>
        <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
          <strong style="color: #15803d;">URL:</strong>
          <a href="${url}" style="color: #16a34a; margin-left: 8px;">${url}</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Monitoring has been stopped automatically.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Sent by Site Watcher</p>
      </div>
    `,
  });
}

// ─── Ping a website ───────────────────────────────────────────────────────────
async function pingWebsite(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000, // 10s timeout per request
      validateStatus: (status) => status < 500, // treat 2xx/3xx/4xx as "up"
    });
    return { up: true, status: response.status };
  } catch (err) {
    return { up: false, status: err.response?.status || 0 };
  }
}

// ─── Stop a monitor ───────────────────────────────────────────────────────────
function stopMonitor(sessionId, reason) {
  const monitor = activeMonitors[sessionId];
  if (!monitor) return;

  clearInterval(monitor.intervalId);
  clearTimeout(monitor.timeoutId);
  monitor.status = reason; // "success" | "expired" | "stopped"
  console.log(`[${sessionId}] Monitor stopped: ${reason}`);
}

// ─── Start monitoring ─────────────────────────────────────────────────────────
function startMonitor(sessionId, url, email, intervalSec, durationMin) {
  const intervalMs = intervalSec * 1000;
  const durationMs = durationMin * 60 * 1000;

  const monitor = {
    url,
    email,
    intervalSec,
    durationMin,
    status: "running",
    startedAt: Date.now(),
    lastChecked: null,
    checkCount: 0,
    intervalId: null,
    timeoutId: null,
  };

  activeMonitors[sessionId] = monitor;

  // Auto-stop after max duration
  monitor.timeoutId = setTimeout(() => {
    if (activeMonitors[sessionId]?.status === "running") {
      stopMonitor(sessionId, "expired");
    }
  }, durationMs);

  // Ping on interval
  monitor.intervalId = setInterval(async () => {
    if (activeMonitors[sessionId]?.status !== "running") return;

    monitor.lastChecked = Date.now();
    monitor.checkCount++;

    const result = await pingWebsite(url);
    console.log(`[${sessionId}] Ping #${monitor.checkCount} → ${url} → ${result.up ? "UP ✅" : "DOWN ❌"} (${result.status})`);

    if (result.up) {
      stopMonitor(sessionId, "success");
      try {
        await sendAlert(email, url);
        console.log(`[${sessionId}] Email sent to ${email}`);
      } catch (err) {
        console.error(`[${sessionId}] Email failed:`, err.message);
        activeMonitors[sessionId].emailError = err.message;
      }
    }
  }, intervalMs);

  console.log(`[${sessionId}] Started monitoring ${url} every ${intervalSec}s for up to ${durationMin}min`);
}

// ─── API: Start monitoring ────────────────────────────────────────────────────
app.post("/api/start", (req, res) => {
  const { url, email, interval, duration } = req.body;

  // Basic validation
  if (!url || !email || !interval || !duration) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (!/^https?:\/\/.+/.test(url)) {
    return res.status(400).json({ error: "URL must start with http:// or https://" });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  startMonitor(sessionId, url, email, Number(interval), Number(duration));

  res.json({ sessionId, message: "Monitoring started!" });
});

// ─── API: Get status ──────────────────────────────────────────────────────────
app.get("/api/status/:sessionId", (req, res) => {
  const monitor = activeMonitors[req.params.sessionId];
  if (!monitor) return res.status(404).json({ error: "Session not found." });

  const elapsedMs = Date.now() - monitor.startedAt;
  const remainingMs = Math.max(0, monitor.durationMin * 60 * 1000 - elapsedMs);

  res.json({
    status: monitor.status,
    url: monitor.url,
    email: monitor.email,
    checkCount: monitor.checkCount,
    lastChecked: monitor.lastChecked,
    remainingSeconds: Math.floor(remainingMs / 1000),
    emailError: monitor.emailError || null,
  });
});

// ─── API: Stop monitoring ─────────────────────────────────────────────────────
app.post("/api/stop/:sessionId", (req, res) => {
  const monitor = activeMonitors[req.params.sessionId];
  if (!monitor) return res.status(404).json({ error: "Session not found." });

  stopMonitor(req.params.sessionId, "stopped");
  res.json({ message: "Monitoring stopped." });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🔍 Site Watcher running at http://localhost:${PORT}\n`);
});
