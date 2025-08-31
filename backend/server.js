/**
 * Automation Builder - Backend (Render-ready, single-file)
 * Features:
 * - Static serving (PUBLIC_DIR)
 * - Google OAuth (gmail.readonly, gmail.send, spreadsheets) + token persistence (file/Upstash)
 * - Token store health endpoints
 * - NLP Planner (skill registry + heuristics) inline; optional LLMs (GROQ/OpenAI/Ollama)
 * - Triggers: gmail.unreplied, sheets.match (new rows & column filter)
 * - Actions: sheets.append, email.send (via Gmail), whatsapp.send (Twilio), slack.send, telegram.send, webhook.call
 *
 * IMPORTANT ENVs:
 *  OAUTH_REDIRECT_URL=https://automation-builder-backend.onrender.com/api/google/oauth/callback
 *  GOOGLE_CLIENT_ID=... , GOOGLE_CLIENT_SECRET=...
 *
 * Token store:
 *  TOKEN_STORE=file
 *  TOKENS_FILE_PATH=/data/tokens.json
 *   or
 *  TOKEN_STORE=redis, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *
 * KV for trigger state (last processed row):
 *  KV_FILE_PATH=/data/store.json
 *
 * NLP:
 *  NLP_PROVIDER=heuristic | groq | openai | ollama
 *  GROQ_API_KEY, GROQ_MODEL
 *  OPENAI_API_KEY, OPENAI_MODEL
 *  OLLAMA_BASE_URL, OLLAMA_MODEL
 *
 * WhatsApp (Twilio):
 *  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *  TWILIO_WHATSAPP_FROM=+9725xxxxxxx
 *  TWILIO_WHATSAPP_TO=+9725xxxxxxx   (optional default "to")
 *
 * Other integrations (optional):
 *  SLACK_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, WEBHOOK_URL
 */

"use strict";

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const twilio = require("twilio");

// Node >=18 has global fetch
const fetchFn = (...args) => fetch(...args);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));

// ---------- Static ----------
const PUBLIC_DIR =
  (process.env.PUBLIC_DIR && fs.existsSync(process.env.PUBLIC_DIR))
    ? process.env.PUBLIC_DIR
    : path.join(__dirname, "public");

