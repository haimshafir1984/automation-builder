// backend/routes/plan.js
const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'llama3.2';

// --- Heuristic helpers (fallback when Ollama not available) ---
function toLowerSafe(s){ return String(s || '').toLowerCase(); }

function detectEntities(text){
  const t = toLowerSafe(text);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const fromEmail = emailMatch ? emailMatch[0] : null;

  const phoneMatch = text.match(/(\+?\d{8,15})/);
  const toPhone = phoneMatch ? phoneMatch[0] : null;

  const hoursMatch = t.match(/(\d{1,3})\s*(שעות|שעה|hours?)/);
  const hours = hoursMatch ? Number(hoursMatch[1]) : null;

  const hasWhatsapp = /וואטסאפ|whatsapp/.test(t);
  const hasSheets   = /גוגל.?שיט|שיט|sheets|google.?sheets/.test(t);

  const sheetIdMatch = text.match(/[A-Za-z0-9-_]{20,}/);
  const spreadsheetId = sheetIdMatch ? sheetIdMatch[0] : null;

  return { fromEmail, toPhone, hours, hasWhatsapp, hasSheets, spreadsheetId };
}

// --- /api/plan/from-text ---
router.post('/from-text', async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'text is required' });

  // 1) Try Ollama first
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `Return ONLY JSON with {steps:[...]}. The steps may include gmail.unreplied trigger and actions such as sheets.append and whatsapp.send. If any required param is missing, set null.\n\nUser:\n${text}`,
        stream: false
      })
    });
    const j = await r.json();
    const raw = (j && j.response) ? j.response.trim() : '';
    let plan;
    try { plan = JSON.parse(raw); } catch (_e) {
      // try to salvage a JSON block
      const s = raw;
      const a = s.lastIndexOf('{');
      const b = s.lastIndexOf('}');
      if (a >= 0 && b > a) plan = JSON.parse(s.slice(a, b+1));
    }
    if (plan && Array.isArray(plan.steps)) {
      // Build "missing" list for any nulls
      const missing = [];
      plan.steps.forEach((st, idx) => {
        const unit = st.trigger || st.action || {};
        const p = unit.params || {};
        Object.entries(p).forEach(([k,v]) => { if (v === null || v === undefined || v === '') missing.push({ step: idx, key: k }); });
      });
      return res.json({ ok: true, type: 'free-steps', proposal: plan, missing });
    }
  } catch (_e) {
    // ignore and fallback
  }

  // 2) Fallback heuristics
  const ent = detectEntities(text);
  const steps = [];
  steps.push({
    trigger: {
      type: 'gmail.unreplied',
      params: {
        fromEmail: ent.fromEmail || null,
        newerThanDays: 30,
        hours: ent.hours || 4,
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
          template: 'sla_breach_basic'
        }
      }
    });
  }
  const missing = [];
  steps.forEach((st, idx) => {
    const unit = st.trigger || st.action || {};
    const p = unit.params || {};
    Object.entries(p).forEach(([k,v]) => { if (v === null) missing.push({ step: idx, key: k }); });
  });
  return res.json({ ok: true, type: 'heuristic-steps', proposal: { steps }, missing, hints: { source: 'fallback' } });
});

module.exports = router;
