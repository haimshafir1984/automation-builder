/**
 * Express server (robust static path):
 * - Auto-detects /public folder in common monorepo layouts (., ./backend)
 * - Serves /wizard_plus.html explicitly (avoids 404 "Cannot GET /wizard_plus.html")
 * - Includes Google OAuth, NLP plan, execute fallback (same logic as before)
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

// ---------- Resolve PUBLIC DIR robustly ----------
const candidates = [
  path.join(__dirname, "public"),
  path.join(__dirname, "backend", "public"),
  path.join(process.cwd(), "public"),
  path.join(process.cwd(), "backend", "public"),
];
const PUBLIC_DIR = candidates.find(p => fs.existsSync(p)) || candidates[0];
console.log("[static] Using PUBLIC_DIR =", PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

// ---------- ENV ----------
const PORT = process.env.PORT || 5000;
const OAUTH_REDIRECT_URL = process.env.OAUTH_REDIRECT_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
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

const capabilities = [ "gmail.unreplied", "sheets.append", "whatsapp.send" ];

// ---------- GOOGLE AUTH HELPERS ----------
function getOAuth2() {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL
  );
  if (GOOGLE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  }
  return oauth2Client;
}
function getSheetsClient() {
  if (GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(GOOGLE_APPLICATION_CREDENTIALS)) {
    const sa = new JWT({
      keyFile: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    return google.sheets({ version: "v4", auth: sa });
  }
  const oauth2Client = getOAuth2();
  return google.sheets({ version: "v4", auth: oauth2Client });
}
function getGmailClient() {
  return google.gmail({ version: "v1", auth: getOAuth2() });
}

// ---------- BASIC & STATIC ROUTES ----------
app.get("/", (_, res) => res.redirect("/wizard_plus.html"));
app.get(["/wizard_plus.html","/wizard_plus"], (req, res) => {
  const filePath = path.join(PUBLIC_DIR, "wizard_plus.html");
  if (!fs.existsSync(filePath)) return res.status(404).send("wizard_plus.html not found in PUBLIC_DIR");
  res.sendFile(filePath);
});
app.get("/api/debug/staticDir", (_, res) => res.json({ ok: true, PUBLIC_DIR }));

app.get("/api/health", (_, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
app.get("/api/registry", (_, res) => {
  res.json({ ok: true, capabilities });
});

// ---------- GOOGLE OAUTH ----------
const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/spreadsheets"
];
app.get("/api/google/oauth/url", (req, res) => {
  try {
    const url = getOAuth2().generateAuthUrl({
      access_type: "offline",
      scope: OAUTH_SCOPES,
      prompt: "consent"
    });
    res.json({ ok: true, url });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "OAUTH_URL_FAILED" }); }
});
app.get("/api/google/oauth/callback", async (req, res) => {
  try {
    const { tokens } = await getOAuth2().getToken(req.query.code);
    res.json({ ok: true, tokens });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "OAUTH_CALLBACK_FAILED" }); }
});
app.get("/api/google/me", async (req, res) => {
  try {
    const profile = await getGmailClient().users.getProfile({ userId: "me" });
    res.json({ ok: true, emailAddress: profile.data.emailAddress });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "GOOGLE_ME_FAILED" }); }
});

// ---------- NLP (provider switch) ----------
const JSON_INSTRUCTION = `Return a single JSON object only, no prose.
Schema: { "intent":"string","confidence":0..1,"entities":{"fromEmail?":"string","spreadsheetId?":"string","hours?":number,"newerThanDays?":number} }`;

async function callNLP(text) {
  if ((process.env.NLP_PROVIDER || "").toLowerCase() === "groq") {
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
  if ((process.env.NLP_PROVIDER || "").toLowerCase() === "openai") {
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
  // default ollama
  const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "";
  if (!OLLAMA_BASE) throw new Error("OLLAMA_BASE_URL not configured");
  const body = { model: OLLAMA_MODEL, prompt: `Extract intent and fields.\n${JSON_INSTRUCTION}\n\nText:\n${text}` };
  const resp = await fetch(`${OLLAMA_BASE}/api/generate`, {
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

app.post("/api/plan/from-text", async (req, res) => {
  try {
    const { text } = req.body || {};
    let nlp = null; try { nlp = await callNLP(text); } catch(_) {}
    const { heurSteps, heurMissing } = buildHeuristicPlan(text, nlp);
    res.json({ ok: true, text, nlp, proposal: heurSteps, missing: heurMissing, provider: (process.env.NLP_PROVIDER||'ollama') });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "PLAN_FAILED" }); }
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
    res.json({ ok: true, result, steps: finalSteps, provider: (process.env.NLP_PROVIDER||'ollama') });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "EXECUTION_FAILED" }); }
});

// ---------- PIPELINE RUNTIME ----------
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

// ---------- TRIGGER: gmail.unreplied ----------
async function triggerGmailUnreplied(params) {
  const { fromEmail, newerThanDays=30, hours=10, limit=50 } = params || {};
  if (!fromEmail) throw new Error("fromEmail is required");
  const gmail = getGmailClient();
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

// ---------- ACTION: sheets.append ----------
async function actionSheetsAppend(params, items) {
  const { spreadsheetId, sheetName="Sheet1", row } = params || {};
  if (!spreadsheetId) throw new Error("spreadsheetId is required");
  const sheets = getSheetsClient();
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

// ---------- ACTION: whatsapp.send (Twilio) ----------
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

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`Server (NLP=${(process.env.NLP_PROVIDER||'ollama')}) on :${PORT} | PUBLIC_DIR=${PUBLIC_DIR}`);
});