if (!fs.existsSync(PUBLIC_DIR)) {
  console.warn("[static] PUBLIC_DIR does not exist:", PUBLIC_DIR);
}
console.log("[static] Using PUBLIC_DIR =", PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

// ---------- ENV ----------
const PORT = process.env.PORT || 5000;

const OAUTH_REDIRECT_URL = process.env.OAUTH_REDIRECT_URL || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const LEGACY_GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || "";
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";

const NLP_PROVIDER = (process.env.NLP_PROVIDER || "heuristic").toLowerCase();
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "";
const TWILIO_WHATSAPP_TO = process.env.TWILIO_WHATSAPP_TO || "";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";

const TOKEN_STORE = (process.env.TOKEN_STORE || "file").toLowerCase();
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const TOKENS_FILE_PATH = process.env.TOKENS_FILE_PATH || path.join(process.cwd(), "tokens.json");
const KV_FILE_PATH = process.env.KV_FILE_PATH || path.join(process.cwd(), "store.json");

const capabilities = [
  "gmail.unreplied",
  "sheets.match",
  "sheets.append",
  "email.send",
  "whatsapp.send",
  "slack.send",
  "telegram.send",
  "webhook.call",
];
const TOKENS_KEY = "google_oauth_tokens_v1";

// ---------- Token Store ----------
async function redisCommand(arr) {
  const url = UPSTASH_URL;
  const token = UPSTASH_TOKEN;
  if (!url || !token) throw new Error("UPSTASH env not set");
  const resp = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ command: arr }),
  });
  if (!resp.ok) throw new Error(`Upstash ${resp.status}`);
  return await resp.json();
}
async function saveTokens(tokens) {
  try {
    if (TOKEN_STORE === "redis") {
      await redisCommand(["SET", TOKENS_KEY, JSON.stringify(tokens)]);
      return true;
    } else {
      fs.writeFileSync(TOKENS_FILE_PATH, JSON.stringify(tokens, null, 2));
      return true;
    }
  } catch (e) {
    console.error("saveTokens error", e);
    return false;
  }
}
async function loadTokens() {
  try {
    if (TOKEN_STORE === "redis") {
      const data = await redisCommand(["GET", TOKENS_KEY]);
      const val = data?.result;
      return val ? JSON.parse(val) : null;
    } else {
      if (!fs.existsSync(TOKENS_FILE_PATH)) return null;
      const raw = fs.readFileSync(TOKENS_FILE_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("loadTokens error", e);
    return null;
  }
}
async function clearTokens() {
  try {
    if (TOKEN_STORE === "redis") {
      await redisCommand(["DEL", TOKENS_KEY]);
    } else {
      if (fs.existsSync(TOKENS_FILE_PATH)) fs.unlinkSync(TOKENS_FILE_PATH);
    }
    return true;
  } catch (e) {
    console.error("clearTokens error", e);
    return false;
  }
}
async function storeHealth() {
  const res = { store: TOKEN_STORE, ok: true };
  const key = `__probe_${Date.now()}`;
  try {
    if (TOKEN_STORE === "redis") {
      await redisCommand(["SET", key, "1"]);
      const got = await redisCommand(["GET", key]);
      await redisCommand(["DEL", key]);
      if (!got?.result) throw new Error("redis get failed");
    } else {
      fs.writeFileSync(TOKENS_FILE_PATH + ".probe", "1");
      const ok = fs.existsSync(TOKENS_FILE_PATH + ".probe");
      if (!ok) throw new Error("file write failed");
      fs.unlinkSync(TOKENS_FILE_PATH + ".probe");
    }
  } catch (e) {
    res.ok = false;
    res.error = e.message || String(e);
  }
  return res;
}

// ---------- KV (for last processed rows etc.) ----------
async function kvSet(key, val) {
  try {
    if (TOKEN_STORE === "redis") {
      await redisCommand(["SET", `kv:${key}`, JSON.stringify(val)]);
    } else {
      let db = {};
      if (fs.existsSync(KV_FILE_PATH)) {
        db = JSON.parse(fs.readFileSync(KV_FILE_PATH, "utf8") || "{}");
      }
      db[key] = val;
      fs.writeFileSync(KV_FILE_PATH, JSON.stringify(db, null, 2));
    }
  } catch (e) {
    console.error("kvSet error", e);
  }
}
async function kvGet(key) {
  try {
    if (TOKEN_STORE === "redis") {
      const data = await redisCommand(["GET", `kv:${key}`]);
      return data?.result ? JSON.parse(data.result) : null;
    } else {
      if (!fs.existsSync(KV_FILE_PATH)) return null;
      const db = JSON.parse(fs.readFileSync(KV_FILE_PATH, "utf8") || "{}");
      return db[key] ?? null;
    }
  } catch (e) {
    console.error("kvGet error", e);
    return null;
  }
}

// ---------- Google Clients ----------
async function getOAuth2() {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    OAUTH_REDIRECT_URL
  );
  const persisted = await loadTokens();
  if (persisted?.refresh_token) {
    oauth2Client.setCredentials({ refresh_token: persisted.refresh_token });
  } else if (LEGACY_GOOGLE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({ refresh_token: LEGACY_GOOGLE_REFRESH_TOKEN });
  }
  return oauth2Client;
}
async function getSheetsClient() {
  if (GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(GOOGLE_APPLICATION_CREDENTIALS)) {
    const sa = new JWT({
      keyFile: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth: sa });
  }
  const oauth2 = await getOAuth2();
  return google.sheets({ version: "v4", auth: oauth2 });
}
async function getGmailClient() {
  return google.gmail({ version: "v1", auth: await getOAuth2() });
}

// ---------- Basic Routes ----------
app.get("/", (_, res) => res.redirect("/wizard_plus.html"));
app.get(["/wizard_plus.html", "/wizard_plus"], (req, res) => {
  const filePath = path.join(PUBLIC_DIR, "wizard_plus.html");
  if (!fs.existsSync(filePath)) return res.status(404).send("wizard_plus.html not found");
  res.sendFile(filePath);
});
app.get("/api/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get("/api/registry", (_, res) => res.json({ ok: true, capabilities }));
app.get("/api/debug/staticDir", async (_, res) => {
  const health = await storeHealth();
  res.json({ ok: true, PUBLIC_DIR, TOKEN_STORE, storeOk: health.ok, storeError: health.error || null });
});
app.get("/api/debug/store", async (_, res) => {
  const health = await storeHealth();
  res.json({ ok: health.ok, store: TOKEN_STORE, error: health.error || null });
});

// ---------- Google OAuth Routes ----------
const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/spreadsheets",
];

app.get("/api/google/oauth/url", (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      OAUTH_REDIRECT_URL
    );
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: OAUTH_SCOPES,
      prompt: "consent",
    });
    res.json({ ok: true, url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "OAUTH_URL_FAILED" });
  }
});

