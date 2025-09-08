/**
 * Automation Builder — robust server
 * - Static hosting for /public (wizard_plus.html)
 * - Google OAuth (tokens via file or Upstash Redis)
 * - Planner:
 *    • heuristicsPlan(text)  — בסיס מהיר
 *    • groqPlan(text)       — LLM עם JSON-Schema + few-shots
 *    • extractEntities()    — חילוץ ישויות בסיסי (אימייל/טלפון/Sheet/זמנים/עמודות)
 * - Execution:
 *    • Triggers: gmail.unreplied, gmail.sent, sheets.match
 *    • Actions : sheets.append, email.send, whatsapp.send, slack.post, telegram.send, webhook.post
 * - Automations CRUD: save/list/execute-saved
 *
 * ENV (דוגמאות):
 *  PORT=4000
 *  PUBLIC_DIR=./public
 *  TOKEN_STORE=file   # או redis
 *  # Upstash (אם TOKEN_STORE=redis):
 *  UPSTASH_REDIS_REST_URL=...
 *  UPSTASH_REDIS_REST_TOKEN=...
 *  # Google OAuth:
 *  GOOGLE_CLIENT_ID=...
 *  GOOGLE_CLIENT_SECRET=...
 *  GOOGLE_REDIRECT_URI=https://<your-app>/api/google/oauth/callback
 *  # Groq:
 *  GROQ_API_KEY=...
 *  GROQ_MODEL=llama-3.1-8b-instant
 *  # Email (ל־email.send, אופציונלי — אפשר גם להחליף לספק אחר)
 *  SMTP_HOST=smtp.gmail.com
 *  SMTP_USER=...
 *  SMTP_PASS=...
 *  # WhatsApp (Twilio):
 *  TWILIO_ACCOUNT_SID=...
 *  TWILIO_AUTH_TOKEN=...
 *  TWILIO_WHATSAPP_FROM=whatsapp:+1XXXXXXXXXX
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

// --------- Config & dirs ----------
const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || "./public");
const DATA_DIR = path.resolve("./data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --------- Token store (file/redis) ----------
const TOKEN_STORE = (process.env.TOKEN_STORE || "file").toLowerCase(); // "file" | "redis"
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

// --------- Express ----------
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("tiny"));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// Debug: static dir
app.get("/api/debug/staticDir", (req, res) => {
  res.json({ ok: true, PUBLIC_DIR, TOKEN_STORE });
});

// explicit wizard route (to avoid GET issue)
app.get("/wizard_plus.html", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "wizard_plus.html"));
});

// ---------- Google OAuth ----------
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

const TOKEN_KEY = "google_tokens"; // single-user store. אפשר לשפר לריבוי משתמשים לפי session/userId

async function getTokens() {
  return (await kv.get(TOKEN_KEY)) || null;
}
async function setTokens(t) {
  await kv.set(TOKEN_KEY, t);
}
async function clearTokens() {
  await kv.del(TOKEN_KEY);
}
async function getAuthedClient() {
  const tokens = await getTokens();
  if (!tokens) return null;
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

app.get("/api/google/oauth/url", async (req, res) => {
  try {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
    });
    res.json({ ok: true, url });
  } catch (e) {
    res.json({ ok: false, error: "OAUTH_URL_FAILED", details: String(e) });
  }
});

app.get("/api/google/oauth/callback", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    await setTokens(tokens);
    res.send(
      `<script>if(window.opener){window.opener.location.hash='#connected=1';window.close();}else{location.href='/wizard_plus.html#connected=1'}</script>`
    );
  } catch (e) {
    res.status(500).send("OAuth callback failed");
  }
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
  } catch (e) {
    res.json({ ok: false, error: "GOOGLE_ME_FAILED" });
  }
});

app.post("/api/google/logout", async (req, res) => {
  try {
    await clearTokens();
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// ---------- Google helpers ----------
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

// ---------- Email (SMTP) ----------
function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ---------- WhatsApp (Twilio) ----------
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch {}
}

// ===================== NLU Helpers =====================

// Normalization of Hebrew quirks & synonyms
function normalizeHeb(text = "") {
  return String(text || "")
    .replace(/[\u200e\u200f]/g, "") // LRM/RLM
    .replace(/[“”„״]/g, '"')
    .replace(/[’׳]/g, "'")
    .replace(/[–—]/g, "-")
    // synonyms
    .replace(/ו?וואטסאפ|ווטסאפ|וואטסאפ/gi, "WhatsApp")
    .replace(/גוגל\s*שיט|שיט\b|גיליון/gi, "Sheet")
    .replace(/\bבשם\s+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Quick entity extraction (regex)
function extractEntities(text = "") {
  const out = {};
  // emails
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  if (emails && emails.length) out.emails = Array.from(new Set(emails));
  // phone/whatsapp (very rough)
  const phones = text.match(/\b\+?\d{9,15}\b/g);
  if (phones && phones.length) out.phones = Array.from(new Set(phones));
  // hours / days
  const h = text.match(/(\d+)\s*שעות?/);
  if (h) out.hours = +h[1];
  const d = text.match(/(\d+)\s*ימים?/);
  if (d) out.days = +d[1];
  if (/חודש|30\s*יום/.test(text)) out.days = out.days || 30;
  // sheet id
  const m = text.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) out.spreadsheetId = m[1];
  // quoted column name
  const cm = text.match(/"([^"]+)"|'([^']+)'/);
  if (cm) out.columnName = cm[1] || cm[2];
  return out;
}

// Heuristic baseline — returns proposal/missing or empty
function heuristicsPlan(textRaw = "") {
  const text = normalizeHeb(textRaw);
  const entities = extractEntities(text);

  // Gmail unreplied → Sheets/WA/Email
  if (/שלא\s*נענה/.test(text) && /מייל/.test(text)) {
    const proposal = [
      {
        trigger: {
          type: "gmail.unreplied",
          params: {
            fromEmail: entities.emails?.[0] || "",
            newerThanDays: entities.days || 30,
            hours: entities.hours || 10,
            limit: 50,
          },
        },
      },
    ];

    // target
    if (/whatsapp/i.test(text)) {
      proposal.push({
        action: {
          type: "whatsapp.send",
          params: {
            to: entities.phones?.[0] ? "whatsapp:" + entities.phones[0] : "",
            message: "נמצא מייל שלא נענה: {{item.subject}} {{item.webLink}}",
          },
        },
      });
    } else if (/sheet/i.test(text)) {
      proposal.push({
        action: {
          type: "sheets.append",
          params: {
            spreadsheetId: entities.spreadsheetId || "",
            sheetName: "SLA",
            row: {
              from: "{{item.from}}",
              subject: "{{item.subject}}",
              date: "{{item.date}}",
              threadId: "{{item.threadId}}",
              webLink: "{{item.webLink}}",
            },
          },
        },
      });
    } else {
      proposal.push({
        action: {
          type: "email.send",
          params: {
            to: entities.emails?.[1] || "",
            subject: "מייל שלא נענה: {{item.subject}}",
            body: "{{item.webLink}}",
          },
        },
      });
    }

    const missing = [];
    if (!proposal[0].trigger.params.fromEmail) {
      missing.push({ key: "fromEmail", label: "כתובת המייל של השולח", example: "name@example.com" });
    }
    const act = proposal[1].action;
    if (act.type === "sheets.append" && !act.params.spreadsheetId) {
      missing.push({ key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" });
    }
    if (act.type === "email.send" && !act.params.to) {
      missing.push({ key: "to", label: "כתובת מייל לקבלת ההתראה", example: "name@example.com" });
    }
    if (act.type === "whatsapp.send" && !act.params.to) {
      missing.push({ key: "to", label: "מספר WhatsApp בינ\"ל", example: "9725xxxxxxxx" });
    }
    return { ok: true, provider: "heuristic", proposal, missing, nlp: null };
  }

  // Two senders → Sheet log
  if (/טבלה משותפת|שני אנשים|שני\s+שולחים/.test(text) && /שולח(ים)?\s*מייל/.test(text)) {
    const proposal = [
      {
        trigger: {
          type: "gmail.sent",
          params: {
            fromEmails: entities.emails?.length ? entities.emails : [],
            newerThanDays: entities.days || 30,
            limit: 50,
          },
        },
      },
      {
        action: {
          type: "sheets.append",
          params: {
            spreadsheetId: entities.spreadsheetId || "",
            sheetName: "InboxLog",
            row: {
              from: "{{item.from}}",
              date: "{{item.date}}",
              subject: "{{item.subject}}",
              snippet: "{{item.snippet}}",
            },
          },
        },
      },
    ];
    const missing = [];
    if (!proposal[0].trigger.params.fromEmails?.length) {
      missing.push({ key: "fromEmails", label: "שמות/אימיילים של שני האנשים", example: "a@example.com,b@example.com" });
    }
    if (!proposal[1].action.params.spreadsheetId) {
      missing.push({ key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" });
    }
    return { ok: true, provider: "heuristic", proposal, missing, nlp: null };
  }

  // Sheets match → email
  if (/עמוד(ה|ות)|שדה/.test(text) && /שווה|שווה ל|מכיל/.test(text) && /גיליון|Sheet/i.test(text)) {
    const proposal = [
      {
        trigger: {
          type: "sheets.match",
          params: {
            spreadsheetId: entities.spreadsheetId || "",
            sheetName: "Sheet1",
            columnName: entities.columnName || "",
            equals: "",
            mode: "new",
          },
        },
      },
      {
        action: {
          type: "email.send",
          params: {
            to: entities.emails?.[0] || "",
            subject: "התראה מגיליון {{item.__sheet}}",
            body: "{{item.__rowAsText}}",
          },
        },
      },
    ];
    const missing = [];
    if (!proposal[0].trigger.params.spreadsheetId) {
      missing.push({ key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" });
    }
    if (!proposal[0].trigger.params.columnName) {
      missing.push({ key: "columnName", label: "שם העמודה/השדה", example: "project menger" });
    }
    missing.push({ key: "equals", label: "הערך שתואם להתראה", example: "haim shafir" });
    if (!proposal[1].action.params.to) {
      missing.push({ key: "to", label: "כתובת מייל לקבלת ההתראה", example: "name@example.com" });
    }
    return { ok: true, provider: "heuristic", proposal, missing, nlp: null };
  }

  return { ok: true, provider: "heuristic", proposal: [], missing: [], nlp: null };
}

// =============== Groq LLM Planner =================
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const JSON_SCHEMA_PROMPT = `
אתה מתכנן אוטומציות. קלט: משפט חופשי בעברית.
החזר JSON **בלבד** במבנה הבא:
{
  "proposal": [ { "trigger": { "type": "<one-of: gmail.unreplied | gmail.sent | sheets.match>", "params": { ... } } } , { "action": { "type": "<one-of: sheets.append | email.send | whatsapp.send | slack.post | telegram.send | webhook.post>", "params": { ... } } } ],
  "missing": [ { "key": "...", "label": "...", "example": "..." } ],
  "questions": [ "..." ]
}

כללי מילוי:
- gmail.unreplied: params = { fromEmail, newerThanDays, hours, limit }
- gmail.sent:      params = { fromEmails (array), newerThanDays, limit }
- sheets.match:    params = { spreadsheetId, sheetName, columnName, equals, mode="new" }
- sheets.append:   params = { spreadsheetId, sheetName, row: { ... } }
- email.send:      params = { to, subject, body }
- whatsapp.send:   params = { to (בפורמט בינ"ל ללא + או עם whatsapp:+972...), message }
- slack.post:      params = { webhookUrl, message }
- telegram.send:   params = { botToken, chatId, message }
- webhook.post:    params = { url, method="POST", json: { ... } }

אם חסר ערך קריטי – אל תנחש: הכנס ל-missing עם label והדוגמה בעברית.
אל תשתמש בפסיקים מיותרים. החזר JSON חוקי תקין בלבד.
`;

const FEWSHOTS = [
  {
    user: 'כל מייל מ-haim@example.com שלא נענה 10 שעות ב-30 ימים — רשומה ב-Google Sheet בשם "InboxLog"',
    out: {
      proposal: [
        { trigger: { type: "gmail.unreplied", params: { fromEmail: "haim@example.com", newerThanDays: 30, hours: 10, limit: 50 } } },
        { action: { type: "sheets.append", params: { spreadsheetId: "", sheetName: "InboxLog", row: { from: "{{item.from}}", subject: "{{item.subject}}", date: "{{item.date}}", webLink: "{{item.webLink}}" } } } }
      ],
      missing: [{ key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" }],
      questions: []
    }
  },
  {
    user: "כשהעמודה \"project menger\" שווה \"haim shafir\" בגיליון Sheet1 — שלח מייל עם כל השורה",
    out: {
      proposal: [
        { trigger: { type: "sheets.match", params: { spreadsheetId: "", sheetName: "Sheet1", columnName: "project menger", equals: "haim shafir", mode: "new" } } },
        { action: { type: "email.send", params: { to: "", subject: "התראה מגיליון {{item.__sheet}}", body: "{{item.__rowAsText}}" } } }
      ],
      missing: [
        { key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" },
        { key: "to", label: "כתובת מייל לקבלת ההתראה", example: "name@example.com" }
      ],
      questions: []
    }
  },
  {
    user: "אני רוצה טבלה לשני אנשים; כל פעם שאחד מהם שולח מייל—להוסיף שורה עם השולח, התאריך, הנושא, והתוכן",
    out: {
      proposal: [
        { trigger: { type: "gmail.sent", params: { fromEmails: [], newerThanDays: 30, limit: 50 } } },
        { action: { type: "sheets.append", params: { spreadsheetId: "", sheetName: "InboxLog", row: { from: "{{item.from}}", date: "{{item.date}}", subject: "{{item.subject}}", snippet: "{{item.snippet}}" } } } }
      ],
      missing: [
        { key: "fromEmails", label: "שמות/אימיילים של שני האנשים", example: "a@example.com,b@example.com" },
        { key: "spreadsheetId", label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" }
      ],
      questions: ["מי שני האנשים? הזן כתובות אימייל מופרדות בפסיק."]
    }
  }
];

async function groqPlan(textRaw = "") {
  if (!GROQ_API_KEY) {
    return { ok: false, error: "GROQ_MISSING_KEY" };
  }
  const text = normalizeHeb(textRaw);
  const sys = JSON_SCHEMA_PROMPT + "\nדוגמאות (few-shots) יגיעו מיד כמסרים קודמים.\n";

  const messages = [{ role: "system", content: sys }];
  // few-shots
  FEWSHOTS.forEach((fs) => {
    messages.push({ role: "user", content: fs.user });
    messages.push({ role: "assistant", content: JSON.stringify(fs.out) });
  });
  messages.push({ role: "user", content: text });

  const body = {
    model: GROQ_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages,
  };

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errTxt = await resp.text();
    return { ok: false, error: "GROQ_HTTP_ERROR", details: errTxt.slice(0, 500) };
    }
  const j = await resp.json();
  let parsed = null;
  try {
    parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");
  } catch {
    return { ok: false, error: "GROQ_PARSE_ERROR" };
  }
  // Ensure shape
  parsed.proposal = Array.isArray(parsed.proposal) ? parsed.proposal : [];
  parsed.missing = Array.isArray(parsed.missing) ? parsed.missing : [];
  parsed.questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return { ok: true, provider: "groq", ...parsed };
}

// Planner entry
app.post("/api/plan/from-text", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    // 1) Heuristic first
    let plan = heuristicsPlan(text);
    // 2) If weak/empty → Groq
    if (!plan.proposal?.length) {
      const llm = await groqPlan(text);
      if (llm.ok && llm.proposal?.length) plan = llm;
    }
    // 3) If still empty → propose options
    if (!plan.proposal?.length) {
      plan.questions = plan.questions || [];
      plan.questions.push(
        "התכוונת אולי: (1) מיילים שנשלחו ע\"י אנשים מסוימים → שורה בגיליון, (2) מיילים שהתקבלו משולחים מסוימים → שורה בגיליון?"
      );
    }
    res.json(plan);
  } catch (e) {
    res.json({ ok: false, error: "PLAN_FAILED", details: String(e) });
  }
});

// ================== Automation execution ==================

async function execTrigger(trigger) {
  const type = trigger.type;
  const p = trigger.params || {};
  if (type === "gmail.unreplied") {
    const gmail = await getGmail();
    const qParts = [];
    if (p.fromEmail) qParts.push(`from:${p.fromEmail}`);
    if (p.newerThanDays) qParts.push(`newer_than:${p.newerThanDays}d`);
    // not replied within X hours → simplest approx: older_than + no from:me in thread
    // (בפועל אפשר לדייק יותר אם סורקים את ה-thread)
    const q = qParts.join(" ");
    const list = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: p.limit || 50,
    });
    const items = [];
    for (const m of list.data.messages || []) {
      const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] });
      const hdr = Object.fromEntries((full.data.payload?.headers || []).map(h => [h.name, h.value]));
      items.push({
        id: full.data.id,
        threadId: full.data.threadId,
        from: hdr.From || "",
        subject: hdr.Subject || "",
        date: hdr.Date || "",
        webLink: `https://mail.google.com/mail/u/0/#inbox/${full.data.threadId}`,
      });
      if (items.length >= (p.limit || 50)) break;
    }
    return items;
  }

  if (type === "gmail.sent") {
    const gmail = await getGmail();
    const froms = (p.fromEmails || []).filter(Boolean);
    // Gmail API אין שאילתה "sent by X" על תיבת היוזר; לכן נאסוף לפי מהמיילים שמופיעים בשדה From/To ונבנה לוגיקה פשוטה:
    const qParts = [];
    if (p.newerThanDays) qParts.push(`newer_than:${p.newerThanDays}d`);
    // נסתכל גם ב-inbox וגם ב-sent כדי לתפוס "שולחים" חיצוניים
    const q = qParts.join(" ");
    const list = await gmail.users.messages.list({ userId: "me", q, maxResults: p.limit || 50 });
    const items = [];
    for (const m of list.data.messages || []) {
      const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
      const hdr = Object.fromEntries((full.data.payload?.headers || []).map(h => [h.name, h.value]));
      const from = hdr.From || "";
      const subject = hdr.Subject || "";
      const snippet = full.data.snippet || "";
      const date = hdr.Date || "";
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
    const sid = p.spreadsheetId;
    const sn = p.sheetName || "Sheet1";
    if (!sid) throw new Error("SPREADSHEET_ID_REQUIRED");
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: `${sn}!A:Z` });
    const rows = resp.data.values || [];
    const headers = rows[0] || [];
    const idx = headers.findIndex((h) => (h || "").toString().trim().toLowerCase() === (p.columnName || "").toString().trim().toLowerCase());
    if (idx === -1) return [];
    const items = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const val = (row[idx] || "").toString();
      if (p.equals ? val === p.equals : !!val) {
        items.push({
          __sheet: sn,
          __rowAsText: row.join(" | "),
          values: row,
        });
      }
    }
    return items;
  }

  return [];
}

async function execAction(action, item, ctx) {
  const type = action.type;
  const p = action.params || {};
  const dry = !!ctx.dryRun;

  if (type === "sheets.append") {
    const sid = p.spreadsheetId;
    const sn = p.sheetName || "Sheet1";
    if (!sid) throw new Error("SPREADSHEET_ID_REQUIRED");
    const rowTmpl = p.row || {};
    // Render template with item
    const render = (s) => String(s || "").replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => (item && item[k] != null ? String(item[k]) : ""));
    const row = Object.keys(rowTmpl).map((k) => render(rowTmpl[k]));
    if (dry) return { ok: true, dry: true, appended: row };
    const sheets = await getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sid,
      range: `${sn}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
    return { ok: true, appended: row };
  }

  if (type === "email.send") {
    const mailer = getMailer();
    if (!mailer) return { ok: false, error: "SMTP_NOT_CONFIGURED" };
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
    const url = p.webhookUrl;
    const message = (p.message || "").replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => item?.[k] || "");
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

    // execute trigger(s)
    const trig = steps.find((s) => s.trigger)?.trigger;
    if (!trig) return res.json({ ok: false, error: "NO_TRIGGER" });
    const items = await execTrigger(trig);

    const actions = steps.filter((s) => s.action).map((s) => s.action);
    const results = [];
    for (const item of items) {
      for (const act of actions) {
        // eslint-disable-next-line no-await-in-loop
        const r = await execAction(act, item, { dryRun });
        results.push({ item, action: act.type, result: r });
      }
    }
    res.json({ ok: true, itemsCount: items.length, results });
  } catch (e) {
    res.json({ ok: false, error: "EXEC_FAILED", details: String(e) });
  }
});

// ================== Automations storage ==================
function autosFile() {
  return path.join(DATA_DIR, "automations.json");
}
function loadAutos() {
  const f = autosFile();
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : [];
}
function saveAutos(items) {
  fs.writeFileSync(autosFile(), JSON.stringify(items, null, 2));
}

app.post("/api/automations/save", async (req, res) => {
  try {
    const items = loadAutos();
    const id = uuidv4();
    const now = new Date().toISOString();
    const row = { id, title: req.body?.title || "Untitled", steps: req.body?.steps || [], text: req.body?.text || "", createdAt: now, updatedAt: now };
    items.push(row);
    saveAutos(items);
    res.json({ ok: true, id });
  } catch (e) {
    res.json({ ok: false, error: "SAVE_FAILED" });
  }
});

app.get("/api/automations/list", async (req, res) => {
  try {
    const items = loadAutos();
    res.json({ ok: true, items });
  } catch {
    res.json({ ok: false, items: [] });
  }
});

app.post("/api/automations/execute-saved", async (req, res) => {
  try {
    const id = String(req.body?.id || "");
    const items = loadAutos();
    const it = items.find((x) => x.id === id);
    if (!it) return res.json({ ok: false, error: "NOT_FOUND" });
    // Reuse execution path
    const fakeReq = { body: { steps: it.steps, dryRun: false } };
    const fakeRes = { json: (x) => x };
    // Direct call (not nice but simple)
    const trig = it.steps.find((s) => s.trigger)?.trigger;
    const actions = it.steps.filter((s) => s.action).map((s) => s.action);
    const itemsList = await execTrigger(trig);
    const results = [];
    for (const item of itemsList) {
      for (const act of actions) {
        // eslint-disable-next-line no-await-in-loop
        const r = await execAction(act, item, { dryRun: false });
        results.push({ item, action: act.type, result: r });
      }
    }
    res.json({ ok: true, itemsCount: itemsList.length, results });
  } catch (e) {
    res.json({ ok: false, error: "EXEC_SAVED_FAILED", details: String(e) });
  }
});

// -------------- start --------------
app.listen(PORT, () => {
  console.log("Server on http://localhost:" + PORT, " static:", PUBLIC_DIR);
});
