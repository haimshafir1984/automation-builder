// engine/actions/whatsapp_twilio.js
const Mustache = require("mustache");

function normalizeWhatsAppAddr(v) {
  if (!v) return v;
  let s = String(v).trim();
  if (!s.startsWith("whatsapp:")) {
    if (s.startsWith("+")) s = "whatsapp:" + s;
    else if (/^\d+$/.test(s)) s = "whatsapp:+" + s;
  }
  return s;
}

async function send(opts = {}, payload = {}) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Missing Twilio credentials");

  const twilio = require("twilio")(sid, token);

  const from = normalizeWhatsAppAddr(opts.from || process.env.TWILIO_WHATSAPP_FROM || "");
  const to   = normalizeWhatsAppAddr(opts.to   || process.env.TWILIO_WHATSAPP_TO   || "");
  if (!from) throw new Error("WhatsApp 'from' missing (params.target.from or TWILIO_WHATSAPP_FROM)");
  if (!to)   throw new Error("WhatsApp 'to' missing (params.target.to or TWILIO_WHATSAPP_TO)");

  const ctx = {
    row: payload.row || {},
    payloadJson: JSON.stringify(payload, null, 2),
    spreadsheetId: payload.spreadsheetId || "",
    sheetName: payload.sheetName || "",
    rowIndex: payload.rowIndex || 0,
    sheetUrlRange: payload.sheetUrlRange || "",
  };
  const bodyTpl = opts.text || `New row in {{sheetName}} ({{rowIndex}})
{{payloadJson}}
{{#sheetUrlRange}}
Open: {{sheetUrlRange}}
{{/sheetUrlRange}}`;
  const body = Mustache.render(bodyTpl, ctx);

  console.log("[whatsapp/twilio]", { from, to, overrideFrom: !!opts.from, overrideTo: !!opts.to });

  const msg = await twilio.messages.create({ from, to, body });
  return { sid: msg.sid };
}

module.exports = { send };