app.get("/api/google/oauth/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      OAUTH_REDIRECT_URL
    );
    const { tokens } = await oauth2Client.getToken(code);
    const existing = await loadTokens();
    const merged = {
      ...existing,
      ...tokens,
      refresh_token:
        tokens.refresh_token ||
        existing?.refresh_token ||
        LEGACY_GOOGLE_REFRESH_TOKEN ||
        "",
    };
    const saved = await saveTokens(merged);
    if (!saved) {
      return res
        .status(500)
        .send(`<html dir="rtl"><body style="font-family: sans-serif">
          <h3>נכשל לשמור את טוקני ההתחברות</h3>
          <p>אם אתם על Redis, בדקו את משתני הסביבה; אחרת עברו זמנית ל-<code>TOKEN_STORE=file</code>.</p>
          <p><a href="/api/debug/store">/api/debug/store</a></p>
          <p><a href="/wizard_plus.html#connected=0">חזרה ליישום</a></p>
        </body></html>`);
    }
    res.redirect("/wizard_plus.html#connected=1");
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "OAUTH_CALLBACK_FAILED" });
  }
});

app.get("/api/google/auth/status", async (req, res) => {
  try {
    const tokens = await loadTokens();
    const health = await storeHealth();
    res.json({
      ok: true,
      hasRefreshToken: !!(tokens?.refresh_token || LEGACY_GOOGLE_REFRESH_TOKEN),
      storeOk: health.ok,
    });
  } catch {
    res.json({ ok: true, hasRefreshToken: !!LEGACY_GOOGLE_REFRESH_TOKEN, storeOk: false });
  }
});
app.post("/api/google/logout", async (req, res) => {
  await clearTokens();
  res.json({ ok: true });
});
app.get("/api/google/me", async (req, res) => {
  try {
    const gmail = await getGmailClient();
    const profile = await gmail.users.getProfile({ userId: "me" });
    res.json({ ok: true, emailAddress: profile.data.emailAddress });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, error: "GOOGLE_ME_FAILED" });
  }
});

// ============================================================================
//                               NLP PLANNER
// ============================================================================

// --- Skill registry (what fields each step needs) ---
const SKILLS = {
  triggers: {
    "gmail.unreplied": {
      required: ["fromEmail"],
      optional: ["newerThanDays", "hours", "limit"],
      defaults: { newerThanDays: 30, hours: 10, limit: 50 },
    },
    "sheets.match": {
      required: ["spreadsheetId", "sheetName", "columnName", "equals"],
      optional: ["mode"],
      defaults: { mode: "new" },
    },
  },
  actions: {
    "sheets.append": {
      required: ["spreadsheetId", "sheetName", "row"],
      optional: [],
    },
    "email.send": {
      required: ["to"],
      optional: ["subject", "body"],
    },
    "whatsapp.send": {
      required: ["to"],
      optional: ["message"],
    },
    "slack.send": { required: [], optional: ["message"] },
    "telegram.send": { required: [], optional: ["message"] },
    "webhook.call": { required: [], optional: ["url", "method", "headers", "context"] },
  },
};

