const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const ENV_OLLAMA_URL  = process.env.OLLAMA_BASE_URL || '';
const ENV_OLLAMA_MODEL= process.env.OLLAMA_MODEL || 'phi3:mini';

function toLowerSafe(s){ return String(s || '').toLowerCase(); }

function detectEntities(text){
  const t = toLowerSafe(text);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const fromEmail = emailMatch ? emailMatch[0] : null;

  const phoneMatch = text.match(/(\+?\d{8,15})/);
  const toPhone = phoneMatch ? phoneMatch[0] : null;

  const hoursMatch = t.match(/(\d{1,3})\s*(שעות|שעה|hours?)/);
  const hours = hoursMatch ? Number(hoursMatch[1]) : null;

  const hasWhatsapp = /וואטסאפ|whatsapp/.test(t); // רק אם באמת הזכרת
  const hasSheets   = /גוגל.?שיט|שיט|sheets|google.?sheets/.test(t);

  const sheetIdMatch = text.match(/[A-Za-z0-9-_]{20,}/);
  const spreadsheetId = sheetIdMatch ? sheetIdMatch[0] : null;

  return { fromEmail, toPhone, hours, hasWhatsapp, hasSheets, spreadsheetId };
}

async function tryOllamaPlan({ text, baseUrl, model }){
  const url  = (baseUrl && baseUrl.trim()) || ENV_OLLAMA_URL;
  if (!url) throw new Error('no-ollama-url');

  const r = await fetch(`${url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || ENV_OLLAMA_MODEL,
      prompt: `Return ONLY JSON with {steps:[...]}. Steps may include gmail.unreplied trigger and actions sheets.append and whatsapp.send. If any required param is missing, set null.\n\nUser:\n${text}`,
      stream: false
    }),
    timeout: 15000
  });
  const j = await r.json();
  const raw = (j && j.response) ? j.response.trim() : '';
  if (!raw) throw new Error('empty-ollama-response');

  let plan;
  try { plan = JSON.parse(raw); }
  catch {
    const a = raw.lastIndexOf('{'); const b = raw.lastIndexOf('}');
    if (a >= 0 && b > a) plan = JSON.parse(raw.slice(a, b+1));
  }
  if (!plan || !Array.isArray(plan.steps)) throw new Error('ollama-no-steps');
  return plan;
}

function heuristicPlan(text){
  const ent = detectEntities(text);
  const steps = [];

  steps.push({
    trigger: {
      type: 'gmail.unreplied',
      params: {
        fromEmail: ent.fromEmail || null,
        newerThanDays: 30,
        hours: ent.hours || 10,
        limit: 50
      }
    }
  });

  if (ent.hasSheets) {
    steps.push({
      action: {
        type: 'sheets.append',
        params: {
          spreadsheetId: ent.spreadsheetId || null,
          sheetName: 'SLA',
          row: { from: '{{item.from}}', subject: '{{item.subject}}', ageHours: '{{item.ageHours}}' }
        }
      }
    });
  }

  if (ent.hasWhatsapp) {
    steps.push({
      action: {
        type: 'whatsapp.send',
        params: {
          to: ent.toPhone || null,
          text: 'SLA ⚠️ מאת {{item.from}} בנושא "{{item.subject}}" (עברו {{item.ageHours}} שעות ללא מענה)'
        }
      }
    });
  }

  return { steps };
}

function collectMissing(plan){
  const missing = [];
  (plan.steps || []).forEach((st, idx) => {
    const unit = st.trigger || st.action || {};
    const p = unit.params || {};
    Object.entries(p).forEach(([k,v]) => { if (v === null || v === undefined || v === '') missing.push({ step: idx, key: k }); });
  });
  return missing;
}

async function handle(req, res){
  const text = (req.body?.text || '').trim();
  const baseUrl = (req.body?.baseUrl || '').trim();
  const model   = (req.body?.model   || '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'text is required' });

  let plan = null, provider = null, nlpError = null;
  try { plan = await tryOllamaPlan({ text, baseUrl, model }); provider = 'ollama'; }
  catch (e) { nlpError = String(e.message||e); }

  if (!plan) { plan = heuristicPlan(text); provider = 'heuristic'; }

  const missing = collectMissing(plan);
  return res.json({ ok: true, provider, proposal: plan, missing, nlpError });
}

// שני נתיבים זהים, כדי שלא תיפול על קריאה ישנה
router.post('/from-text', handle);
router.post('/',          handle);

module.exports = router;
