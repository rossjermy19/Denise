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
function loadConfig() {
  const cfg = existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, "utf8")) : { pocketApiKey: "", configured: false };
  // Fall back to env var so key survives redeploys even without browser restore
  if (!cfg.pocketApiKey && process.env.POCKET_API_KEY) {
    cfg.pocketApiKey = process.env.POCKET_API_KEY;
    cfg.configured = true;
  }
  return cfg;
}
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
  // Save the key and return success — we verify it works when syncing recordings
  const cfg = loadConfig(); cfg.pocketApiKey = apiKey; cfg.configured = true; saveConfig(cfg);
  res.json({ ok: true, recordingCount: 0 });
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
  db.tasks.unshift({ id: "manual_" + Date.now(), text: req.body.text, due: req.body.due || "Today", status: "open", source: "manual", business: req.body.business || "moov", details: req.body.details || "", priority: req.body.priority || "auto" });
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

// ── Gmail via Anthropic API ──────────────────────────────────────────
app.post("/api/gmail/fetch", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(400).json({ error: "ANTHROPIC_API_KEY not set in Railway" });
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        system: `You have access to Gmail for ross.jermy@moovparcel.co.uk via the Gmail MCP tool.
List the 20 most recent emails from ALL labels/folders including sub-labels.
Return ONLY valid JSON, no markdown, no explanation:
{"emails":[{"id":"string","fromName":"string","fromEmail":"string","subject":"string","snippet":"string","date":"14 Mar","time":"14:32","unread":true,"needsReply":false,"replyReason":null}]}
Set needsReply true if the email contains a question, request or requires action from Ross.`,
        messages: [{ role: "user", content: "Fetch the 20 most recent emails and return as JSON." }],
        mcp_servers: [{ type: "url", url: "https://gmail.mcp.claude.com/mcp", name: "gmail" }]
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error("Anthropic error:", data.error);
      return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(400).json({ error: "Could not parse response", raw: text.slice(0, 200) });

    const parsed = JSON.parse(match[0]);
    res.json({ emails: parsed.emails || [] });
  } catch(e) {
    console.error("Gmail error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/gmail/debug", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(400).json({ error: "No ANTHROPIC_API_KEY" });
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: "List the subject lines of my 5 most recent Gmail emails as plain text." }],
        mcp_servers: [{ type: "url", url: "https://gmail.mcp.claude.com/mcp", name: "gmail" }]
      })
    });
    const data = await response.json();
    res.setHeader("Content-Type", "text/plain");
    res.send(JSON.stringify(data, null, 2).slice(0, 3000));
  } catch(e) { res.status(500).send(e.message); }
});


