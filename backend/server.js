/**
 * Automation Builder — robust server (Groq + Heuristics + Coercion)
 */

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { google } = require("googleapis");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");

// -------------------- Config --------------------
const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || "./public");
const DATA_DIR = path.resolve("./data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------- Token store (file/redis) ----------------
const TOKEN_STORE = (process.env.TOKEN_STORE || "file").toLowerCase();
let kv = null;
if (TOKEN_STORE === "redis") {
  kv = {
    async get(key) {
      const resp = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command: ["GET", key] }),
      });
      const j = await resp.json();
      return j.result ? JSON.parse(j.result) : null;
    },
    async set(key, value) {
      await fetch(process.env.UPSTASH_REDIS_REST_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command: ["SET", key, JSON.stringify(value)] }),
      });
    },
    async del(key) {
      await fetch(process.env.UPSTASH_REDIS_REST_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command: ["DEL", key] }),
      });
    },
  };
} else {
  const FILE = path.join(DATA_DIR, "tokens.json");
  const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {});
  const save = (obj) => fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
  kv = {
    async get(key) {
      const all = load();
      return all[key] || null;
    },
    async set(key, value) {
      const all = load();
      all[key] = value;
      save(all);
    },
    async del(key) {
      const all = load();
      delete all[key];
      save(all);
    },
  };
}

// ---------------- Express ----------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("tiny"));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.get("/api/debug/staticDir", (req, res) => {
  res.json({ ok: true, PUBLIC_DIR, TOKEN_STORE });
});
app.get("/wizard_plus.html", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "wizard_plus.html"));
});

// ---------------- Google OAuth ----------------
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || "",
  process.env.GOOGLE_CLIENT_SECRET || "",
  process.env.GOOGLE_REDIRECT_URI || ""
);
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
];
const TOKEN_KEY = "google_tokens";

async function getTokens() { return (await kv.get(TOKEN_KEY)) || null; }
async function setTokens(t) { await kv.set(TOKEN_KEY, t); }
async function clearTokens() { await kv.del(TOKEN_KEY); }
async function getAuthedClient() {
  const tokens = await getTokens();
  if (!tokens) return null;
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

app.get("/api/google/oauth/url", async (req, res) => {
  try {
    const url = oauth2Client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
    res.json({ ok: true, url });
  } catch (e) { res.json({ ok: false, error: "OAUTH_URL_FAILED", details: String(e) }); }
});
app.get("/api/google/oauth/callback", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    await setTokens(tokens);
    res.send(`<script>if(window.opener){window.opener.location.hash='#connected=1';window.close();}else{location.href='/wizard_plus.html#connected=1'}</script>`);
  } catch { res.status(500).send("OAuth callback failed"); }
});
app.get("/api/google/auth/status", async (req, res) => {
  const t = await getTokens();
  res.json({ ok: true, hasRefreshToken: !!(t && t.refresh_token) });
});
app.get("/api/google/me", async (req, res) => {
  try {
    const client = await getAuthedClient();
    if (!client) return res.status(401).json({ ok: false, error: "NO_TOKENS" });
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    res.json({ ok: true, ...me.data });
  } catch { res.json({ ok: false, error: "GOOGLE_ME_FAILED" }); }
});
app.post("/api/google/logout", async (req, res) => { await clearTokens(); res.json({ ok: true }); });

// ---------------- Google helpers ----------------
async function getGmail() {
  const client = await getAuthedClient();
  if (!client) throw new Error("NO_TOKENS");
  return google.gmail({ version: "v1", auth: client });
}
async function getSheets() {
  const client = await getAuthedClient();
  if (!client) throw new Error("NO_TOKENS");
  return google.sheets({ version: "v4", auth: client });
}

// ---------------- Email (SMTP) ----------------
function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// ---------------- WhatsApp (Twilio) ----------------
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try { twilioClient = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); } catch {}
}

