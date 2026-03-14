import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const POCKET_BASE = "https://public.heypocketai.com/api/v1";
const CLICKUP_BASE = "https://api.clickup.com/api/v2";
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || "";
const CLICKUP_TEAM_ID = "4663587";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST","PATCH","DELETE","PUT","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.options("*", cors());
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

const DB_FILE = "./db.json";
const CONFIG_FILE = "./config.json";

function loadDB() { if (!existsSync(DB_FILE)) return { tasks: [], calls: [] }; return JSON.parse(readFileSync(DB_FILE, "utf8")); }
function saveDB(d) { writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); }
function loadConfig() { if (!existsSync(CONFIG_FILE)) return { pocketApiKey: "", configured: false }; return JSON.parse(readFileSync(CONFIG_FILE, "utf8")); }
function saveConfig(c) { writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); }

async function pocketGet(p, apiKey) {
  const key = apiKey || loadConfig().pocketApiKey;
  const res = await fetch(POCKET_BASE + p, { headers: { Authorization: "Bearer " + key } });
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
    call: { id: recording.id, title: recording.title || "Untitled", duration: recording.duration, createdAt: recording.createdAt, summary: summaryMarkdown, bulletPoints, speakers, transcript: transcriptText, actionItems },
    tasks: actionItems.map(item => ({ id: item.id || item.globalActionItemId || ("t_" + Date.now() + "_" + Math.random()), text: item.title, due: item.dueDate || "No date", status: (item.isCompleted || item.is_completed) ? "done" : "open", source: "pocket", recordingId: recording.id, recordingTitle: recording.title }))
  };
}

// ── Setup ─────────────────────────────────────────────────────────────
app.get("/api/setup", (req, res) => { const cfg = loadConfig(); res.json({ configured: cfg.configured, hasApiKey: !!cfg.pocketApiKey }); });
app.post("/api/setup/verify-key", async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith("pk_")) return res.status(400).json({ ok: false, error: "Key must start with pk_" });
  try { const data = await pocketGet("/public/recordings?limit=3", apiKey); res.json({ ok: true, recordingCount: (data.recordings || []).length }); }
  catch { res.status(400).json({ ok: false, error: "Invalid API key" }); }
});
app.post("/api/setup/save", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith("pk_")) return res.status(400).json({ ok: false, error: "Invalid key" });
  saveConfig({ pocketApiKey: apiKey, configured: false }); res.json({ ok: true });
});
app.post("/api/setup/verify-webhook", (req, res) => {
  const cfg = loadConfig(); const db = loadDB();
  if (db.calls.length > 0) { cfg.configured = true; saveConfig(cfg); return res.json({ ok: true }); }
  res.json({ ok: false, message: "No webhooks received yet. Make a short test recording first." });
});
app.post("/api/setup/complete", (req, res) => { const cfg = loadConfig(); cfg.configured = true; saveConfig(cfg); res.json({ ok: true }); });

