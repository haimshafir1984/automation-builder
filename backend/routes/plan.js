// backend/routes/plan.js
const express = require('express');
const router = express.Router();

// ===== עזרי ניתוח טקסט =====
function extractEmail(text){ const m=String(text).match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i); return m?m[0]:null; }
function extractHours(text){
  const m1=String(text).match(/(\d{1,3})\s*(שעות|שעה)/i);
  const m2=String(text).match(/(hours?)\s*(\d{1,3})/i);
  const n = m1 ? parseInt(m1[1],10) : (m2 ? parseInt(m2[2],10) : null);
  return (Number.isFinite(n) && n>0) ? n : null;
}
function has(text, re){ return re.test((text||'').toLowerCase()); }
function extractNewerThanDays(text){
  if (has(text,/חודש האחרון|last month|in the last month/)) return 30;
  if (has(text,/\b(?:30|31)\s*days?\b/)) return 30;
  if (has(text,/שבוע האחרון|last week/)) return 7;
  return null;
}

// ===== Detect intent =====
function detectIntent(text){
  const t=(text||'').toLowerCase();
  const whats = /וואטסאפ|whatsapp/.test(t);
  const lead  = /ליד|lead\b/.test(t);
  const sla   = /sla|לא נענ(ה|ו)|unrepl(ied|y)/.test(t);
  if (whats && sla) return 'whatsapp-notify';
  if (lead) return 'lead-intake';
  if (sla) return 'sla-simple';
  return null;
}

// ===== Builders =====
function buildSlaPipeline({ fromEmail, hours, newerThanDays }) {
  const trigger = { type:'gmail.unreplied', params:{ fromEmail, hours } };
  if (newerThanDays) trigger.params.newerThanDays = newerThanDays;
  const action  = { type:'sheets.append', params:{ spreadsheetId:null, sheetName:'SLA', columns:['from','subject','date'] } };
  return { type:'pipeline', steps:[ {trigger}, {action} ] };
}

function buildLeadIntakePipeline() {
  const q = 'in:anywhere (subject:"ליד" OR subject:Lead) -in:chats';
  const trigger = { type:'gmail.search', params:{ q, limit:50 } };
  const action  = { type:'sheets.append', params:{ spreadsheetId:null, sheetName:'Leads', columns:['from','subject','date'] } };
  return { type:'pipeline', steps:[ {trigger}, {action} ] };
}

function buildWhatsappNotifyPipeline({ fromEmail, hours }) {
  const trigger = { type:'gmail.unreplied', params:{ fromEmail, hours } };
  // אם אין לך וואטסאפ עדיין—תוכל להחליף ל-sheets.append, או slack.webhook
  const action  = { type:'whatsapp.send', params:{ to:null, text:'עבר SLA של {{hours}}h ממייל {{from}}: {{subject}}' } };
  return { type:'pipeline', steps:[ {trigger}, {action} ] };
}

// ===== /api/plan =====
router.post('/', express.json(), async (req, res) => {
  const text = (req.body?.text || '').trim();

  // נזהה כוונה בסיסית (“fallback” בטוח)
  const intent = detectIntent(text);
  const fromEmail = extractEmail(text);
  const hours = extractHours(text) || 4;
  const newerThanDays = extractNewerThanDays(text);

  let proposal, missing = [];

  if (intent === 'sla-simple') {
    proposal = buildSlaPipeline({ fromEmail, hours, newerThanDays });
    if (!fromEmail) missing.push('fromEmail');
    if (!hours) missing.push('hours');
    missing.push('spreadsheetId','tab'); // sheetName=tab
  }
  else if (intent === 'lead-intake') {
    proposal = buildLeadIntakePipeline();
    missing.push('spreadsheetId','tab');
  }
  else if (intent === 'whatsapp-notify') {
    proposal = buildWhatsappNotifyPipeline({ fromEmail, hours });
    if (!fromEmail) missing.push('fromEmail');
    if (!hours) missing.push('hours');
    missing.push('toPhone');
  }
  else {
    // לא זיהה—ננסה heuristics: אם כתוב "שעות/לא נענה" → SLA, אחרת Lead כברירת מחדל
    if (/לא נענ(ה|ו)|שעות|unrepl(ied|y)/i.test(text)) {
      proposal = buildSlaPipeline({ fromEmail, hours, newerThanDays });
      if (!fromEmail) missing.push('fromEmail');
      if (!hours) missing.push('hours');
      missing.push('spreadsheetId','tab');
    } else {
      proposal = buildLeadIntakePipeline();
      missing.push('spreadsheetId','tab');
    }
  }

  return res.json({
    ok: true,
    type: 'pipeline',
    proposal,
    missing: Array.from(new Set(missing)),
    hints: { intent: intent || 'fallback', entities: { fromEmail, hours, newerThanDays } }
  });
});

module.exports = router;
