// backend/routes/plan.js
const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'phi3:mini';

// ברירות מחדל מה-ENV
const DEFAULT_SPREADSHEET_ID = process.env.DEFAULT_SPREADSHEET_ID || null;
const DEFAULT_WHATSAPP_TO    = process.env.TWILIO_WHATSAPP_TO || process.env.WHATSAPP_TO || null;

function toLowerSafe(s){ return String(s || '').toLowerCase(); }

function detectEntities(text){
  const t = toLowerSafe(text);
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const fromEmail = emailMatch ? emailMatch[0] : null;
  const phoneMatch = text.match(/(\+?\d{8,15})/);
  const toPhone = phoneMatch ? phoneMatch[0] : null;
  const hoursMatch = t.match(/(\d{1,3})\s*(שעות|שעה|hours?)/);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 10;
  const hasWhatsapp = /וואטסאפ|whatsapp/.test(t);
  const hasSheets   = /גוגל.?שיט|שיט|sheets|google.?sheets/.test(t);
  const newerThanDays = 30;

  // spreadsheet id (גס)
  const sheetIdMatch = text.match(/[A-Za-z0-9-_]{20,}/);
  const spreadsheetId = sheetIdMatch ? sheetIdMatch[0] : null;

  return { fromEmail, toPhone, hours, hasWhatsapp, hasSheets, spreadsheetId, newerThanDays };
}

function salvageJson(s){
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b+1)); } catch {} }
  return null;
}

async function askOllama({ baseUrl, model, prompt }){
  const res = await fetch(`${baseUrl.replace(/\/$/,'')}/api/generate`, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`ollama http ${res.status} ${text.slice(0,120)}`);
  }
  const json = await res.json();
  return (json.response || '').trim();
}

router.post('/from-text', async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ ok:false, error:'text is required' });

  const provider = (req.body?.provider || '').toLowerCase();
  const model = req.body?.model || OLLAMA_MODEL;
  const defaults = Object.assign({}, req.body?.defaults || {}, {
    spreadsheetId: DEFAULT_SPREADSHEET_ID || null,
    whatsappTo:    DEFAULT_WHATSAPP_TO || null,
  });

  // 1) נסה Ollama לבנות steps מלאים
  if (provider === 'ollama') {
    try {
      const prompt = [
        'Return ONLY minified JSON of the form: {"steps":[ ... ]}',
        'You may include a gmail.unreplied trigger and actions like sheets.append and whatsapp.send.',
        'Use placeholders null when missing.',
        'For sheets.append prefer row-object mode: {"row":{"from":"{{item.from}}","subject":"{{item.subject}}","ageHours":"{{item.ageHours}}"}}',
        'User:', text
      ].join('\n');

      const raw = await askOllama({ baseUrl: OLLAMA_BASE_URL, model, prompt });
      const plan = salvageJson(raw);
      if (plan && Array.isArray(plan.steps)) {
        // ברירות מחדל לשדות חסרים
        plan.steps.forEach(st => {
          const unit = st.trigger || st.action; if (!unit || !unit.params) return;
          if (unit.type === 'sheets.append') {
            unit.params.spreadsheetId = unit.params.spreadsheetId || defaults.spreadsheetId || null;
            unit.params.sheetName     = unit.params.sheetName || 'SLA';
            if (!unit.params.row) unit.params.row = { from:'{{item.from}}', subject:'{{item.subject}}', ageHours:'{{item.ageHours}}' };
          }
          if (unit.type === 'whatsapp.send') {
            unit.params.to = unit.params.to || defaults.whatsappTo || null;
            unit.params.text = unit.params.text || 'התראה: מייל שלא נענה בזמן SLA';
          }
        });

        const missing = [];
        plan.steps.forEach((st, idx) => {
          const unit = st.trigger || st.action || {};
          const p = unit.params || {};
          Object.entries(p).forEach(([k,v]) => { if (v === null || v === '') missing.push({ step: idx, key: k, type: unit.type }); });
        });
        return res.json({ ok:true, type:'pipeline', proposal: plan, missing, provider:'ollama' });
      }
    } catch (e) {
      // אם Ollama נפל (ngrok סגור / HTML), נרד לפולבק
    }
  }

  // 2) Heuristic fallback — תמיד בונה 3 צעדים
  const ent = detectEntities(text);
  const steps = [
    { trigger: { type:'gmail.unreplied', params: {
      fromEmail: ent.fromEmail || null,
      newerThanDays: ent.newerThanDays || 30,
      hours: ent.hours || 10,
      limit: 50
    }}},
    { action: { type:'sheets.append', params: {
      spreadsheetId: defaults.spreadsheetId || ent.spreadsheetId || null,
      sheetName: 'SLA',
      row: { from:'{{item.from}}', subject:'{{item.subject}}', ageHours:'{{item.ageHours}}' }
    }}},
    { action: { type:'whatsapp.send', params: {
      to: ent.toPhone || defaults.whatsappTo || null,
      text: 'התראה: מייל שלא נענה בזמן SLA'
    }}}
  ];
  const missing = [];
  steps.forEach((st, idx) => {
    const unit = st.trigger || st.action || {};
    const p = unit.params || {};
    Object.entries(p).forEach(([k,v]) => { if (v === null || v === '') missing.push({ step: idx, key: k, type: unit.type }); });
  });
  return res.json({ ok:true, type:'pipeline', proposal:{ steps }, missing, provider: provider || 'heuristic' });
});

module.exports = router;
