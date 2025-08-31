"use strict";

/**
 * Skill-based Planner for Automation Builder
 * - Hebrew-friendly normalization & extraction
 * - Optional LLM (GROQ / OPENAI / OLLAMA) with fallback to heuristics
 */

const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

const NLP_PROVIDER = (process.env.NLP_PROVIDER || "heuristic").toLowerCase();
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

/* ---------------------------- Skill Registry ---------------------------- */

const SKILLS = {
  triggers: {
    "gmail.unreplied": {
      required: ["fromEmail"],
      optional: ["newerThanDays", "hours", "limit"],
      defaults: { newerThanDays: 30, hours: 10, limit: 50 },
      synonyms: ["gmail", "מייל", "דוא\"ל", "אימייל", "unreplied", "לא נענה", "ללא מענה", "SLA"]
    },
    "sheets.match": {
      required: ["spreadsheetId", "sheetName", "columnName", "equals"],
      optional: ["mode"],
      defaults: { mode: "new" },
      synonyms: ["google sheet", "google sheets", "גיליון", "שיט", "sheet", "לשונית", "טאב", "row", "שורה"]
    }
  },
  actions: {
    "sheets.append": {
      required: ["spreadsheetId", "sheetName", "row"],
      optional: [],
      synonyms: ["לגוגל שיט", "sheet", "append", "הכנס לגיליון"]
    },
    "email.send": {
      required: ["to"],
      optional: ["subject", "body"],
      synonyms: ["מייל", "email", "אימייל", "שלח מייל"]
    },
    "whatsapp.send": {
      required: ["to"],
      optional: ["message"],
      synonyms: ["וואטסאפ", "ווטסאפ", "whatsapp"]
    },
    "slack.send": { required: [], optional: ["message"], synonyms: ["slack"] },
    "telegram.send": { required: [], optional: ["message"], synonyms: ["טלגרם", "telegram"] },
    "webhook.call": { required: [], optional: ["url","method","headers","context"], synonyms: ["וובהוק","webhook","callback"] }
  }
};

/* ------------------------ Hebrew/General Normalizers ------------------------ */

function norm(s="") { return String(s).toLowerCase().replace(/[״“”]/g,'"').trim(); }

