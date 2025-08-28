// backend/capabilities/adapters/whatsapp.js

const twilio = require('twilio');

// Detect provider (Meta Cloud vs Twilio). Here we use Twilio if present.
function detectProvider() {
  const hasMeta = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
  const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  if (hasMeta) return 'meta';   // לא ממומש כאן. נשאר לעתיד.
  if (hasTwilio) return 'twilio';
  return null;
}

function normalizeToPhone(raw, fallback) {
  let v = (raw || fallback || '').toString().trim();
  if (!v) return null;
  // הסר רווחים/מקפים ותווים מיותרים
  v = v.replace(/[^\d+]/g, '');
  // ודא E.164: חייב להתחיל ב-+ ולפחות 8 ספרות אחרי הקידומת
  if (!/^\+[1-9]\d{7,14}$/.test(v)) return null;
  // הוסף prefix של וואטסאפ אם חסר
  return v.startsWith('whatsapp:') ? v : ('whatsapp:' + v);
}

async function sendTwilio(_ctx, params, mode='execute') {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromWhats  = process.env.TWILIO_WHATSAPP_FROM;  // למשל: whatsapp:+14155238886
  const defaultTo  = process.env.TWILIO_WHATSAPP_TO || process.env.DEFAULT_WHATSAPP_TO || null;

  const to = normalizeToPhone(params.to, defaultTo);
  const body = params.text || params.message || params.body || 'שלום!';

  if (mode === 'dryRun') {
    if (!to) {
      return { ok:false, provider:'twilio', dryRun:true, error:'missing or invalid WhatsApp To (E.164). Example: +9725XXXXXXX' };
    }
    return { ok:true, provider:'twilio', dryRun:true, to, from: fromWhats, body };
  }

  if (!to) throw new Error('The "to" number is missing or invalid. Use E.164 like +9725XXXXXXX');

  const client = twilio(accountSid, authToken);
  const msg = await client.messages.create({
    from: fromWhats,
    to,
    body
  });

  return { ok:true, provider:'twilio', sid: msg.sid, to, from: fromWhats, status: msg.status || 'queued' };
}

module.exports = {
  // Dry run
  async dryRun(ctx, params) {
    const provider = detectProvider();
    if (provider === 'twilio') return sendTwilio(ctx, params, 'dryRun');
    if (provider === 'meta')   return { ok:false, provider:'meta', dryRun:true, note:'Meta provider not implemented in this adapter yet' };
    return { ok:false, dryRun:true, error:'No WhatsApp provider configured (Twilio/Meta)' };
  },

  // Execute
  async execute(ctx, params) {
    const provider = detectProvider();
    if (provider === 'twilio') return sendTwilio(ctx, params, 'execute');
    if (provider === 'meta')   throw new Error('Meta provider not implemented yet');
    throw new Error('No WhatsApp provider configured (Twilio/Meta)');
  },

  // לצורך תאימות אם הריצה קוראת ישירות לשם .send
  async send(ctx, params) { return module.exports.execute(ctx, params); }
};