// ===================== NLU helpers =====================
function normalizeHeb(text = "") {
  return String(text || "")
    .replace(/[\u200e\u200f]/g, "")
    .replace(/[“”„״]/g, '"')
    .replace(/[’׳]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/ו?וואטסאפ|ווטסאפ|וואטסאפ/gi, "WhatsApp")
    .replace(/גוגל\s*שיט|שיט\b|גיליון/gi, "Sheet")
    .replace(/\bבשם\s+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
function extractEntities(text = "") {
  const out = {};
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  if (emails?.length) out.emails = Array.from(new Set(emails));
  const phones = text.match(/\b\+?\d{9,15}\b/g);
  if (phones?.length) out.phones = Array.from(new Set(phones));
  const h = text.match(/(\d+)\s*שעות?/); if (h) out.hours = +h[1];
  const d = text.match(/(\d+)\s*ימים?/); if (d) out.days = +d[1];
  if (/חודש|30\s*יום/.test(text)) out.days = out.days || 30;
  const m = text.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); if (m) out.spreadsheetId = m[1];
  const cm = text.match(/"([^"]+)"|'([^']+)'/); if (cm) out.columnName = cm[1] || cm[2];
  return out;
}

// ---------------- Heuristics ----------------
function heuristicsPlan(textRaw = "") {
  const text = normalizeHeb(textRaw);
  const entities = extractEntities(text);

  if (/שלא\s*נענה/.test(text) && /מייל/.test(text)) {
    const proposal = [
      { trigger: { type: "gmail.unreplied", params: { fromEmail: entities.emails?.[0] || "", newerThanDays: entities.days || 30, hours: entities.hours || 10, limit: 50 } } },
    ];
    if (/whatsapp/i.test(text)) {
      proposal.push({ action: { type: "whatsapp.send", params: { to: entities.phones?.[0] ? "whatsapp:" + entities.phones[0] : "", message: "נמצא מייל שלא נענה: {{item.subject}} {{item.webLink}}" } } });
    } else if (/sheet/i.test(text)) {
      proposal.push({ action: { type: "sheets.append", params: { spreadsheetId: entities.spreadsheetId || "", sheetName: "InboxLog", row: { from: "{{item.from}}", subject: "{{item.subject}}", date: "{{item.date}}", threadId: "{{item.threadId}}", webLink: "{{item.webLink}}" } } } });
    } else {
      proposal.push({ action: { type: "email.send", params: { to: entities.emails?.[1] || "", subject: "מייל שלא נענה: {{item.subject}}", body: "{{item.webLink}}" } } });
    }
    const missing = [];
    if (!proposal[0].trigger.params.fromEmail) missing.push({ key: "fromEmail", label: "כתובת המייל של השולח", example: "name@example.com" });
    const act = proposal[1].action;
    if (act.type === "sheets.append" && !act.params.spreadsheetId) missing.push({ key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" });
    if (act.type === "email.send" && !act.params.to) missing.push({ key: "to", label: "כתובת מייל לקבלת ההתראה", example: "name@example.com" });
    if (act.type === "whatsapp.send" && !act.params.to) missing.push({ key: "to", label: "מספר WhatsApp בינ\"ל", example: "9725xxxxxxxx" });
    return { ok: true, provider: "heuristic", proposal, missing, nlp: null };
  }

  if (/טבלה משותפת|שני אנשים|שני\s+שולחים/.test(text) && /שולח(ים)?\s*מייל/.test(text)) {
    const proposal = [
      { trigger: { type: "gmail.sent", params: { fromEmails: [], newerThanDays: entities.days || 30, limit: 50 } } },
      { action: { type: "sheets.append", params: { spreadsheetId: entities.spreadsheetId || "", sheetName: "InboxLog", row: { from: "{{item.from}}", date: "{{item.date}}", subject: "{{item.subject}}", snippet: "{{item.snippet}}" } } } },
    ];
    const missing = [];
    if (!proposal[0].trigger.params.fromEmails?.length) missing.push({ key: "fromEmails", label: "שמות/אימיילים של שני האנשים", example: "a@example.com,b@example.com" });
    if (!proposal[1].action.params.spreadsheetId) missing.push({ key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" });
    return { ok: true, provider: "heuristic", proposal, missing, nlp: null };
  }

  if (/עמוד(ה|ות)|שדה/.test(text) && /שווה|שווה ל|מכיל/.test(text) && /גיליון|Sheet/i.test(text)) {
    const proposal = [
      { trigger: { type: "sheets.match", params: { spreadsheetId: "", sheetName: "Sheet1", columnName: entities.columnName || "", equals: "", mode: "new" } } },
      { action: { type: "email.send", params: { to: entities.emails?.[0] || "", subject: "התראה מגיליון {{item.__sheet}}", body: "{{item.__rowAsText}}" } } },
    ];
    const missing = [];
    if (!proposal[0].trigger.params.spreadsheetId) missing.push({ key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" });
    if (!proposal[0].trigger.params.columnName) missing.push({ key: "columnName", label: "שם העמודה/השדה", example: "project menger" });
    missing.push({ key: "equals", label: "הערך שתואם להתראה", example: "haim shafir" });
    if (!proposal[1].action.params.to) missing.push({ key: "to", label: "כתובת מייל לקבלת ההתראה", example: "name@example.com" });
    return { ok: true, provider: "heuristic", proposal, missing, nlp: null };
  }

  return { ok: true, provider: "heuristic", proposal: [], missing: [], nlp: null };
}

// ---------------- Groq planner ----------------
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const JSON_SCHEMA_PROMPT = `
אתה מתכנן אוטומציות. קלט: משפט חופשי בעברית.
החזר JSON **בלבד** במבנה:
{
  "proposal": [
    { "trigger": { "type": "<one-of: gmail.unreplied | gmail.sent | sheets.match>", "params": { ... } } },
    { "action":  { "type": "<one-of: sheets.append | email.send | whatsapp.send | slack.post | telegram.send | webhook.post>", "params": { ... } } }
  ],
  "missing": [ { "key": "...", "label": "...", "example": "..." } ],
  "questions": [ "..." ]
}

שמות שדות מותריים בלבד (אל תמציא שמות אחרים):
- gmail.unreplied: { fromEmail, newerThanDays, hours, limit }
  ***אסור להשתמש בשדה בשם "duration"***. אם המשתמש כתב "10 שעות" → hours: 10. אם כתב "חודש" → newerThanDays: 30.
- gmail.sent:      { fromEmails (array), newerThanDays, limit }
- sheets.match:    { spreadsheetId, sheetName, columnName, equals, mode="new" }
- sheets.append:   { spreadsheetId, sheetName, row: { ... } }  ← אל תשאיר params ריק!
- email.send:      { to, subject, body }
- whatsapp.send:   { to, message }  (to יכול להיות "whatsapp:+9725xxxxxxx")
- slack.post:      { webhookUrl, message }
- telegram.send:   { botToken, chatId, message }
- webhook.post:    { url, method="POST", json: { ... } }

אם חסר ערך קריטי – הכנס אותו ל-missing עם label וה-example בעברית.
החזר JSON חוקי בלבד.
`;

const FEWSHOTS = [
  {
    user: 'כל מייל מ-haim@example.com שלא נענה 10 שעות ב-30 ימים — רשומה ב-Google Sheet בשם "InboxLog"',
    out: {
      proposal: [
        { trigger: { type: "gmail.unreplied", params: { fromEmail: "haim@example.com", newerThanDays: 30, hours: 10, limit: 50 } } },
        { action:  { type: "sheets.append", params: { spreadsheetId: "", sheetName: "InboxLog", row: { from: "{{item.from}}", subject: "{{item.subject}}", date: "{{item.date}}", webLink: "{{item.webLink}}" } } } }
      ],
      missing: [{ key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" }],
      questions: []
    }
  },
  {
    user: "אני רוצה טבלה לשני אנשים; כל פעם שאחד מהם שולח מייל—להוסיף שורה עם השולח, התאריך, הנושא, והתוכן",
    out: {
      proposal: [
        { trigger: { type: "gmail.sent", params: { fromEmails: [], newerThanDays: 30, limit: 50 } } },
        { action:  { type: "sheets.append", params: { spreadsheetId: "", sheetName: "InboxLog", row: { from: '{{item.from}}', date: '{{item.date}}', subject: '{{item.subject}}', snippet: '{{item.snippet}}' } } } }
      ],
      missing: [
        { key: "fromEmails", label: "שמות/אימיילים של שני האנשים", example: "a@example.com,b@example.com" },
        { key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" }
      ],
      questions: []
    }
  }
];

async function groqPlan(textRaw = "") {
  if (!GROQ_API_KEY) return { ok: false, error: "GROQ_MISSING_KEY" };
  const text = normalizeHeb(textRaw);

  const messages = [{ role: "system", content: JSON_SCHEMA_PROMPT }];
  FEWSHOTS.forEach(fs => {
    messages.push({ role: "user", content: fs.user });
    messages.push({ role: "assistant", content: JSON.stringify(fs.out) });
  });
  messages.push({ role: "user", content: text });

  const body = { model: GROQ_MODEL, temperature: 0, response_format: { type: "json_object" }, messages };
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    return { ok: false, error: "GROQ_HTTP_ERROR", details: err.slice(0, 500) };
  }
  const j = await resp.json();
  let parsed = {};
  try { parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}"); }
  catch { return { ok: false, error: "GROQ_PARSE_ERROR" }; }
  parsed.proposal = Array.isArray(parsed.proposal) ? parsed.proposal : [];
  parsed.missing  = Array.isArray(parsed.missing)  ? parsed.missing  : [];
  parsed.questions= Array.isArray(parsed.questions)? parsed.questions: [];
  return { ok: true, provider: "groq", ...parsed };
}

// -------------- Coercion: make LLM output canonical --------------
function ensureMissing(missingArr, key, label, example) {
  const exists = (missingArr || []).some(m => m.key === key);
  if (!exists) missingArr.push({ key, label, example });
}
function coercePlan(plan, originalText = "") {
  if (!plan || !Array.isArray(plan.proposal)) return plan;
  const missing = Array.isArray(plan.missing) ? plan.missing : [];
  const ents = extractEntities(originalText);

  // Walk through steps and fix params
  plan.proposal.forEach(step => {
    if (step.trigger?.type === "gmail.unreplied") {
      const p = step.trigger.params = step.trigger.params || {};
      // map duration → hours
      if (typeof p.duration === "string") {
        const m = p.duration.match(/(\d+)/); if (m) p.hours = +m[1];
        delete p.duration;
      }
      if (p.hours == null && ents.hours) p.hours = ents.hours;
      if (p.newerThanDays == null) p.newerThanDays = ents.days || 30;
      if (p.limit == null) p.limit = 50;
      if (!p.fromEmail && ents.emails?.length) p.fromEmail = ents.emails[0];
      if (!p.fromEmail) ensureMissing(missing, "fromEmail", "כתובת המייל של השולח", "name@example.com");
    }

    if (step.trigger?.type === "gmail.sent") {
      const p = step.trigger.params = step.trigger.params || {};
      if (!Array.isArray(p.fromEmails) || !p.fromEmails.length) {
        if (ents.emails?.length) p.fromEmails = ents.emails.slice(0, 2);
      }
      if (!p.fromEmails || !p.fromEmails.length) {
        ensureMissing(missing, "fromEmails", "שמות/אימיילים של שני האנשים", "a@example.com,b@example.com");
      }
      if (p.newerThanDays == null) p.newerThanDays = ents.days || 30;
      if (p.limit == null) p.limit = 50;
    }

    if (step.trigger?.type === "sheets.match") {
      const p = step.trigger.params = step.trigger.params || {};
      if (!p.spreadsheetId && ents.spreadsheetId) p.spreadsheetId = ents.spreadsheetId;
      if (!p.sheetName) p.sheetName = p.sheetName || "Sheet1";
      if (!p.spreadsheetId) ensureMissing(missing, "spreadsheetId", "ה-ID של ה-Google Sheet", "https://docs.google.com/spreadsheets/d/<ID>/edit");
      if (!p.columnName && ents.columnName) p.columnName = ents.columnName;
      if (!p.columnName) ensureMissing(missing, "columnName", "שם העמודה/השדה", "project menger");
      if (p.equals == null) ensureMissing(missing, "equals", "הערך שתואם להתראה", "haim shafir");
      if (!p.mode) p.mode = "new";
    }

    if (step.action?.type === "sheets.append") {
      const p = step.action.params = step.action.params || {};
      if (!p.spreadsheetId && ents.spreadsheetId) p.spreadsheetId = ents.spreadsheetId;
      if (!p.sheetName) p.sheetName = "InboxLog";
      if (!p.row || typeof p.row !== "object" || !Object.keys(p.row).length) {
        // default row based on last trigger type
        const trig = plan.proposal.find(s => s.trigger)?.trigger;
        if (trig?.type === "gmail.sent") {
          p.row = { from: "{{item.from}}", date: "{{item.date}}", subject: "{{item.subject}}", snippet: "{{item.snippet}}" };
        } else {
          p.row = { from: "{{item.from}}", subject: "{{item.subject}}", date: "{{item.date}}", threadId: "{{item.threadId}}", webLink: "{{item.webLink}}" };
        }
      }
      if (!p.spreadsheetId) ensureMissing(missing, "spreadsheetId", "ה-ID של ה-Google Sheet", "https://docs.google.com/spreadsheets/d/<ID>/edit");
      // אל תשאל "row" – נתנו ברירת־מחדל
    }

    if (step.action?.type === "email.send") {
      const p = step.action.params = step.action.params || {};
      if (!p.to && ents.emails?.[0]) p.to = ents.emails[0];
      if (!p.subject) p.subject = "התראה";
      if (!p.body) p.body = "{{item.__rowAsText}}";
      if (!p.to) ensureMissing(missing, "to", "כתובת מייל לקבלת ההתראה", "name@example.com");
    }

    if (step.action?.type === "whatsapp.send") {
      const p = step.action.params = step.action.params || {};
      if (!p.to && ents.phones?.[0]) p.to = "whatsapp:" + ents.phones[0];
      if (!p.message) p.message = "נמצא פריט: {{item.subject}} {{item.webLink}}";
      if (!p.to) ensureMissing(missing, "to", "מספר WhatsApp בינ\"ל", "9725xxxxxxxx");
    }
  });

  // דילול כפילויות ב-missing
  const uniq = {};
  plan.missing = missing.filter(m => {
    if (uniq[m.key]) return false;
    uniq[m.key] = 1;
    return true;
  });
  return plan;
}

// ---------------- Planner endpoint ----------------
app.post("/api/plan/from-text", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    let plan = heuristicsPlan(text);
    if (!plan.proposal?.length) {
      const llm = await groqPlan(text);
      if (llm.ok) plan = llm;
    }
    // תקנון (coercion) כדי שעמוד תמיד בסכמה
    plan = coercePlan(plan, text);
    if (!plan.proposal?.length) {
      plan.questions = plan.questions || [];
      plan.questions.push('התכוונת אולי: (1) מיילים שנשלחו ע"י אנשים מסוימים → שורה בגיליון, (2) מיילים שלא נענו → התרעה?');
    }
    res.json(plan);
  } catch (e) {
    res.json({ ok: false, error: "PLAN_FAILED", details: String(e) });
  }
});

// ================= Execution =================
async function execTrigger(trigger) {
  const type = trigger.type;
  const p = trigger.params || {};
  if (type === "gmail.unreplied") {
    const gmail = await getGmail();
    const qParts = [];
    if (p.fromEmail) qParts.push(`from:${p.fromEmail}`);
    if (p.newerThanDays) qParts.push(`newer_than:${p.newerThanDays}d`);
    const q = qParts.join(" ");
    const list = await gmail.users.messages.list({ userId: "me", q, maxResults: p.limit || 50 });
    const items = [];
    for (const m of list.data.messages || []) {
      const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] });
      const hdr = Object.fromEntries((full.data.payload?.headers || []).map(h => [h.name, h.value]));
      items.push({
        id: full.data.id, threadId: full.data.threadId,
        from: hdr.From || "", subject: hdr.Subject || "", date: hdr.Date || "",
        webLink: `https://mail.google.com/mail/u/0/#inbox/${full.data.threadId}`,
      });
      if (items.length >= (p.limit || 50)) break;
    }
    return items;
  }

  if (type === "gmail.sent") {
    const gmail = await getGmail();
    const qParts = []; if (p.newerThanDays) qParts.push(`newer_than:${p.newerThanDays}d`);
    const q = qParts.join(" ");
    const list = await gmail.users.messages.list({ userId: "me", q, maxResults: p.limit || 50 });
    const froms = (p.fromEmails || []).filter(Boolean);
    const items = [];
    for (const m of list.data.messages || []) {
      const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
      const hdr = Object.fromEntries((full.data.payload?.headers || []).map(h => [h.name, h.value]));
      const from = hdr.From || ""; const subject = hdr.Subject || ""; const snippet = full.data.snippet || ""; const date = hdr.Date || "";
      const threadId = full.data.threadId;
      const senderEmail = (from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || "";
      if (!froms.length || froms.includes(senderEmail)) {
        items.push({ from, subject, snippet, date, threadId, webLink: `https://mail.google.com/mail/u/0/#inbox/${threadId}` });
      }
      if (items.length >= (p.limit || 50)) break;
    }
    return items;
  }

  if (type === "sheets.match") {
    const sheets = await getSheets();
    const sid = p.spreadsheetId; const sn = p.sheetName || "Sheet1";
    if (!sid) throw new Error("SPREADSHEET_ID_REQUIRED");
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: `${sn}!A:Z` });
    const rows = resp.data.values || []; const headers = rows[0] || [];
    const idx = headers.findIndex(h => (h || "").toString().trim().toLowerCase() === (p.columnName || "").toString().trim().toLowerCase());
    if (idx === -1) return [];
    const items = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || []; const val = (row[idx] || "").toString();
      if (p.equals ? val === p.equals : !!val) items.push({ __sheet: sn, __rowAsText: row.join(" | "), values: row });
    }
    return items;
  }

  return [];
}

async function execAction(action, item, ctx) {
  const type = action.type; const p = action.params || {}; const dry = !!ctx.dryRun;

  if (type === "sheets.append") {
    const sid = p.spreadsheetId, sn = p.sheetName || "Sheet1";
    if (!sid) throw new Error("SPREADSHEET_ID_REQUIRED");
    const render = (s) => String(s || "").replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => (item && item[k] != null ? String(item[k]) : ""));
    const rowTmpl = p.row || {}; const row = Object.keys(rowTmpl).map(k => render(rowTmpl[k]));
    if (dry) return { ok: true, dry: true, appended: row };
    const sheets = await getSheets();
    await sheets.spreadsheets.values.append({ spreadsheetId: sid, range: `${sn}!A:Z`, valueInputOption: "USER_ENTERED", requestBody: { values: [row] } });
    return { ok: true, appended: row };
  }

  if (type === "email.send") {
    const mailer = getMailer(); if (!mailer) return { ok: false, error: "SMTP_NOT_CONFIGURED" };
    const to = p.to || "";
    const subject = (p.subject || "").replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => item?.[k] || "");
    const body = (p.body || "").replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => item?.[k] || "");
    if (dry) return { ok: true, dry: true, to, subject, body };
    await mailer.sendMail({ from: process.env.SMTP_USER, to, subject, text: body });
    return { ok: true, to, subject };
  }

  if (type === "whatsapp.send") {
    if (!twilioClient) return { ok: false, error: "TWILIO_NOT_CONFIGURED" };
    const to = p.to?.startsWith("whatsapp:") ? p.to : "whatsapp:" + (p.to || "");
    const from = process.env.TWILIO_WHATSAPP_FROM;
    const message = (p.message || "").replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => item?.[k] || "");
    if (dry) return { ok: true, dry: true, to, message };
    const res = await twilioClient.messages.create({ from, to, body: message });
    return { ok: true, sid: res.sid };
  }

  if (type === "slack.post") {
    const url = p.webhookUrl; const message = (p.message || "").replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => item?.[k] || "");
    if (dry) return { ok: true, dry: true, to: "slack.webhook", message };
    if (!url) return { ok: false, error: "SLACK_WEBHOOK_REQUIRED" };
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: message }) });
    return { ok: resp.ok };
  }

  if (type === "telegram.send") {
    const token = p.botToken, chatId = p.chatId;
    const message = (p.message || "").replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => item?.[k] || "");
    if (dry) return { ok: true, dry: true, to: "telegram", message };
    if (!token || !chatId) return { ok: false, error: "TELEGRAM_CONFIG_REQUIRED" };
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: message }) });
    const jj = await resp.json();
    return { ok: resp.ok, details: jj };
  }

  if (type === "webhook.post") {
    const url = p.url, method = p.method || "POST", json = p.json || {};
    const rendered = JSON.parse(JSON.stringify(json).replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => item?.[k] || ""));
    if (dry) return { ok: true, dry: true, url, method, json: rendered };
    const resp = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(rendered) });
    const txt = await resp.text();
    return { ok: resp.ok, status: resp.status, body: txt.slice(0, 1000) };
  }

  return { ok: false, error: "UNKNOWN_ACTION" };
}

