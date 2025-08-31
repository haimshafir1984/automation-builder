/**
 * Automation Builder - Backend (Render-ready)
 * - Static locked to ./public (or ENV PUBLIC_DIR)
 * - Google OAuth + persistent tokens (Upstash Redis via REST, or file fallback)
 * - /api/google/auth/status, /api/google/me, /api/google/logout
 * - /api/debug/store for non-secret health of token store
 * - Sheets uses SAME OAuth creds (async fix)
 * - NLP provider switch (ollama/groq/openai) + heuristic fallback
 *
 * ENV (Google):
 *  OAUTH_REDIRECT_URL=https://automation-builder-backend.onrender.com/api/google/oauth/callback
 *  GOOGLE_CLIENT_ID=...
 *  GOOGLE_CLIENT_SECRET=...
 *
 * Token store (choose ONE):
 *  TOKEN_STORE=redis
 *    UPSTASH_REDIS_REST_URL=...
 *    UPSTASH_REDIS_REST_TOKEN=...
 *  or: TOKEN_STORE=file   (default)
 *    TOKENS_FILE_PATH=/data/tokens.json     (מומלץ עם Persistent Disk)
 *
 * Static control (optional):
 *  PUBLIC_DIR=/opt/render/project/src/backend/public
 *
 * Optional:
 *  NLP_PROVIDER=groq|openai|ollama (default: ollama)
 *  GROQ_API_KEY / GROQ_MODEL
 *  OPENAI_API_KEY / OPENAI_MODEL
 *  OLLAMA_BASE_URL / OLLAMA_MODEL
 *
 * Start: node server.js
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

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));

// ---------- Static ----------
const PUBLIC_DIR =
  process.env.PUBLIC_DIR && fs.existsSync(process.env.PUBLIC_DIR)
    ? process.env.PUBLIC_DIR
    : path.join(__dirname, "public"); // default: backend/public
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

const NLP_PROVIDER = (process.env.NLP_PROVIDER || "ollama").toLowerCase();
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "";
const TWILIO_WHATSAPP_TO = process.env.TWILIO_WHATSAPP_TO || "";

const TOKEN_STORE = (process.env.TOKEN_STORE || "file").toLowerCase();
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const TOKENS_FILE_PATH = process.env.TOKENS_FILE_PATH || path.join(process.cwd(), "tokens.json");

const capabilities = [ "gmail.unreplied", "sheets.append", "whatsapp.send" ];
const TOKENS_KEY = "google_oauth_tokens_v1";

// ---------- Token Store ----------
async function redisCommand(arr) {
  const url = UPSTASH_URL;
  const token = UPSTASH_TOKEN;
  if (!url || !token) throw new Error("UPSTASH env not set");
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ command: arr })
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
      if (!val) return null;
      return JSON.parse(val);
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

// store health (no secrets)
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

// ---------- Google Auth Helpers ----------
async function getOAuth2() {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL
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
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    return google.sheets({ version: "v4", auth: sa });
  }
  const oauth2 = await getOAuth2();
  return google.sheets({ version: "v4", auth: oauth2 });
}
async function getGmailClient() {
  return google.gmail({ version: "v1", auth: await getOAuth2() });
}

// ---------- Basic & Static Routes ----------
app.get("/", (_, res) => res.redirect("/wizard_plus.html"));
app.get(["/wizard_plus.html","/wizard_plus"], (req, res) => {
  const filePath = path.join(PUBLIC_DIR, "wizard_plus.html");
  if (!fs.existsSync(filePath)) return res.status(404).send("wizard_plus.html not found in PUBLIC_DIR");
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

// ---------- Google OAuth ----------
const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/spreadsheets"
];
app.get("/api/google/oauth/url", (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL);
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: OAUTH_SCOPES,
      prompt: "consent"
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
    const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL);
    const { tokens } = await oauth2Client.getToken(code);
    const existing = await loadTokens();
    const merged = {
      ...existing,
      ...tokens,
      refresh_token: tokens.refresh_token || existing?.refresh_token || LEGACY_GOOGLE_REFRESH_TOKEN || ""
    };
    const saved = await saveTokens(merged);
    if (!saved) {
      return res
        .status(500)
        .send(`<html dir="rtl"><body style="font-family: sans-serif">
        <h3>נכשל לשמור את טוקני ההתחברות</h3>
        <p>ייתכן שהגדרות Redis (Upstash) אינן תקינות, או שאין הרשאות כתיבה.</p>
        <ul>
          <li>בדקו ב-Render את: <code>TOKEN_STORE=redis</code>, <code>UPSTASH_REDIS_REST_URL</code>, <code>UPSTASH_REDIS_REST_TOKEN</code></li>
          <li>אפשר לבדוק את ה-store: <a href="/api/debug/store">/api/debug/store</a></li>
          <li>לניסוי מהיר, נסו זמנית <code>TOKEN_STORE=file</code> (או Disk מתמיד ב-Render).</li>
        </ul>
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
    res.json({ ok: true, hasRefreshToken: !!(tokens?.refresh_token || LEGACY_GOOGLE_REFRESH_TOKEN), storeOk: health.ok });
  } catch (e) {
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

// ---------- NLP ----------
const JSON_INSTRUCTION = `Return a single JSON object only, no prose.
Schema: { "intent":"string","confidence":0..1,"entities":{"fromEmail?":"string","spreadsheetId?":"string","hours?":number,"newerThanDays?":number} }`;

async function callNLP(text) {
  const provider = NLP_PROVIDER;
  if (provider === "groq") {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "Extract intents and fields. Reply with strict JSON only." },
          { role: "user", content: `Text:\n${text}\n\n${JSON_INSTRUCTION}` }
        ],
        temperature: 0
      })
    });
    if (!resp.ok) throw new Error(`GROQ_FAIL ${resp.status}`);
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "{}";
    return JSON.parse(content);
  }
  if (provider === "openai") {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: "Extract intents and fields. Reply with strict JSON only." },
          { role: "user", content: `Text:\n${text}\n\n${JSON_INSTRUCTION}` }
        ],
        temperature: 0
      })
    });
    if (!resp.ok) throw new Error(`OPENAI_FAIL ${resp.status}`);
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "{}";
    return JSON.parse(content);
  }
  // default: ollama
  if (!OLLAMA_BASE_URL) throw new Error("OLLAMA_BASE_URL not configured");
  const body = { model: OLLAMA_MODEL, prompt: `Extract intent and fields.\n${JSON_INSTRUCTION}\n\nText:\n${text}` };
  const resp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`OLLAMA_FAIL ${resp.status}`);
  const raw = await resp.text();
  const jsonStr = raw.trim().split(/\n/).pop();
  return JSON.parse(jsonStr);
}

function buildHeuristicPlan(text, nlp) {
  const t = (text || "").toLowerCase();
  const isSLA = /unreply|לא.*נענ[ה]|sla|לא קיבל מענה|ללא מענה|לא נענה/.test(t) || /gmail/.test(t);
  const steps = [], missing = [];
  if (isSLA) {
    steps.push({ trigger: { type: "gmail.unreplied", params: { fromEmail: "", newerThanDays: 30, hours: 10, limit: 50 } } });
    steps.push({ action: { type: "sheets.append", params: { spreadsheetId: "", sheetName: "SLA", row: { from: "{{item.from}}", subject: "{{item.subject}}", date: "{{item.date}}", threadId: "{{item.threadId}}", webLink: "{{item.webLink}}" } } } });
    missing.push({ key: "fromEmail", label: "כתובת המייל של השולח", example: "name@example.com" });
    missing.push({ key: "spreadsheetId", label: "ה־ID של ה-Google Sheet", example: "1AbCd...xyz" });
  }
  return { heurSteps: steps, heurMissing: missing };
}

// ---------- Plan & Execute ----------
app.post("/api/plan/from-text", async (req, res) => {
  try {
    const { text } = req.body || {};
    let nlp = null; try { nlp = await callNLP(text); } catch(_) {}
    const { heurSteps, heurMissing } = buildHeuristicPlan(text, nlp);
    res.json({ ok: true, text, nlp, proposal: heurSteps, missing: heurMissing, provider: NLP_PROVIDER });
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
      let nlp=null; try { nlp = await callNLP(text); } catch(_) {}
      const { heurSteps, heurMissing } = buildHeuristicPlan(text, nlp);
      finalSteps = heurSteps; missing = heurMissing;
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
      else throw new Error(`Unknown trigger: ${type}`);
    } else if (step.action) {
      const { type, params } = step.action;
      if (type === "sheets.append") {
        if (!items) items = [{ from:"", subject:"", date:"", threadId:"", webLink:"" }];
        await actionSheetsAppend(params, items);
      } else if (type === "whatsapp.send") {
        await actionWhatsappSend(params, items || []);
      } else throw new Error(`Unknown action: ${type}`);
    }
  }
  return { ok: true };
}

// ---------- Trigger: gmail.unreplied ----------
async function triggerGmailUnreplied(params) {
  const { fromEmail, newerThanDays=30, hours=10, limit=50 } = params || {};
  if (!fromEmail) throw new Error("fromEmail is required");
  const gmail = await getGmailClient();
  const profile = await gmail.users.getProfile({ userId: "me" });
  const myEmail = profile.data.emailAddress;
  const q = [`from:${fromEmail}`, `newer_than:${newerThanDays}d`, "-in:chats"].join(" ");
  const list = await gmail.users.messages.list({ userId: "me", q, maxResults: Math.min(limit,100) });
  const msgs = list.data.messages || [];
  const thresholdMs = hours*60*60*1000; const now = Date.now();
  const out = [];
  for (const m of msgs) {
    const th = await gmail.users.threads.get({ userId:"me", id:m.threadId });
    const messages = th.data.messages || [];
    const lastMsg = messages[messages.length-1];
    const headers = Object.fromEntries((lastMsg.payload.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));
    const from = headers["from"]||""; const subject = headers["subject"]||""; const internalDate = parseInt(lastMsg.internalDate||"0",10); const ageMs = now - internalDate;
    const isFromMe = (from.toLowerCase().includes(myEmail.toLowerCase())); if (isFromMe) continue;
    const replied = messages.some(msg => {
      const h = Object.fromEntries((msg.payload.headers||[]).map(x=>[x.name.toLowerCase(),x.value]));
      const f = h["from"]||""; return f.toLowerCase().includes(myEmail.toLowerCase());
    });
    if (replied) continue;
    if (ageMs < thresholdMs) continue;
    const threadId = th.data.id; const webLink = `https://mail.google.com/mail/u/0/#inbox/${threadId}`; const dateIso = new Date(internalDate).toISOString();
    out.push({ from, subject, date: dateIso, threadId, webLink });
  }
  return out;
}

// ---------- Action: sheets.append ----------
async function actionSheetsAppend(params, items) {
  const { spreadsheetId, sheetName="Sheet1", row } = params || {};
  if (!spreadsheetId) throw new Error("spreadsheetId is required");
  const sheets = await getSheetsClient();
  const values = items.map(item => {
    const rendered = {};
    for (const [k, v] of Object.entries(row || {})) {
      rendered[k] = String(v).replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => item[key] ?? "");
    }
    return Object.values(rendered);
  });
  const range = `${sheetName}!A1`;
  await sheets.spreadsheets.values.append({
    spreadsheetId, range, valueInputOption: "USER_ENTERED", requestBody: { values }
  });
}

// ---------- Action: whatsapp.send ----------
async function actionWhatsappSend(params, items) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.warn("Twilio not configured, skipping whatsapp.send");
    return;
  }
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const { to = TWILIO_WHATSAPP_TO, message = "Hello from automation" } = params || {};
  const text = message.replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g, (_, k) => (items?.[0]?.[k] ?? ""));
  await client.messages.create({
    from: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${to}`,
    body: text
  });
}

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Server on :${PORT} | PUBLIC_DIR=${PUBLIC_DIR} | TOKEN_STORE=${TOKEN_STORE} | NLP=${NLP_PROVIDER}`);
});