// --- Utils / extractors (Hebrew-friendly) ---
function norm(s = "") {
  return String(s).toLowerCase().replace(/[״“”]/g, '"').trim();
}
function extractEmail(s = "") {
  const m = s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : "";
}
function extractSpreadsheetId(s = "") {
  const m = s.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  const m2 = s.match(/(?:\b|_)spreadsheetId=([a-zA-Z0-9-_]+)/);
  return m2 ? m2[1] : "";
}
function extractSheetName(s = "") {
  const t = s.replace(/\n/g, " ");
  let m = t.match(/לשונית\s+["“](.+?)["”]/i);
  if (m) return m[1];
  m = t.match(/\b(tab|sheet|לשונית)\s+([A-Za-zא-ת0-9 _\-]+)/i);
  if (m) return m[2].trim();
  m = t.match(/בלשונית\s+([A-Za-zא-ת0-9 _\-]+)/i);
  if (m) return m[1].trim();
  return "";
}
function extractColumnName(s = "") {
  const t = s.replace(/\n/g, " ");
  let m = t.match(/בשדה(?:\s+של)?\s+["“]?([A-Za-zא-ת0-9 _\-]+)["”]?/i);
  if (m) return m[1].trim();
  m = t.match(/(?:עמוד[הת]|column)\s+["“]?([A-Za-zא-ת0-9 _\-]+)["”]?/i);
  if (m) return m[1].trim();
  return "";
}
function extractEqualsValue(s = "") {
  const t = s.replace(/\n/g, " ");
  let m = t.match(/הנתון\s+["“]?([^",]+?)["”]?(?:\s|$|,)/i);
  if (m) return m[1].trim();
  m = t.match(/הערך\s+["“]?([^",]+?)["”]?(?:\s|$|,)/i);
  if (m) return m[1].trim();
  m = t.match(/שווה\s+["“]?([^",]+?)["”]?(?:\s|$|,)/i);
  if (m) return m[1].trim();
  m = t.match(/["“]([^"]+?)["”]/);
  if (m) return m[1].trim();
  return "";
}
function extractHours(s = "") {
  const m = s.match(/(\d+)\s*שעות|\b(\d+)\s*h/i);
  if (m) return parseInt(m[1] || m[2], 10);
  return /יום/.test(s) ? 24 : 10;
}
function extractNewerThanDays(s = "") {
  if (/חודש/.test(s)) return 30;
  if (/שבוע/.test(s)) return 7;
  const m = s.match(/(\d+)\s*י?ימים?/);
  if (m) return parseInt(m[1], 10);
  return 30;
}
function normalizeWhatsApp(s = "") {
  let x = String(s).trim().replace(/^whatsapp:/i, "");
  x = x.replace(/[^\d+]/g, "");
  if (!x) return null;
  if (!x.startsWith("+")) x = "+" + x;
  return x;
}
function looksLikeIntlPhone(s = "") {
  const n = normalizeWhatsApp(s);
  return !!(n && /^\+\d{9,15}$/.test(n));
}

// --- Heuristics planner ---
function heuristicsPlan(text) {
  const t = norm(text);
  const steps = [];
  const missing = [];

  // Gmail SLA
  const isGmail = /(gmail|מייל|דוא"ל|אימייל)/i.test(text);
  const mentionsUnreplied = /(לא\s*נענה|ללא\s*מענה|unrepl|sla)/i.test(text);

  if (isGmail && mentionsUnreplied) {
    const fromEmail = extractEmail(text);
    const newerThanDays = extractNewerThanDays(text);
    const hours = extractHours(text);

    steps.push({
      trigger: {
        type: "gmail.unreplied",
        params: { fromEmail: fromEmail || "", newerThanDays, hours, limit: 50 },
      },
    });

    if (/whats\s*app|ווטסאפ|וואטסאפ/i.test(text)) {
      steps.push({
        action: {
          type: "whatsapp.send",
          params: { to: "", message: "נמצא מייל שלא נענה: {{item.subject}} — {{item.webLink}}" },
        },
      });
      if (!fromEmail)
        missing.push({
          key: "fromEmail",
          label: "כתובת המייל של השולח",
          example: "name@example.com",
        });
      missing.push({
        key: "to",
        label: 'מספר WhatsApp כולל קידומת מדינה',
        example: "9725xxxxxxxx",
      });
      return { steps, missing };
    } else {
      const spreadsheetId = extractSpreadsheetId(text);
      steps.push({
        action: {
          type: "sheets.append",
          params: {
            spreadsheetId: spreadsheetId || "",
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
      if (!fromEmail)
        missing.push({
          key: "fromEmail",
          label: "כתובת המייל של השולח",
          example: "name@example.com",
        });
      if (!spreadsheetId)
        missing.push({
          key: "spreadsheetId",
          label: "ה־ID של ה-Google Sheet",
          example: "https://docs.google.com/spreadsheets/d/<ID>/edit",
        });
      return { steps, missing };
    }
  }

  // Sheets row match
  if (/(google\s*sheets?|גיליון|שיט|sheet|לשונית|טאב|row|שורה)/i.test(text)) {
    const spreadsheetId = extractSpreadsheetId(text) || "";
    const sheetName = extractSheetName(text) || "Sheet1";
    const columnName = extractColumnName(text) || "";
    const equals = extractEqualsValue(text) || "";

    steps.push({
      trigger: {
        type: "sheets.match",
        params: { spreadsheetId, sheetName, columnName, equals, mode: "new" },
      },
    });

    if (/מייל|email|אימייל/i.test(text)) {
      steps.push({
        action: {
          type: "email.send",
          params: {
            to: "",
            subject: "התראה מגיליון {{item.__sheet}}",
            body: "{{item.__rowAsText}}",
          },
        },
      });
      if (!spreadsheetId)
        missing.push({
          key: "spreadsheetId",
          label: "ה-ID של ה-Google Sheet",
          example: "https://docs.google.com/spreadsheets/d/<ID>/edit",
        });
      if (!sheetName)
        missing.push({ key: "sheetName", label: "שם הגליון (Sheet)", example: "SLA או Sheet1" });
      if (!columnName)
        missing.push({
          key: "columnName",
          label: "שם העמודה/השדה",
          example: "project menger",
        });
      if (!equals)
        missing.push({
          key: "equals",
          label: "הערך שתואם להתראה",
          example: "haim shafir",
        });
      missing.push({
        key: "to",
        label: "כתובת מייל לקבלת ההתראה",
        example: "name@example.com",
      });
      return { steps, missing };
    }

    if (/whats\s*app|ווטסאפ|וואטסאפ/i.test(text)) {
      steps.push({
        action: {
          type: "whatsapp.send",
          params: { to: "", message: "שורה חדשה: {{item.__rowAsText}}" },
        },
      });
      if (!spreadsheetId)
        missing.push({
          key: "spreadsheetId",
          label: "ה-ID של ה-Google Sheet",
          example: "https://docs.google.com/spreadsheets/d/<ID>/edit",
        });
      if (!sheetName)
        missing.push({ key: "sheetName", label: "שם הגליון (Sheet)", example: "SLA או Sheet1" });
      if (!columnName)
        missing.push({
          key: "columnName",
          label: "שם העמודה/השדה",
          example: "project menger",
        });
      if (!equals)
        missing.push({
          key: "equals",
          label: "הערך שתואם להתראה",
          example: "haim shafir",
        });
      missing.push({
        key: "to",
        label: 'מספר WhatsApp כולל קידומת מדינה',
        example: "9725xxxxxxxx",
      });
      return { steps, missing };
    }
  }

  return { steps: [], missing: [] };
}

// --- LLM planner (optional) ---
const JSON_SCHEMA_PROMPT = `
בחר טריגרים ופעולות מתוך הרשימה, והחזר JSON בודד.
- טריגרים: gmail.unreplied, sheets.match
- פעולות: sheets.append, email.send, whatsapp.send, slack.send, telegram.send, webhook.call
- מלא רק את השדות הבאים לכל טריגר/פעולה, לפי הצורך:
  gmail.unreplied: { fromEmail*, newerThanDays, hours, limit }
  sheets.match:    { spreadsheetId*, sheetName*, columnName*, equals*, mode? }
  sheets.append:   { spreadsheetId*, sheetName*, row* (אובייקט מפתח->ערך עם {{item.*}}) }
  email.send:      { to*, subject?, body? }
  whatsapp.send:   { to*, message? }
  slack.send:      { message? }
  telegram.send:   { message? }
  webhook.call:    { url?, method?, headers?, context? }
החזר מבנה: { "proposal":[ {trigger?},{action?}, ... ], "missing":[ {key,label,example} ... ] } בלבד, בלי הסברים.
שים לב לעברית (לשונית/שדה/עמודה/גיליון/מייל/וואטסאפ).
`;

async function callLLMForPlan(text) {
  if (NLP_PROVIDER === "groq") {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");
    const resp = await fetchFn("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: JSON_SCHEMA_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "{}";
    return JSON.parse(content);
  }
  if (NLP_PROVIDER === "openai") {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
    const resp = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: JSON_SCHEMA_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "{}";
    return JSON.parse(content);
  }
  if (NLP_PROVIDER === "ollama") {
    if (!OLLAMA_BASE_URL) throw new Error("OLLAMA_BASE_URL missing");
    const body = {
      model: OLLAMA_MODEL,
      prompt: `${JSON_SCHEMA_PROMPT}\n\nטקסט:\n${text}\n\nהחזר JSON:`,
    };
    const resp = await fetchFn(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await resp.text();
    const jsonStr = raw.trim().split(/\n/).pop();
    return JSON.parse(jsonStr);
  }
  throw new Error("LLM provider disabled");
}

function humanizeKey(skillName, key) {
  const map = {
    spreadsheetId: {
      label: "ה-ID של ה-Google Sheet",
      example: "https://docs.google.com/spreadsheets/d/<ID>/edit",
    },
    sheetName: { label: "שם הגליון (Sheet)", example: "SLA או Sheet1" },
    columnName: { label: "שם העמודה/השדה", example: "project menger" },
    equals: { label: "הערך שתואם להתראה", example: "haim shafir" },
    fromEmail: { label: "כתובת המייל של השולח", example: "name@example.com" },
    to: {
      label:
        skillName === "whatsapp.send"
          ? 'מספר WhatsApp כולל קידומת מדינה'
          : "כתובת מייל לקבלת ההתראה",
      example: skillName === "whatsapp.send" ? "9725xxxxxxxx" : "name@example.com",
    },
  };
  const base = map[key] || { label: key, example: "" };
  return { key, ...base };
}
function computeMissingFromRegistry(proposal) {
  const missing = [];
  for (const step of proposal || []) {
    if (step.trigger) {
      const name = step.trigger.type;
      const spec = SKILLS.triggers[name];
      if (!spec) continue;
      const params = step.trigger.params || {};
      for (const k of spec.required) if (!params[k]) missing.push(humanizeKey(name, k));
    } else if (step.action) {
      const name = step.action.type;
      const spec = SKILLS.actions[name];
      if (!spec) continue;
      const params = step.action.params || {};
      for (const k of spec.required) if (!params[k]) missing.push(humanizeKey(name, k));
    }
  }
  // unique by key
  const seen = new Set();
  return missing.filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true)));
}
function buildQuestions(missing) {
  return (missing || []).map((m) => {
    switch (m.key) {
      case "spreadsheetId":
        return "איזה גיליון Google? (אפשר להדביק את כל הקישור)";
      case "sheetName":
        return "מה שם הלשונית (Sheet) בגיליון?";
      case "columnName":
        return "מה שם העמודה/השדה שעליו בודקים?";
      case "equals":
        return "איזה ערך בדיוק צריך לזהות בעמודה הזו?";
      case "fromEmail":
        return "ממי מגיעים המיילים (כתובת מייל מלאה)?";
      case "to":
        return 'לאיזה יעד לשלוח? (כתובת מייל או מספר וואטסאפ בפורמט בינ"ל)';
      default:
        return `חסר ערך עבור ${m.label}`;
    }
  });
}

async function planFromText(text) {
  if (["groq", "openai", "ollama"].includes(NLP_PROVIDER)) {
    try {
      const llm = await callLLMForPlan(text);
      const proposal = Array.isArray(llm.proposal) ? llm.proposal : [];
      // Inject defaults
      for (const step of proposal) {
        const spec = step.trigger
          ? SKILLS.triggers[step.trigger.type]
          : SKILLS.actions[step.action?.type];
        if (!spec) continue;
        const dst = step.trigger ? (step.trigger.params ||= {}) : (step.action.params ||= {});
        Object.entries(spec.defaults || {}).forEach(([k, v]) => {
          if (dst[k] === undefined) dst[k] = v;
        });
      }
      const missing = computeMissingFromRegistry(proposal);
      const questions = buildQuestions(missing);
      return { ok: true, provider: NLP_PROVIDER, proposal, missing, questions, nlp: llm };
    } catch (e) {
      // Fall back to heuristics
    }
  }
  const h = heuristicsPlan(text);
  const missing = computeMissingFromRegistry(h.steps).concat(h.missing || []);
  const seen = new Set();
  const uniqMissing = missing.filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true)));
  const questions = buildQuestions(uniqMissing);
  return { ok: true, provider: "heuristic", proposal: h.steps, missing: uniqMissing, questions, nlp: null };
}

// ---------- Plan & Execute endpoints ----------
app.post("/api/plan/from-text", async (req, res) => {
  try {
    const { text } = req.body || {};
    const plan = await planFromText(text);
    res.json(plan);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "PLAN_FAILED" });
  }
});

app.post("/api/automations/execute", async (req, res) => {
  try {
    const { text, steps } = req.body || {};
    let finalSteps = Array.isArray(steps) && steps.length ? steps : null;
    let missing = [];
    if (!finalSteps) {
      const plan = await planFromText(text);
      finalSteps = plan.proposal || [];
      missing = plan.missing || [];
    }
    if (missing.length) return res.status(400).json({ ok: false, error: "MISSING_FIELDS", missing });
    if (!finalSteps?.length) return res.status(400).json({ ok: false, error: "NO_STEPS_BUILT" });
    const result = await runPipeline(finalSteps);
    res.json({ ok: true, result, steps: finalSteps, provider: NLP_PROVIDER });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "EXECUTION_FAILED" });
  }
});

// ---------- Pipeline Runtime ----------
async function runPipeline(steps) {
  let items = null;
  for (const step of steps) {
    if (step.trigger) {
      const { type, params } = step.trigger;
      if (type === "gmail.unreplied") items = await triggerGmailUnreplied(params);
      else if (type === "sheets.match") items = await triggerSheetsMatch(params);
      else throw new Error(`Unknown trigger: ${type}`);
    } else if (step.action) {
      const { type, params } = step.action;
      if (type === "sheets.append") {
        if (!items) items = [{ from: "", subject: "", date: "", threadId: "", webLink: "" }];
        await actionSheetsAppend(params, items);
      } else if (type === "whatsapp.send") {
        await actionWhatsappSend(params, items || []);
      } else if (type === "email.send") {
        await actionEmailSend(params, items || []);
      } else if (type === "slack.send") {
        await actionSlackSend(params, items || []);
      } else if (type === "telegram.send") {
        await actionTelegramSend(params, items || []);
      } else if (type === "webhook.call") {
        await actionWebhookCall(params, items || []);
      } else {
        throw new Error(`Unknown action: ${type}`);
      }
    }
  }
  return { ok: true };
}

// ---------- Trigger: gmail.unreplied ----------
async function triggerGmailUnreplied(params) {
  const { fromEmail, newerThanDays = 30, hours = 10, limit = 50 } = params || {};
  if (!fromEmail) throw new Error("fromEmail is required");
  const gmail = await getGmailClient();
  const profile = await gmail.users.getProfile({ userId: "me" });
  const myEmail = profile.data.emailAddress;
  const q = [`from:${fromEmail}`, `newer_than:${newerThanDays}d`, "-in:chats"].join(" ");
  const list = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: Math.min(limit, 100),
  });
  const msgs = list.data.messages || [];
  const thresholdMs = hours * 60 * 60 * 1000;
  const now = Date.now();
  const out = [];
  for (const m of msgs) {
    const th = await gmail.users.threads.get({ userId: "me", id: m.threadId });
    const messages = th.data.messages || [];
    const lastMsg = messages[messages.length - 1];
    const headers = Object.fromEntries(
      (lastMsg.payload.headers || []).map((h) => [h.name.toLowerCase(), h.value])
    );
    const from = headers["from"] || "";
    const subject = headers["subject"] || "";
    const internalDate = parseInt(lastMsg.internalDate || "0", 10);
    const ageMs = now - internalDate;
    const isFromMe = from.toLowerCase().includes(myEmail.toLowerCase());
    if (isFromMe) continue;
    const replied = messages.some((msg) => {
      const h = Object.fromEntries((msg.payload.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
      const f = h["from"] || "";
      return f.toLowerCase().includes(myEmail.toLowerCase());
    });
    if (replied) continue;
    if (ageMs < thresholdMs) continue;
    const threadId = th.data.id;
    const webLink = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
    const dateIso = new Date(internalDate).toISOString();
    out.push({ from, subject, date: dateIso, threadId, webLink });
  }
  return out;
}

// ---------- Trigger: sheets.match ----------
async function triggerSheetsMatch(params) {
  const { spreadsheetId, sheetName = "Sheet1", columnName, equals, mode = "new" } = params || {};
  if (!spreadsheetId) throw new Error("spreadsheetId is required");
  if (!columnName) throw new Error("columnName is required");
  const sheets = await getSheetsClient();

  // Accept full URL or bare ID
  const rawId = spreadsheetId || "";
  const effectiveId = extractSpreadsheetId(rawId) || rawId;

  const range = `${sheetName}!A:ZZ`;
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: effectiveId, range });
  const values = resp.data.values || [];
  if (!values.length) return [];

  const header = values[0];
  const rows = values.slice(1);
  const colIndex = header.findIndex(
    (h) => (h || "").trim().toLowerCase() === String(columnName).trim().toLowerCase()
  );
  if (colIndex === -1) throw new Error(`column "${columnName}" not found`);

  const stateKey = `sheet:${effectiveId}:${sheetName}:lastRow`;
  let lastRow = (await kvGet(stateKey)) ?? 1; // 1 is header row
  const startIdx = Math.max(0, lastRow - 1); // rows[] starts at 0 (data row 2)

  const out = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    const val = (r[colIndex] || "").trim();
    if (val === String(equals).trim()) {
      const obj = {};
      header.forEach((h, idx) => (obj[h || `col_${idx + 1}`] = r[idx] ?? ""));
      obj.__rowIndex = i + 2;
      obj.__sheet = sheetName;
      obj.__rowAsText = header
        .map((h, idx) => `${h || `col_${idx + 1}`}: ${r[idx] ?? ""}`)
        .join(" | ");
      out.push(obj);
    }
  }

  if (mode === "new") {
    const absoluteLastRow = rows.length + 1; // include header
    await kvSet(stateKey, absoluteLastRow);
  }

  return out;
}