app.post("/api/automations/execute", async (req, res) => {
  try {
    const steps = req.body?.steps || [];
    const dryRun = !!req.body?.dryRun;
    const trig = steps.find(s => s.trigger)?.trigger;
    if (!trig) return res.json({ ok: false, error: "NO_TRIGGER" });
    const items = await execTrigger(trig);
    const actions = steps.filter(s => s.action).map(s => s.action);
    const results = [];
    for (const item of items) {
      for (const act of actions) {
        // eslint-disable-next-line no-await-in-loop
        const r = await execAction(act, item, { dryRun });
        results.push({ item, action: act.type, result: r });
      }
    }
    res.json({ ok: true, itemsCount: items.length, results });
  } catch (e) { res.json({ ok: false, error: "EXEC_FAILED", details: String(e) }); }
});

// ---------------- Automations storage ----------------
function autosFile() { return path.join(DATA_DIR, "automations.json"); }
function loadAutos() { const f = autosFile(); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : []; }
function saveAutos(items) { fs.writeFileSync(autosFile(), JSON.stringify(items, null, 2)); }

app.post("/api/automations/save", async (req, res) => {
  try {
    const items = loadAutos(); const id = uuidv4(); const now = new Date().toISOString();
    const row = { id, title: req.body?.title || "Untitled", steps: req.body?.steps || [], text: req.body?.text || "", createdAt: now, updatedAt: now };
    items.push(row); saveAutos(items); res.json({ ok: true, id });
  } catch { res.json({ ok: false, error: "SAVE_FAILED" }); }
});
app.get("/api/automations/list", async (req, res) => { try { res.json({ ok: true, items: loadAutos() }); } catch { res.json({ ok: false, items: [] }); } });
app.post("/api/automations/execute-saved", async (req, res) => {
  try {
    const id = String(req.body?.id || ""); const items = loadAutos(); const it = items.find(x => x.id === id);
    if (!it) return res.json({ ok: false, error: "NOT_FOUND" });
    const trig = it.steps.find(s => s.trigger)?.trigger; const actions = it.steps.filter(s => s.action).map(s => s.action);
    const itemsList = await execTrigger(trig); const results = [];
    for (const item of itemsList) { for (const act of actions) { const r = await execAction(act, item, { dryRun: false }); results.push({ item, action: act.type, result: r }); } }
    res.json({ ok: true, itemsCount: itemsList.length, results });
  } catch (e) { res.json({ ok: false, error: "EXEC_SAVED_FAILED", details: String(e) }); }
});

// ---------------- start ----------------
app.listen(PORT, () => {
  console.log("Server on http://localhost:" + PORT, " static:", PUBLIC_DIR);
});
