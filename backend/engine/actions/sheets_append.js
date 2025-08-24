// engine/actions/sheets_append.js
const fs = require("fs");
const { google } = require("googleapis");

function loadServiceAccount() {
  const p = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!p || !fs.existsSync(p)) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not found");
  const raw = fs.readFileSync(p, "utf-8").replace(/^\uFEFF|\uFEFF$/g, "");
  return JSON.parse(raw);
}
function getSheetsWriteClient() {
  const sa = loadServiceAccount();
  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"], // כתיבה
  });
  return google.sheets({ version: "v4", auth: jwt });
}

async function ensureHeadersIfNeeded(sheets, spreadsheetId, sheetName, columns, headerRow=1) {
  if (!columns?.length) return;
  const range = `${sheetName}!A${headerRow}:Z${headerRow}`;
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const row = r?.data?.values?.[0] || [];
  const hasHeaders = row.length > 0 && row.some(v => (v||"").toString().trim() !== "");
  if (hasHeaders) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [columns] }
  });
}

function valueFromPayload(name, payload) {
  const key = String(name || "").toLowerCase();
  switch (key) {
    case "date":
    case "dateiso":
      return payload.dateISO || new Date().toISOString();
    case "from":
      return payload.from || "";
    case "to":
      return payload.to || "";
    case "subject":
      return payload.subject || "";
    case "text":
    case "body":
      return payload.text || "";
    case "snippet":
    case "textsnippet":
      return payload.textSnippet || "";
    default:
      // אפשרות למפות שדות מותאמים (payload.custom.xx)
      return payload[key] || "";
  }
}

async function appendRow(opts = {}, payload = {}) {
  const spreadsheetId = opts.spreadsheetId || payload.spreadsheetId;
  const sheetName = opts.sheetName || payload.sheetName || "Sheet1";
  const headerRow = Number(opts.headerRow || 1);
  const columns = Array.isArray(opts.columns) && opts.columns.length
    ? opts.columns
    : ["date", "from", "subject", "textSnippet"];

  if (!spreadsheetId) throw new Error("append-row: missing spreadsheetId");

  const sheets = getSheetsWriteClient();

  // וודא כותרות אם ביקשו
  if (String(opts.ensureHeaders || "true").toLowerCase() !== "false") {
    await ensureHeadersIfNeeded(sheets, spreadsheetId, sheetName, columns, headerRow);
  }

  const values = [ columns.map(col => valueFromPayload(col, payload)) ];
  const range = `${sheetName}!A:Z`;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values }
  });

  const updates = res?.data?.updates;
  return { updatedRange: updates?.updatedRange || null, updatedRows: updates?.updatedRows || 0 };
}

module.exports = { "append-row": appendRow };