// ---------- Action: sheets.append ----------
async function actionSheetsAppend(params, items) {
  const { spreadsheetId, sheetName = "Sheet1", row } = params || {};
  if (!spreadsheetId) throw new Error("spreadsheetId is required");
  const sheets = await getSheetsClient();

  const rawId = spreadsheetId || "";
  const effectiveId = extractSpreadsheetId(rawId) || rawId;

  const values = items.map((item) => {
    const rendered = {};
    for (const [k, v] of Object.entries(row || {})) {
      rendered[k] = String(v).replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => item[key] ?? "");
    }
    return Object.values(rendered);
  });
  const range = `${sheetName}!A1`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: effectiveId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

// ---------- Action: whatsapp.send ----------
async function actionWhatsappSend(params, items) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.warn("Twilio not configured, skipping whatsapp.send");
    return;
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  let to = params?.to || TWILIO_WHATSAPP_TO || "";
  let from = TWILIO_WHATSAPP_FROM || "";
  to = normalizeWhatsApp(to);
  from = normalizeWhatsApp(from);
  if (!to || !from || !looksLikeIntlPhone(to) || !looksLikeIntlPhone(from)) {
    throw new Error("TWILIO_INVALID_PHONE");
  }

  const text = (params?.message || "Hello from automation").replace(
    /\{\{item\.([a-zA-Z0-9_]+)\}\}/g,
    (_, k) => items?.[0]?.[k] ?? ""
  );

  await client.messages.create({
    from: `whatsapp:${from}`,
    to: `whatsapp:${to}`,
    body: text,
  });
}

