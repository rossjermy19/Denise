import express from "express";
import cors from "cors";
import crypto from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";

const PORT = process.env.PORT || 3001;
const POCKET_BASE = "https://public.heypocketai.com/api/v1";

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST","PATCH","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.options("*", cors());
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// ─── DB helpers ───────────────────────────────────────────────────────
const DB_FILE = "./db.json";
const CONFIG_FILE = "./config.json";

function loadDB() {
  if (!existsSync(DB_FILE)) return { tasks: [], calls: [] };
  return JSON.parse(readFileSync(DB_FILE, "utf8"));
}
function saveDB(data) { writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return { pocketApiKey: "", webhookSecret: "", configured: false };
  return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
}
function saveConfig(cfg) { writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); }

// ─── Pocket API helper ────────────────────────────────────────────────
async function pocketGet(path, apiKey) {
  const key = apiKey || loadConfig().pocketApiKey;
  const res = await fetch(`${POCKET_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Pocket API ${res.status}`);
  return res.json();
}

// ─── Webhook signature verification ──────────────────────────────────
function verifySignature(secret, timestamp, body, signature) {
  if (!secret) return true;
  const expected = crypto.createHmac("sha256", secret)
    .update(`${timestamp}.${body}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
  } catch { return false; }
}

// ─── Recording processor ──────────────────────────────────────────────
function processRecording(recording, summarizations, transcript) {
  const sumKey = Object.keys(summarizations || {})[0];
  const sum = sumKey ? summarizations[sumKey]?.v2 : null;
  const actionItems = sum?.actionItems?.actionItems || [];
  const call = {
    id: recording.id,
    title: recording.title || "Untitled recording",
    duration: recording.duration,
    createdAt: recording.createdAt,
    summary: sum?.summary?.markdown || null,
    bulletPoints: sum?.summary?.bulletPoints || [],
    speakers: [...new Set((transcript || []).map(t => t.speaker).filter(Boolean))],
    actionItems,
  };
  const tasks = actionItems.map(item => ({
    id: item.id || item.globalActionItemId,
    text: item.title,
    due: item.dueDate || "No date",
    status: item.isCompleted ? "done" : "open",
    source: "pocket",
    recordingId: recording.id,
    recordingTitle: recording.title,
  }));
  return { call, tasks };
}

// ─── Setup endpoints ──────────────────────────────────────────────────

app.get("/api/setup", (req, res) => {
  const cfg = loadConfig();
  res.json({
    configured: cfg.configured,
    hasApiKey: !!cfg.pocketApiKey,
    webhookSecret: cfg.webhookSecret || null,
    webhookUrl: cfg.webhookUrl || null,
  });
});

app.post("/api/setup/verify-key", async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey?.startsWith("pk_")) {
    return res.status(400).json({ ok: false, error: "Key must start with pk_" });
  }
  try {
    const data = await pocketGet("/public/recordings?limit=3", apiKey);
    const count = data.recordings?.length ?? 0;
    res.json({ ok: true, recordingCount: count });
  } catch {
    res.status(400).json({ ok: false, error: "Invalid API key" });
  }
});

app.post("/api/setup/save", (req, res) => {
  const { apiKey, webhookUrl } = req.body;
  if (!apiKey?.startsWith("pk_")) return res.status(400).json({ ok: false, error: "Invalid API key" });
  const cfg = loadConfig();
  const webhookSecret = cfg.webhookSecret || crypto.randomBytes(32).toString("hex");
  saveConfig({ pocketApiKey: apiKey, webhookSecret, webhookUrl: webhookUrl || "", configured: false });
  res.json({ ok: true, webhookSecret });
});

app.post("/api/setup/verify-webhook", (req, res) => {
  const cfg = loadConfig();
  const db = loadDB();
  if (db.calls.length > 0) {
    cfg.configured = true;
    saveConfig(cfg);
    return res.json({ ok: true });
  }
  res.json({ ok: false, message: "No webhooks received yet. Make a short test recording on your Pocket, then try again." });
});

app.post("/api/setup/complete", (req, res) => {
  const cfg = loadConfig();
  cfg.configured = true;
  saveConfig(cfg);
  res.json({ ok: true });
});

// ─── Data endpoints ───────────────────────────────────────────────────

app.get("/api/data", (req, res) => {
  const db = loadDB();
  res.json({
    tasks: db.tasks, calls: db.calls,
    stats: {
      open: db.tasks.filter(t => t.status === "open").length,
      done: db.tasks.filter(t => t.status === "done").length,
      overdue: db.tasks.filter(t => t.status === "overdue").length,
      totalCalls: db.calls.length,
    },
  });
});

app.patch("/api/tasks/:id", (req, res) => {
  const db = loadDB();
  const task = db.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Not found" });
  task.status = task.status === "done" ? "open" : "done";
  if (task.status === "done") task.due = "Done";
  saveDB(db);
  res.json(task);
});

app.post("/api/tasks", (req, res) => {
  const db = loadDB();
  const task = { id: `manual_${Date.now()}`, text: req.body.text, due: req.body.due || "Today", status: "open", source: "manual" };
  db.tasks.unshift(task);
  saveDB(db);
  res.json(task);
});

app.post("/api/sync", async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.pocketApiKey) return res.status(400).json({ error: "Not configured" });
  try {
    const list = await pocketGet("/public/recordings?limit=5");
    const recordings = list.recordings || list.data || list || [];
    if (!recordings.length) return res.json({ message: "No recordings found" });
    const db = loadDB();
    let newCalls = 0, newTasks = 0;
    for (const rec of recordings) {
      if (db.calls.find(c => c.id === rec.id)) continue;
      const detail = await pocketGet(`/public/recordings/${rec.id}?include=all`);
      const { call, tasks } = processRecording(detail.recording || rec, detail.summarizations, detail.transcript);
      db.calls.unshift(call);
      db.tasks.unshift(...tasks);
      newCalls++; newTasks += tasks.length;
    }
    saveDB(db);
    res.json({ message: `Synced ${newCalls} recordings, ${newTasks} tasks added` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Webhook receiver ─────────────────────────────────────────────────
app.post("/webhook/pocket", (req, res) => {
  const cfg = loadConfig();
  const rawBody = req.body.toString();
  const signature = req.headers["x-heypocket-signature"];
  const timestamp = req.headers["x-heypocket-timestamp"];
  if (cfg.webhookSecret && !verifySignature(cfg.webhookSecret, timestamp, rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  const { event, recording, summarizations, transcript } = payload;
  console.log(`[webhook] ${event} — ${recording?.id}`);
  if (event === "summary.completed" || event === "summary.regenerated") {
    const db = loadDB();
    const { call, tasks } = processRecording(recording, summarizations, transcript);
    const idx = db.calls.findIndex(c => c.id === call.id);
    if (idx >= 0) db.calls[idx] = call; else db.calls.unshift(call);
    for (const task of tasks) {
      if (!db.tasks.find(t => t.id === task.id)) db.tasks.unshift(task);
    }
    saveDB(db);
  }
  if (event === "action_items.updated") {
    const db = loadDB();
    for (const item of payload.actionItems || []) {
      const task = db.tasks.find(t => t.id === item.id);
      if (task) task.status = item.isCompleted ? "done" : "open";
    }
    saveDB(db);
  }
  res.json({ ok: true });
});

app.get("/health", (_, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`Pocket PA backend on http://localhost:${PORT}`));
