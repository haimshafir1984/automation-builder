// backend/capabilities/adapters/whatsapp.js
const twilio = require('twilio');

function detectProvider() {
  const hasMeta   = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
  const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  if (hasMeta)   return 'meta';   // לא ממומש כאן
  if (hasTwilio) return 'twilio';
  return null;
}

function normalizeToPhone(raw, fallback) {
  let v = (raw || fallback || '').toString().trim();
  if (!v) return null;
  v = v.replace(/[^\d+]/g, '');                          // נקה רווחים/מקפים
  if (!/^\+[1-9]\d{7,14}$/.test(v)) return null;         // E.164
  return v.startsWith('whatsapp:') ? v : ('whatsapp:' + v);
}

async function sendViaTwilio(_ctx, params, mode='execute') {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromWhats  = process.env.TWILIO_WHATSAPP_FROM;    // למשל whatsapp:+14155238886
  const defaultTo  = process.env.TWILIO_WHATSAPP_TO || process.env.DEFAULT_WHATSAPP_TO || null;

  const to   = normalizeToPhone(params.to, defaultTo);
  const body = params.text || params.message || params.body || 'שלום!';

  if (mode === 'dryRun') {
    if (!to) {
      return { ok:false, provider:'twilio', dryRun:true, error:'missing/invalid WhatsApp To (E.164, e.g. +9725XXXXXXX)' };
    }
    return { ok:true, provider:'twilio', dryRun:true, to, from: fromWhats, body };
  }

  if (!to) throw new Error('The "to" number is missing or invalid (use E.164 like +9725XXXXXXX)');
  const client = twilio(accountSid, authToken);
  const msg = await client.messages.create({ from: fromWhats, to, body });
  return { ok:true, provider:'twilio', sid: msg.sid, to, from: fromWhats, status: msg.status || 'queued' };
}

module.exports = {
  async dryRun(ctx, params) {
    const p = detectProvider();
    if (p === 'twilio') return sendViaTwilio(ctx, params, 'dryRun');
    if (p === 'meta')   return { ok:false, provider:'meta', dryRun:true, note:'Meta provider not implemented' };
    return { ok:false, dryRun:true, error:'No WhatsApp provider configured (Twilio/Meta)' };
  },
  async execute(ctx, params) {
    const p = detectProvider();
    if (p === 'twilio') return sendViaTwilio(ctx, params, 'execute');
    if (p === 'meta')   throw new Error('Meta provider not implemented');
    throw new Error('No WhatsApp provider configured (Twilio/Meta)');
  },
  async send(ctx, params) { return module.exports.execute(ctx, params); } // תאימות
};
