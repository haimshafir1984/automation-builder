// engine/actions/email.js
const nodemailer = require("nodemailer");
const Mustache = require("mustache");

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) throw new Error("Missing SMTP settings");

  const secure = port === 465; // TLS
  transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
  });
  return transporter;
}

async function send(opts = {}, payload = {}) {
  const t = getTransporter();

  const ctx = {
    row: payload.row || {},
    payloadJson: JSON.stringify(payload, null, 2),
    spreadsheetId: payload.spreadsheetId || "",
    sheetName: payload.sheetName || "",
    rowIndex: payload.rowIndex || 0,
    sheetUrlRange: payload.sheetUrlRange || "",
  };

  const to = opts.to || process.env.SMTP_TO;
  const subjectTpl = opts.subject || "New row in {{sheetName}} (row {{rowIndex}})";
  const bodyTpl = opts.body || `Row details:
{{payloadJson}}
{{#sheetUrlRange}}
Open in Sheets: {{sheetUrlRange}}
{{/sheetUrlRange}}`;

  if (!to) throw new Error("SMTP 'to' missing (params.target.to or SMTP_TO)");
  const subject = Mustache.render(subjectTpl, ctx);
  const body = Mustache.render(bodyTpl, ctx);

  const info = await t.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text: body,
  });
  return { messageId: info.messageId };
}

module.exports = { send };