// ── Client-side sync (browser fetches Pocket, sends here to store) ──
app.post("/api/sync/client", (req, res) => {
  const { recordings } = req.body;
  if (!Array.isArray(recordings)) return res.status(400).json({ error: "Invalid data" });
  const db = loadDB();
  let added = 0;
  for (const r of recordings) {
    if (!r.id) continue;
    const exists = db.calls.find(c => c.id === r.id);
    if (!exists) {
      db.calls.push({
        id: r.id,
        title: r.title || "Untitled",
        createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        duration: r.duration || 0,
        summary: r.summary || null,
        bulletPoints: r.bullet_points || r.bulletPoints || [],
        transcript: r.transcript || null,
        actionItems: r.action_items || r.actionItems || [],
      });
      added++;
    }
  }
  saveDB(db);
  res.json({ ok: true, added, total: db.calls.length });
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

app.get("/api/gmail/debug", async (req, res) => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return res.status(400).json({ error: "No credentials" });
  const creds = Buffer.from(user + ":" + pass).toString("base64");
  const r = await fetch("https://mail.google.com/mail/feed/atom", {
    headers: { Authorization: "Basic " + creds }
  });
  const xml = await r.text();
  res.setHeader('Content-Type', 'text/plain');
  res.send(`Status: ${r.status}

${xml.slice(0, 2000)}`);
});

// ── Outlook integration ──────────────────────────────────────────────
// Calendar: fetched from published ICS feed, cached in memory for speed
import ical from "node-ical";

// ICS cache — refreshed every 5 minutes in background
let _icsCache = null;   // parsed ical data
let _icsCacheTime = 0;  // timestamp of last fetch
const ICS_CACHE_MS = 5 * 60 * 1000; // 5 minutes

async function getIcsData() {
  const icsUrl = process.env.OUTLOOK_ICS_URL;
  if (!icsUrl) return null;
  const now = Date.now();
  if (_icsCache && (now - _icsCacheTime) < ICS_CACHE_MS) return _icsCache;
  try {
    console.log("[Outlook ICS] Fetching fresh calendar data...");
    _icsCache = await ical.async.fromURL(icsUrl);
    _icsCacheTime = Date.now();
    const eventCount = Object.values(_icsCache).filter(ev => ev.type === "VEVENT").length;
    console.log(`[Outlook ICS] Cached ${eventCount} events`);
    return _icsCache;
  } catch (e) {
    console.error("[Outlook ICS] Fetch failed:", e.message);
    return _icsCache; // return stale cache if available
  }
}

// Pre-warm cache on startup
setTimeout(() => { if (process.env.OUTLOOK_ICS_URL) getIcsData(); }, 2000);
// Refresh cache every 5 minutes
setInterval(() => { if (process.env.OUTLOOK_ICS_URL) getIcsData(); }, ICS_CACHE_MS);

function filterEventsForDay(data, dayOffset) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const endOfDay = new Date(target); endOfDay.setDate(endOfDay.getDate() + 1);
  return Object.values(data)
    .filter(ev => ev.type === "VEVENT")
    .filter(ev => {
      const start = ev.start ? new Date(ev.start) : null;
      if (!start) return false;
      return start >= target && start < endOfDay;
    });
}

app.get("/api/outlook/status", (req, res) => {
  const icsUrl = process.env.OUTLOOK_ICS_URL || "";
  res.json({ configured: !!icsUrl, user: "ross.jermy@thedespatchcompany.com" });
});

// Outlook calendar — instant from cache
app.get("/api/outlook/calendar", async (req, res) => {
  const data = await getIcsData();
  if (!data) return res.status(400).json({ error: "Set OUTLOOK_ICS_URL in Railway env vars." });
  try {
    const dayOffset = parseInt(req.query.dayOffset || "0");
    const events = filterEventsForDay(data, dayOffset)
      .map(ev => {
        const start = new Date(ev.start);
        const allDay = ev.datetype === "date";
        return {
          title: ev.summary || "(No title)",
          startStr: allDay ? "All day" : start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          location: ev.location || "",
          attendees: (ev.attendee ? (Array.isArray(ev.attendee) ? ev.attendee : [ev.attendee]) : [])
            .map(a => typeof a === "string" ? a.replace("mailto:", "") : (a.params?.CN || a.val?.replace("mailto:", "") || ""))
            .slice(0, 5),
          hangoutLink: ev.url || "",
          source: "despatch",
        };
      })
      .sort((a, b) => a.startStr.localeCompare(b.startStr));
    res.json({ events });
  } catch (e) {
    console.error("[Outlook ICS]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Outlook calendar week summary — instant from cache
app.get("/api/outlook/calendar/week", async (req, res) => {
  const data = await getIcsData();
  if (!data) return res.json({ week: {} });
  try {
    const week = {};
    for (let i = 0; i < 7; i++) {
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
      week[key] = filterEventsForDay(data, i).length;
    }
    res.json({ week });
  } catch (e) {
    console.error("[Outlook ICS week]", e.message);
    res.json({ week: {} });
  }
});

// ── Claude API proxy ──────────────────────────────────────────────────
app.post("/api/claude", async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: "ANTHROPIC_API_KEY not set" });
  try {
    const { system, messages, model, max_tokens } = req.body;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 1500,
        system: system || "",
        messages: messages || []
      })
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
    res.json(data);
  } catch (e) {
    console.error("Claude proxy error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/webhook/pocket", (req, res) => res.json({ ok: true }));
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) => {
  const htmlPath = path.join(__dirname, "denise.html");
  if (existsSync(htmlPath)) res.sendFile(htmlPath);
  else res.status(404).send("denise.html not found — upload it to the repo alongside server.js");
});

app.listen(PORT, () => console.log("Denise backend on port " + PORT));