// Extract email, spreadsheetId, sheetName, columnName, equals value
function extractEmail(s="") {
  const m = s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : "";
}
function extractSpreadsheetId(s="") {
  const m = s.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  const m2 = s.match(/(?:\b|_)spreadsheetId=([a-zA-Z0-9-_]+)/);
  return m2 ? m2[1] : "";
}
function extractSheetName(s="") {
  const t = s.replace(/\n/g," ");
  // לשונית "Project"
  let m = t.match(/לשונית\s+["“](.+?)["”]/i); if (m) return m[1];
  // tab SheetName
  m = t.match(/\b(tab|sheet|לשונית)\s+([A-Za-zא-ת0-9 _\-]+)/i); if (m) return m[2].trim();
  // בשורה: "בלשונית project"
  m = t.match(/בלשונית\s+([A-Za-zא-ת0-9 _\-]+)/i); if (m) return m[1].trim();
  return "";
}
function extractColumnName(s="") {
  const t = s.replace(/\n/g," ");
  // "בשדה של X" / "בשדה X" / 'עמודה X'
  let m = t.match(/בשדה(?:\s+של)?\s+["“]?([A-Za-zא-ת0-9 _\-]+)["”]?/i); if (m) return m[1].trim();
  m = t.match(/(?:עמוד[הת]|column)\s+["“]?([A-Za-zא-ת0-9 _\-]+)["”]?/i); if (m) return m[1].trim();
  return "";
}
function extractEqualsValue(s="") {
  const t = s.replace(/\n/g," ");
  // "הנתון X" / 'הערך X' / 'שווה X'
  let m = t.match(/הנתון\s+["“]?([^",]+?)["”]?(?:\s|$|,)/i); if (m) return m[1].trim();
  m = t.match(/הערך\s+["“]?([^",]+?)["”]?(?:\s|$|,)/i); if (m) return m[1].trim();
  m = t.match(/שווה\s+["“]?([^",]+?)["”]?(?:\s|$|,)/i); if (m) return m[1].trim();
  // ציטוטים
  m = t.match(/["“]([^"]+?)["”]/); if (m) return m[1].trim();
  return "";
}
function extractHours(s="") {
  const m = s.match(/(\d+)\s*שעות|\b(\d+)\s*h/i);
  if (m) return parseInt(m[1]||m[2],10);
  return /יום/.test(s) ? 24 : 10;
}
function extractNewerThanDays(s="") {
  if (/חודש/.test(s)) return 30;
  if (/שבוע/.test(s)) return 7;
  const m = s.match(/(\d+)\s*י?ימים?/);
  if (m) return parseInt(m[1],10);
  return 30;
}
function normalizePhone(s="") {
  let x = String(s).trim().replace(/^whatsapp:/i,"");
  x = x.replace(/[^\d+]/g,"");
  if (!x) return null;
  if (!x.startsWith("+")) x = "+" + x;
  return x;
}

/* ----------------------------- Heuristic Planner ---------------------------- */

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

    steps.push({ trigger: { type: "gmail.unreplied", params: { fromEmail: fromEmail||"", newerThanDays, hours, limit: 50 } } });

    if (/whats\s*app|ווטסאפ|וואטסאפ/i.test(text)) {
      steps.push({ action: { type: "whatsapp.send", params: { to: "", message: "נמצא מייל שלא נענה: {{item.subject}} — {{item.webLink}}" } } });
      if (!fromEmail) missing.push({ key:"fromEmail", label:"כתובת המייל של השולח", example:"name@example.com" });
      missing.push({ key:"to", label:'מספר WhatsApp כולל קידומת מדינה', example:"9725xxxxxxxx" });
      return { steps, missing };
    } else {
      const spreadsheetId = extractSpreadsheetId(text);
      steps.push({
        action: { type: "sheets.append", params: { spreadsheetId: spreadsheetId||"", sheetName: "SLA",
          row: { from:"{{item.from}}", subject:"{{item.subject}}", date:"{{item.date}}", threadId:"{{item.threadId}}", webLink:"{{item.webLink}}" } } }
      });
      if (!fromEmail) missing.push({ key:"fromEmail", label:"כתובת המייל של השולח", example:"name@example.com" });
      if (!spreadsheetId) missing.push({ key:"spreadsheetId", label:"ה־ID של ה-Google Sheet", example:"https://docs.google.com/spreadsheets/d/<ID>/edit" });
      return { steps, missing };
    }
  }

  // Sheets row match
  if (/(google\s*sheets?|גיליון|שיט|sheet|לשונית|טאב|row|שורה)/i.test(text)) {
    const spreadsheetId = extractSpreadsheetId(text) || "";
    const sheetName = extractSheetName(text) || "Sheet1";
    const columnName = extractColumnName(text) || "";
    const equals = extractEqualsValue(text) || "";

    steps.push({ trigger: { type:"sheets.match", params: { spreadsheetId, sheetName, columnName, equals, mode:"new" } } });

    if (/מייל|email|אימייל/i.test(text)) {
      steps.push({ action: { type:"email.send", params: { to:"", subject:"התראה מגיליון {{item.__sheet}}", body:"{{item.__rowAsText}}" } } });
      if (!spreadsheetId) missing.push({ key:"spreadsheetId", label:"ה-ID של ה-Google Sheet", example:"https://docs.google.com/spreadsheets/d/<ID>/edit" });
      if (!sheetName)     missing.push({ key:"sheetName", label:"שם הגליון (Sheet)", example:"SLA או Sheet1" });
      if (!columnName)    missing.push({ key:"columnName", label:"שם העמודה/השדה", example:"project menger" });
      if (!equals)        missing.push({ key:"equals", label:"הערך שתואם להתראה", example:"haim shafir" });
      missing.push({ key:"to", label:"כתובת מייל לקבלת ההתראה", example:"name@example.com" });
      return { steps, missing };
    }

    if (/whats\s*app|ווטסאפ|וואטסאפ/i.test(text)) {
      steps.push({ action: { type:"whatsapp.send", params: { to:"", message:"שורה חדשה: {{item.__rowAsText}}" } } });
      if (!spreadsheetId) missing.push({ key:"spreadsheetId", label:"ה-ID של ה-Google Sheet", example:"https://docs.google.com/spreadsheets/d/<ID>/edit" });
      if (!sheetName)     missing.push({ key:"sheetName", label:"שם הגליון (Sheet)", example:"SLA או Sheet1" });
      if (!columnName)    missing.push({ key:"columnName", label:"שם העמודה/השדה", example:"project menger" });
      if (!equals)        missing.push({ key:"equals", label:"הערך שתואם להתראה", example:"haim shafir" });
      missing.push({ key:"to", label:'מספר WhatsApp כולל קידומת מדינה', example:"9725xxxxxxxx" });
      return { steps, missing };
    }
  }

  return { steps: [], missing: [] };
}

/* ------------------------------- LLM Planner ------------------------------- */

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
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:"POST",
      headers: { "Content-Type":"application/json", Authorization:`Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL, temperature: 0,
        messages: [
          { role:"system", content: JSON_SCHEMA_PROMPT },
          { role:"user", content: text }
        ]
      })
    });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "{}";
    return JSON.parse(content);
  }
  if (NLP_PROVIDER === "openai") {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers: { "Content-Type":"application/json", Authorization:`Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL, temperature: 0,
        messages: [
          { role:"system", content: JSON_SCHEMA_PROMPT },
          { role:"user", content: text }
        ]
      })
    });
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "{}";
    return JSON.parse(content);
  }
  if (NLP_PROVIDER === "ollama") {
    if (!OLLAMA_BASE_URL) throw new Error("OLLAMA_BASE_URL missing");
    const body = { model: OLLAMA_MODEL, prompt: `${JSON_SCHEMA_PROMPT}\n\nטקסט:\n${text}\n\nהחזר JSON:` };
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body)
    });
    const raw = await resp.text();
    const jsonStr = raw.trim().split(/\n/).pop();
    return JSON.parse(jsonStr);
  }
  throw new Error("LLM provider disabled");
}

