// backend/capabilities/adapters/whatsapp.js
const fetch = require('node-fetch');
const twilio = require('twilio');

function normalizeWhats(s) {
  if (!s) return s;
  return /^whatsapp:/.test(s) ? s : `whatsapp:${s}`;
}

/* ---------- Meta WhatsApp Cloud API ---------- */
const GRAPH = 'https://graph.facebook.com/v20.0';
async function metaSend(params = {}) {
  const token   = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { ok:false, error:'Meta WhatsApp not configured (WHATSAPP_TOKEN & WHATSAPP_PHONE_ID)' };

  const { to, text, template } = params;
  if (!to)   return { ok:false, error:'to is required' };
  if (!text && !template) return { ok:false, error:'text or template is required' };

  const url = `${GRAPH}/${phoneId}/messages`;
  const body = template
    ? { messaging_product:'whatsapp', to, type:'template', template: { name: template, language: { code:'he' } } }
    : { messaging_product:'whatsapp', to, type:'text', text: { body: text } };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(()=>null);
  return { ok: res.ok, status: res.status, response: json };
}

/* ---------- Twilio WhatsApp ---------- */
async function twilioSend(params = {}) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_FROM;
  if (!sid || !token || !from) {
    return { ok:false, error:'Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM/WHATSAPP_FROM)' };
  }

  const { to, text } = params;
  if (!to || !text) return { ok:false, error:'to and text are required' };

  const client = twilio(sid, token);
  const res = await client.messages.create({
    from: normalizeWhats(from),
    to: normalizeWhats(to),
    body: text
  });
  return { ok:true, sid: res.sid, status: res.status };
}

/* ---------- Router ---------- */
function providerName() {
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) return 'meta';
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return 'twilio';
  return 'none';
}

module.exports = {
  send: {
    async dryRun(_ctx, params={}) {
      return { ok:true, dryRun:true, provider: providerName(), params };
    },
    async execute(_ctx, params={}) {
      const p = providerName();
      if (p === 'meta')   return metaSend(params);
      if (p === 'twilio') return twilioSend(params);
      return { ok:false, error:'No WhatsApp provider configured (set Meta or Twilio env vars)' };
    }
  }
};
