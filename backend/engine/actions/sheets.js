// engine/actions/sheets.js
const fs = require("fs");
const { google } = require("googleapis");

// מחזיר לקוח Sheets עם הרשאות כתיבה
function getSheetsRW() {
  const jsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing or not found");
  }
  let sa;
  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    sa = JSON.parse(raw);
  } catch (e) {
    throw new Error("Failed to parse service account JSON (BOM/format?)");
  }
  // 👈 חשוב: scope עם כתיבה
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  const auth = new google.auth.JWT(sa.client_email, null, sa.private_key, scopes);
  return google.sheets({ version: "v4", auth });
}

// יוצר כותרות אם ביקשת ensureHeaders=true ואין שורה בכותרת
async function ensureHeadersIfNeeded(sheets, spreadsheetId, sheetName, headerRow, columns=[]) {
  if (!columns || !columns.length) return;
  const range = `${sheetName}!${headerRow}:${headerRow}`;
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId, range }).catch(() => null);
  const exists = !!(cur && cur.data && cur.data.values && cur.data.values.length && cur.data.values[0].length);
  if (exists) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [ columns ] }
  });
}

// ממפה אובייקט row לערכי עמודות לפי הסדר
function mapRowByColumns(rowObj, columns) {
  return columns.map(c => {
    if (!rowObj) return "";
    // תומך גם בשמות עם רווחים: row["project name"]
    if (Object.prototype.hasOwnProperty.call(rowObj, c)) return rowObj[c] ?? "";
    // נסה גם גרסה בלי רווחים/LowerCase קל:
    const key = Object.keys(rowObj).find(k => k.toLowerCase() === c.toLowerCase());
    return key ? (rowObj[key] ?? "") : "";
  });
}

// הפעולה בפועל: append-row
async function appendRow(paramsTarget, payload) {
  const spreadsheetId = paramsTarget.spreadsheetId;
  const sheetName     = paramsTarget.sheetName || "Sheet1";
  const headerRow     = Number(paramsTarget.headerRow || 1);
  const columns       = paramsTarget.columns || []; // ["date","from","subject","textSnippet"]
  const ensureHeaders = !!paramsTarget.ensureHeaders;

  if (!spreadsheetId) throw new Error("append-row missing spreadsheetId");

  const sheets = getSheetsRW();

  try {
    if (ensureHeaders && columns.length) {
      await ensureHeadersIfNeeded(sheets, spreadsheetId, sheetName, headerRow, columns);
    }

    // נמשוך נתונים לכתיבה מתוך payload:
    // עדיפות ל-payload.row (למשל בווב־הוק), אח"כ ל-payload.body.row, ואז לפישוט – payload.body כולו.
    const rowObj =
      (payload && payload.row) ||
      (payload && payload.body && payload.body.row) ||
      (payload && payload.body) ||
      payload ||
      {};

    const values = columns.length ? [ mapRowByColumns(rowObj, columns) ]
                                  : [ Object.values(rowObj) ];

    const range = `${sheetName}!A:${String.fromCharCode(64 + Math.max(1, values[0].length))}`;
    const resp = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values }
    });

    const updates = resp?.data?.updates || {};
    console.log("[sheets.append] ok:", {
      updatedRange: updates.updatedRange,
      updatedRows: updates.updatedRows,
      updatedColumns: updates.updatedColumns
    });

    return { ok: true, updates };
  } catch (e) {
    console.error("[sheets.append] error:", e?.message || e);
    throw e;
  }
}

module.exports = { appendRow };
