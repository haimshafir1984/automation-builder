// backend/routes/nlp.js
const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch@2
const router = express.Router();

// --- ENV ---
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'llama3.2';

// --- Helpers ---
const asJson = (s) => {
  try { return JSON.parse(s); } catch (_e) { return null; }
};

// normalize model output that might include text around the JSON
function extractJsonBlock(s) {
  if (!s) return null;
  // try direct
  let j = asJson(s.trim());
  if (j) return j;

  // try to find the last {...} block
  const start = s.lastIndexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const maybe = s.slice(start, end + 1);
    return asJson(maybe);
  }
  return null;
}

const SCHEMA_EXAMPLE = {
  intent: "automation.plan",
  confidence: 0.0,
  entities: {},
  steps: [
    { trigger: { type: "gmail.unreplied", params: { fromEmail: "foo@bar.com", hours: 4, limit: 50 } } },
    { action:  { type: "sheets.append",   params: { spreadsheetId: "xxx", sheetName: "SLA", row: { a: 1 } } } },
    { action:  { type: "whatsapp.send",   params: { to: "+972...", template: "sla_breach_basic" } } }
  ]
};

const SYSTEM_PROMPT = `You are an automation planner. You MUST answer ONLY with strict JSON (no markdown fences, no prose).
The JSON schema is:
${JSON.stringify(SCHEMA_EXAMPLE)}

Rules:
- "steps" is REQUIRED and is an ordered array.
- Use one TRIGGER max; rest are ACTIONS.
- If missing required params, still include the step and set those params to null, so the backend can ask for them.
- Only use known types: gmail.unreplied, sheets.append, whatsapp.send, telegram.send, email.send, http.post
- Confidence is 0..1 float.
- The reply must be ONLY the JSON.`;

// --- Endpoints ---

// Simple passthrough for quick checks
router.get('/ollama-direct', async (req, res) => {
  const text = (req.query?.text || '').trim();
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: text || 'ping',
        stream: false
      })
    });
    const data = await r.json(); // {response, ...}
    return res.json({ ok: true, provider: 'ollama', data });
  } catch (e) {
    return res.status(200).json({ ok: false, provider: 'ollama', error: e.message });
  }
});

// Main: turn free text into steps (multi-action)
router.post('/parse', async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'text is required' });

  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `${SYSTEM_PROMPT}\n\nUSER:\n${text}`,
        stream: false
      })
    });
    const j = await r.json(); // {response: "..."}
    const parsed = extractJsonBlock(j?.response || '');
    if (!parsed || !Array.isArray(parsed.steps)) {
      return res.status(200).json({ ok: false, error: 'LLM did not return valid steps', raw: j });
    }
    return res.json({ ok: true, provider: 'ollama', plan: parsed });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
});

module.exports = router;