// ---------- Action: email.send ----------
function encodeMessage(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
async function actionEmailSend(params, items) {
  const gmail = await getGmailClient();
  const to = params?.to || "";
  if (!to) throw new Error("EMAIL_TO_MISSING");
  const subjectTpl = params?.subject || "התראה חדשה";
  const bodyTpl = params?.body || "{{item.__rowAsText}}";

  for (const item of items || []) {
    const subject = subjectTpl.replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g, (_, k) => item[k] ?? "");
    const body = bodyTpl.replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g, (_, k) => item[k] ?? "");
    const raw =
`To: ${to}
Subject: ${subject}
Content-Type: text/plain; charset="UTF-8"

${body}
`;
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(raw) },
    });
  }
}

// ---------- Action: slack.send ----------
async function actionSlackSend(params, items) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("Slack webhook not configured");
    return;
  }
  const payload = {
    text: (params?.message || "Automation notification").replace(
      /\{\{item\.([a-zA-Z0-9_]+)\}\}/g,
      (_, k) => items?.[0]?.[k] ?? ""
    ),
  };
  await fetchFn(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ---------- Action: telegram.send ----------
async function actionTelegramSend(params, items) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram not configured");
    return;
  }
  const message = (params?.message || "Automation message").replace(
    /\{\{item\.([a-zA-Z0-9_]+)\}\}/g,
    (_, k) => items?.[0]?.[k] ?? ""
  );
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
  });
}

// ---------- Action: webhook.call ----------
async function actionWebhookCall(params, items) {
  const url = params?.url || WEBHOOK_URL;
  if (!url) {
    console.warn("Webhook URL missing");
    return;
  }
  const body = {
    timestamp: new Date().toISOString(),
    items: items || [],
    context: params?.context || {},
  };
  await fetchFn(url, {
    method: params?.method || "POST",
    headers: { "Content-Type": "application/json", ...(params?.headers || {}) },
    body: JSON.stringify(body),
  });
}

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(
    `Server on :${PORT} | PUBLIC_DIR=${PUBLIC_DIR} | TOKEN_STORE=${TOKEN_STORE} | NLP=${NLP_PROVIDER}`
  );
});