// ── Pocket data ───────────────────────────────────────────────────────
app.get("/api/data", (req, res) => {
  const db = loadDB();
  res.json({ tasks: db.tasks, calls: db.calls, stats: { open: db.tasks.filter(t => t.status === "open").length, done: db.tasks.filter(t => t.status === "done").length, overdue: db.tasks.filter(t => t.status === "overdue").length, totalCalls: db.calls.length } });
});
app.patch("/api/tasks/:id", (req, res) => {
  const db = loadDB(); const task = db.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Not found" });
  task.status = task.status === "done" ? "open" : "done"; if (task.status === "done") task.due = "Done";
  saveDB(db); res.json(task);
});
app.post("/api/tasks", (req, res) => {
  const db = loadDB();
  db.tasks.unshift({ id: "manual_" + Date.now(), text: req.body.text, due: req.body.due || "Today", status: "open", source: "manual" });
  saveDB(db); res.json(db.tasks[0]);
});
app.delete("/api/calls/:id", (req, res) => {
  const db = loadDB(); db.calls = db.calls.filter(c => c.id !== req.params.id); db.tasks = db.tasks.filter(t => t.recordingId !== req.params.id);
  saveDB(db); res.json({ ok: true });
});
app.post("/api/sync", async (req, res) => {
  const cfg = loadConfig(); if (!cfg.pocketApiKey) return res.status(400).json({ error: "Not configured" });
  try {
    // Get actual count from Pocket first
    const list = await pocketGet("/public/recordings?limit=50");
    const recordings = (list.recordings || list.data || []).slice(0, 20);
    const db = loadDB(); let newCalls = 0, newTasks = 0;
    for (const rec of recordings) {
      if (db.calls.find(c => c.id === rec.id)) continue;
      try {
        const detail = await pocketGet("/public/recordings/" + rec.id + "?include=all");
        const { call, tasks } = processRecording(detail.recording || rec, detail.summarizations, detail.transcript);
        db.calls.unshift(call); db.tasks.unshift(...tasks); newCalls++; newTasks += tasks.length;
      } catch(e) { console.error("Failed " + rec.id + ": " + e.message); }
    }
    saveDB(db); res.json({ message: "Synced " + newCalls + " recordings, " + newTasks + " tasks added" });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/sync/force", async (req, res) => {
  const cfg = loadConfig(); if (!cfg.pocketApiKey) return res.status(400).json({ error: "Not configured" });
  try {
    const list = await pocketGet("/public/recordings?limit=50");
    const recordings = list.recordings || list.data || [];
    const db = loadDB(); db.calls = []; let count = 0;
    for (const rec of recordings) {
      try {
        const detail = await pocketGet("/public/recordings/" + rec.id + "?include=all");
        const { call, tasks } = processRecording(detail.recording || rec, detail.summarizations, detail.transcript);
        db.calls.push(call); for (const t of tasks) { if (!db.tasks.find(x => x.id === t.id)) db.tasks.unshift(t); } count++;
      } catch(e) { console.error("Failed " + rec.id + ": " + e.message); }
    }
    saveDB(db); res.json({ message: "Re-synced " + count + " recordings with full summaries" });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ClickUp — assigned to me, priority 1+2 only ───────────────────────
app.get("/api/clickup/priority-tasks", async (req, res) => {
  if (!CLICKUP_API_KEY) return res.status(400).json({ error: "CLICKUP_API_KEY not set in Railway" });
  try {
    // Get current user
    const userRes = await fetch(CLICKUP_BASE + "/user", { headers: { Authorization: CLICKUP_API_KEY } });
    const userData = await userRes.json();
    const userId = userData.user?.id;
    if (!userId) {
      console.error("ClickUp user response:", JSON.stringify(userData).slice(0, 200));
      return res.status(400).json({ error: "Could not get ClickUp user ID. Check API key is valid." });
    }
    console.log("ClickUp userId:", userId);

    // Fetch urgent + high priority, assigned to this user only
    const headers = { Authorization: CLICKUP_API_KEY };
    const [r1, r2] = await Promise.all([
      fetch(`${CLICKUP_BASE}/team/${CLICKUP_TEAM_ID}/task?assignees%5B%5D=${userId}&include_closed=false&priority%5B%5D=1`, { headers }),
      fetch(`${CLICKUP_BASE}/team/${CLICKUP_TEAM_ID}/task?assignees%5B%5D=${userId}&include_closed=false&priority%5B%5D=2`, { headers })
    ]);
    const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
    console.log("Urgent tasks:", d1.tasks?.length, "High tasks:", d2.tasks?.length);

    // Filter server-side by assignee in case the API param is ignored
    const myUrgent = (d1.tasks || []).filter(t => (t.assignees || []).some(a => String(a.id) === String(userId)));
    const myHigh = (d2.tasks || []).filter(t => (t.assignees || []).some(a => String(a.id) === String(userId)));
    console.log(`After filtering: ${myUrgent.length} urgent, ${myHigh.length} high for userId ${userId}`);

    // Filter out resolved/completed tasks
    const isResolved = t => {
      const name = (t.name || '').toLowerCase();
      const status = (t.status?.status || '').toLowerCase();
      return name.includes('resolved') || name.includes('✅') || name.startsWith('✓') ||
             status === 'complete' || status === 'closed' || status === 'resolved' ||
             status === 'done' || status === 'cancelled' || status === 'canceled';
    };
    const filtered = [
      ...myUrgent.filter(t => !isResolved(t)).map(t => ({ ...t, _pl: "urgent" })),
      ...myHigh.filter(t => !isResolved(t)).map(t => ({ ...t, _pl: "high" }))
    ];
    console.log(`After resolved filter: ${filtered.length} tasks (was ${myUrgent.length + myHigh.length})`);

    const tasks = filtered.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status?.status || "open",
      statusColor: t.status?.color || "#888",
      priority: t._pl,
      priorityColor: t._pl === "urgent" ? "#DC2626" : "#D97706",
      dueDate: t.due_date ? new Date(parseInt(t.due_date)).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null,
      dueDateRaw: t.due_date,
      list: t.list?.name || "",
      url: t.url,
    }));
    res.json({ tasks, userId });
  } catch(e) { console.error("ClickUp error:", e.message); res.status(500).json({ error: e.message }); }
});

app.get("/api/clickup/debug", async (req, res) => {
  if (!CLICKUP_API_KEY) return res.status(400).json({ error: "No key" });
  try {
    const userRes = await fetch(CLICKUP_BASE + "/user", { headers: { Authorization: CLICKUP_API_KEY } });
    const userData = await userRes.json();
    const userId = userData.user?.id;
    const r = await fetch(`${CLICKUP_BASE}/team/${CLICKUP_TEAM_ID}/task?assignees%5B%5D=${userId}&include_closed=false&priority%5B%5D=1&limit=3`, { headers: { Authorization: CLICKUP_API_KEY } });
    const d = await r.json();
    // Return full raw first task so we can see every field
    res.json({ userId, totalRaw: d.tasks?.length, firstTask: d.tasks?.[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/clickup/tasks/:id/complete", async (req, res) => {
  if (!CLICKUP_API_KEY) return res.status(400).json({ error: "CLICKUP_API_KEY not set" });
  try {
    // Try "complete" first, then "closed"
    for (const status of ["complete", "closed"]) {
      const r = await fetch(`${CLICKUP_BASE}/task/${req.params.id}`, { method: "PUT", headers: { Authorization: CLICKUP_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (r.ok) return res.json({ ok: true });
    }
    res.status(400).json({ ok: false, error: "Could not mark complete" });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Gmail via Atom feed ───────────────────────────────────────────────
app.post("/api/gmail/fetch", async (req, res) => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return res.status(400).json({ error: "GMAIL_USER and GMAIL_APP_PASSWORD not set in Railway" });
  try {
    const creds = Buffer.from(user + ":" + pass).toString("base64");
    // Fetch unread inbox (atom feed only returns unread messages)
    const r = await fetch("https://mail.google.com/mail/feed/atom/inbox", {
      headers: { Authorization: "Basic " + creds, Accept: "application/atom+xml" }
    });
    if (!r.ok) return res.status(400).json({ error: "Gmail returned " + r.status + " — check credentials" });
    const xml = await r.text();

    // Parse entries from Atom XML
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    const entries = [];
    for (const m of entryMatches) {
      const entry = m[1];
      const getTag = (tag) => { const rx = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">"); const found = entry.match(rx); return found ? found[1].trim() : ""; };
      const authorBlock = entry.match(/<author>([\s\S]*?)<\/author>/);
      const fromName = authorBlock ? (authorBlock[1].match(/<name>([\s\S]*?)<\/name>/) || [])[1] || "" : "";
      const fromEmail = authorBlock ? (authorBlock[1].match(/<email>([\s\S]*?)<\/email>/) || [])[1] || "" : "";
      const issued = getTag("issued") || getTag("modified") || "";
      const dt = issued ? new Date(issued) : new Date();
      entries.push({
        id: getTag("id"),
        subject: getTag("title") || "(no subject)",
        fromName: fromName.trim(),
        fromEmail: fromEmail.trim(),
        from: fromName.trim() + " <" + fromEmail.trim() + ">",
        snippet: getTag("summary").slice(0, 120),
        body: getTag("summary").slice(0, 400),
        date: isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        time: isNaN(dt.getTime()) ? "" : dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        unread: true,
        needsReply: false,
        replyReason: null,
      });
    }

    // Use Claude Haiku to flag which emails need replies
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && entries.length > 0) {
      try {
        const ctx = entries.map((e, i) => (i+1) + ". From: " + e.fromName + " | Subject: " + e.subject + " | Preview: " + e.snippet).join("\n");
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            system: "You analyse emails for Ross Jermy at Moov Parcel (UK shipping logistics). Return ONLY a JSON array of 1-based indexes of emails needing a reply — questions, requests, action required. Example: [1,3,5]. No other text.",
            messages: [{ role: "user", content: "Which need a reply?\n" + ctx }]
          })
        });
        const aiData = await aiRes.json();
        const aiText = ((aiData.content || []).find(b => b.type === "text") || {}).text || "[]";
        const match = aiText.match(/\[[\s\S]*?\]/);
        const indexes = match ? JSON.parse(match[0]) : [];
        indexes.forEach(idx => { if (entries[idx-1]) entries[idx-1].needsReply = true; });
      } catch(e) { console.error("AI flagging error:", e.message); }
    }

    res.json({ emails: entries });
  } catch(e) { console.error("Gmail feed error:", e.message); res.status(500).json({ error: e.message }); }
});


// ── Webhook ───────────────────────────────────────────────────────────
app.post("/webhook/pocket", (req, res) => {
  let payload; try { payload = JSON.parse(req.body.toString()); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  const { event, recording, summarizations, transcript } = payload;
  console.log("[webhook] " + event + " - " + (recording?.id));
  if (event === "summary.completed" || event === "summary.regenerated") {
    const db = loadDB(); const { call, tasks } = processRecording(recording, summarizations, transcript);
    const idx = db.calls.findIndex(c => c.id === call.id);
    if (idx >= 0) db.calls[idx] = call; else db.calls.unshift(call);
    for (const task of tasks) { if (!db.tasks.find(t => t.id === task.id)) db.tasks.unshift(task); }
    saveDB(db); console.log("[webhook] Saved:", call.title, "| bullets:", call.bulletPoints.length);
  }
  if (event === "action_items.updated") {
    const db = loadDB();
    for (const item of (payload.actionItems || [])) { const t = db.tasks.find(t => t.id === item.id); if (t) t.status = item.isCompleted ? "done" : "open"; }
    saveDB(db);
  }
  res.json({ ok: true });
});

app.get("/webhook/pocket", (req, res) => res.json({ ok: true }));
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) => {
  const htmlPath = path.join(__dirname, "denise.html");
  if (existsSync(htmlPath)) res.sendFile(htmlPath);
  else res.status(404).send("denise.html not found — upload it to the repo alongside server.js");
});

app.listen(PORT, () => console.log("Denise backend on port " + PORT));