/* --------------------------- Missing & Questions --------------------------- */

function computeMissingFromRegistry(proposal) {
  const missing = [];
  for (const step of (proposal || [])) {
    if (step.trigger) {
      const name = step.trigger.type;
      const spec = SKILLS.triggers[name];
      if (!spec) continue;
      const params = step.trigger.params || {};
      for (const key of spec.required) if (!params[key]) {
        missing.push(humanizeKey(name,key));
      }
    } else if (step.action) {
      const name = step.action.type;
      const spec = SKILLS.actions[name];
      if (!spec) continue;
      const params = step.action.params || {};
      for (const key of spec.required) if (!params[key]) {
        missing.push(humanizeKey(name,key));
      }
    }
  }
  return uniqByKey(missing,"key");
}
function humanizeKey(skill, key) {
  const map = {
    spreadsheetId: { label: "ה-ID של ה-Google Sheet", example: "https://docs.google.com/spreadsheets/d/<ID>/edit" },
    sheetName:     { label: "שם הגליון (Sheet)", example: "SLA או Sheet1" },
    columnName:    { label: "שם העמודה/השדה", example: "project menger" },
    equals:        { label: "הערך שתואם להתראה", example: "haim shafir" },
    fromEmail:     { label: "כתובת המייל של השולח", example: "name@example.com" },
    to:            { label: skill==="whatsapp.send" ? 'מספר WhatsApp כולל קידומת מדינה' : 'כתובת מייל לקבלת ההתראה', example: skill==="whatsapp.send" ? "9725xxxxxxxx" : "name@example.com" },
  };
  const base = map[key] || { label: key, example: "" };
  return { key, ...base };
}
function buildQuestions(missing) {
  return (missing || []).map(m => {
    switch (m.key) {
      case "spreadsheetId": return "איזה גיליון Google? (אפשר להדביק את כל הקישור)";
      case "sheetName":     return "מה שם הלשונית (Sheet) בגיליון?";
      case "columnName":    return "מה שם העמודה/השדה שעליו בודקים?";
      case "equals":        return "איזה ערך בדיוק צריך לזהות בעמודה הזו?";
      case "fromEmail":     return "ממי מגיעים המיילים (כתובת מייל מלאה)?";
      case "to":            return "לאיזה יעד לשלוח? (כתובת מייל או מספר וואטסאפ בפורמט בינ\"ל)";
      default:              return `חסר ערך עבור ${m.label}`;
    }
  });
}
function uniqByKey(arr, key) {
  const seen = new Set(); const out = [];
  for (const x of arr) if (!seen.has(x[key])) { seen.add(x[key]); out.push(x); }
  return out;
}

/* ------------------------------- Public API -------------------------------- */

async function planFromText(text) {
  // 1) נסה LLM (אם מוגדר), עם תיקוף
  if (["groq","openai","ollama"].includes(NLP_PROVIDER)) {
    try {
      const llm = a
