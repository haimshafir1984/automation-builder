// backend/routes/nlp.js
const express = require('express');
const fetch = require('node-fetch'); // אם אין: npm i node-fetch@2
const router = express.Router();

// --- כלי עזר קטנים ---
function extractEmail(text) {
  const m = String(text).match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return m ? m[0] : null;
}
function extractHours(text) {
  // מספר לפני/אחרי "שעות" או "hours"
  const m1 = String(text).match(/(\d{1,3})\s*(שעות|שעה)/i);
  const m2 = String(text).match(/(hours?)\s*(\d{1,3})/i);
  const n = m1 ? parseInt(m1[1], 10) : (m2 ? parseInt(m2[2], 10) : null);
  return (Number.isFinite(n) && n > 0) ? n : null;
}
function detectIntentHeuristic(text) {
  const t = (text || '').toLowerCase();
  const hasWhats = /וואטסאפ|whatsapp/.test(t);
  const hasLead  = /ליד|lead\b/.test(t);
  const hasSla   = /sla|לא נענ(ה|ו)|unrepl(ied|y)/.test(t);

  if (hasWhats && hasSla) return 'whatsapp-notify';
  if (hasLead) return 'lead-intake';
  if (hasSla) return 'sla-simple';
  return null;
}

// --- NLP דמה/אולמה ---
router.post('/parse', express.json(), async (req, res) => {
  const text = (req.body?.text || '').trim();
  // אם יש לך Ollama רץ מקומית ורצית באמת לקרוא אליו — אפשר דרך /nlp/ollama-direct
  // כרגע נשתמש בחוקים כדי לא לחסום את ה־plan.
  const intent = detectIntentHeuristic(text);
  const entities = {
    fromEmail: extractEmail(text),
    hours: extractHours(text),
  };
  const confidence = intent ? 0.7 : 0.0;
  return res.json({ ok: true, provider: 'heuristic', intent, entities, confidence });
});

// אופציונלי: פרוקסי ל-Ollama (לא חובה בשביל הזרימה)
router.get('/ollama-direct', async (req, res) => {
  const text = (req.query?.text || '').trim();
  try {
    const r = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ model: 'llama3.1', prompt: `intent+entities for: ${text}` })
    });
    const data = await r.text(); // Ollama מחזיר stream שורה-שורה; לשם פשטות נחזיר raw
    return res.json({ ok: true, provider: 'ollama', raw: data });
  } catch (e) {
    return res.status(200).json({ ok: true, provider: 'ollama', error: e.message, intent: null, entities: {}, confidence: 0 });
  }
});

module.exports = router;
