import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync } from "fs";

const PORT = process.env.PORT || 3001;
const POCKET_BASE = "https://public.heypocketai.com/api/v1";

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST","PATCH","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.options("*", cors());
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

const DB_FILE = "./db.json";
const CONFIG_FILE = "./config.json";

function loadDB() {
  if (!existsSync(DB_FILE)) return { tasks: [], calls: [] };
  return JSON.parse(readFileSync(DB_FILE, "utf8"));
}
function saveDB(data) { writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return { pocketApiKey: "", configured: false };
  return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
}
function saveConfig(cfg) { writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); }

async function pocketGet(path, apiKey) {
  const key = apiKey || loadConfig().pocketApiKey;
  const res = await fetch(POCKET_BASE + path, { headers: { Authorization: "Bearer " + key } });
  if (!res.ok) throw new Error("Pocket API " + res.status);
  return res.json();
}

function processRecording(recording, summarizations, transcript) {
  const sumKey = Object.keys(summarizations || {})[0];
  const sumObj = sumKey ? summarizations[sumKey] : null;
  const v2 = (sumObj && sumObj.v2) ? sumObj.v2 : sumObj;
  const summaryBlock = (v2 && v2.summary) ? v2.summary : {};
  const actionItemsBlock = (v2 && v2.actionItems) ? v2.actionItems : {};
  const bulletPoints = summaryBlock.bulletPoints || summaryBlock.bullet_points || [];
  const summaryMarkdown = summaryBlock.markdown || summaryBlock.text || null;
  const actionItems = actionItemsBlock.actionItems || actionItemsBlock.action_items || [];
  const speakers = [...new Set((transcript || []).map(t => t.speaker).filter(Boolean))];
  const transcriptText = (transcript || []).map(t => (t.speaker ? t.speaker + ": " : "") + t.text).join("\n");
  return {
    call: {
      id: recording.id,
      title: recording.title || "Untitled",
      duration: recording.duration,
      createdAt: recording.createdAt,
      summary: summaryMarkdown,
      bulletPoints,
      speakers,
      transcript: transcriptText,
      actionItems,
    },
    tasks: actionItems.map(item => ({
      id: item.id || item.globalActionItemId || ("t_" + Date.now() + "_" + Math.random()),
      text: item.title,
      due: item.dueDate || "No date",
      status: (item.isCompleted || item.is_completed) ? "done" : "open",
      source: "pocket",
      recordingId: recording.id,
      recordingTitle: recording.title,
    }))
  };
}

// ── Setup ─────────────────────────────────────────────────────────────
app.get("/api/setup", (req, res) => {
  const cfg = loadConfig();
  res.json({ configured: cfg.configured, hasApiKey: !!cfg.pocketApiKey });
});

app.post("/api/setup/verify-key", async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith("pk_")) return res.status(400).json({ ok: false, error: "Key must start with pk_" });
  try {
    const data = await pocketGet("/public/recordings?limit=3", apiKey);
    res.json({ ok: true, recordingCount: (data.recordings || []).length });
  } catch { res.status(400).json({ ok: false, error: "Invalid API key" }); }
});

app.post("/api/setup/save", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith("pk_")) return res.status(400).json({ ok: false, error: "Invalid API key" });
  saveConfig({ pocketApiKey: apiKey, configured: false });
  res.json({ ok: true });
});

app.post("/api/setup/complete", (req, res) => {
  const cfg = loadConfig();
  cfg.configured = true;
  saveConfig(cfg);
  res.json({ ok: true });
});

// ── Data ──────────────────────────────────────────────────────────────
app.get("/api/data", (req, res) => {
  const db = loadDB();
  res.json({
    tasks: db.tasks,
    calls: db.calls,
    stats: {
      open: db.tasks.filter(t => t.status === "open").length,
      done: db.tasks.filter(t => t.status === "done").length,
      overdue: db.tasks.filter(t => t.status === "overdue").length,
      totalCalls: db.calls.length,
    }
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
  const task = { id: "manual_" + Date.now(), text: req.body.text, due: req.body.due || "Today", status: "open", source: "manual" };
  db.tasks.unshift(task);
  saveDB(db);
  res.json(task);
});

app.post("/api/sync", async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.pocketApiKey) return res.status(400).json({ error: "Not configured" });
  try {
    const list = await pocketGet("/public/recordings?limit=10");
    const recordings = list.recordings || list.data || [];
    const db = loadDB();
    let newCalls = 0, newTasks = 0;
    for (const rec of recordings) {
      if (db.calls.find(c => c.id === rec.id)) continue;
      try {
        const detail = await pocketGet("/public/recordings/" + rec.id + "?include=all");
        const { call, tasks } = processRecording(detail.recording || detail.data || rec, detail.summarizations || detail.summarization, detail.transcript);
        db.calls.unshift(call);
        db.tasks.unshift(...tasks);
        newCalls++;
        newTasks += tasks.length;
      } catch(e) { console.error("Failed " + rec.id + ": " + e.message); }
    }
    saveDB(db);
    res.json({ message: "Synced " + newCalls + " recordings, " + newTasks + " tasks added" });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sync/force", async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.pocketApiKey) return res.status(400).json({ error: "Not configured" });
  try {
    const list = await pocketGet("/public/recordings?limit=20");
    const recordings = list.recordings || list.data || [];
    const db = loadDB();
    db.calls = [];
    let count = 0;
    for (const rec of recordings) {
      try {
        const detail = await pocketGet("/public/recordings/" + rec.id + "?include=all");
        const { call, tasks } = processRecording(detail.recording || detail.data || rec, detail.summarizations || detail.summarization, detail.transcript);
        db.calls.push(call);
        for (const task of tasks) {
          if (!db.tasks.find(t => t.id === task.id)) db.tasks.unshift(task);
        }
        count++;
      } catch(e) { console.error("Failed " + rec.id + ": " + e.message); }
    }
    saveDB(db);
    res.json({ message: "Re-synced " + count + " recordings with full summaries" });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Webhook — no secret required ──────────────────────────────────────
app.post("/webhook/pocket", (req, res) => {
  let payload;
  try { payload = JSON.parse(req.body.toString()); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  const { event, recording, summarizations, transcript } = payload;
  console.log("[webhook] " + event + " - " + (recording && recording.id));
  if (event === "summary.completed" || event === "summary.regenerated") {
    const db = loadDB();
    const { call, tasks } = processRecording(recording, summarizations, transcript);
    const idx = db.calls.findIndex(c => c.id === call.id);
    if (idx >= 0) db.calls[idx] = call; else db.calls.unshift(call);
    for (const task of tasks) {
      if (!db.tasks.find(t => t.id === task.id)) db.tasks.unshift(task);
    }
    saveDB(db);
    console.log("[webhook] Saved: " + call.title + " | bullets: " + call.bulletPoints.length + " | transcript: " + call.transcript.length + " chars");
  }
  if (event === "action_items.updated") {
    const db = loadDB();
    for (const item of (payload.actionItems || [])) {
      const task = db.tasks.find(t => t.id === item.id);
      if (task) task.status = item.isCompleted ? "done" : "open";
    }
    saveDB(db);
  }
  res.json({ ok: true });
});

app.get("/health", (req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log("Denise backend on port " + PORT));
