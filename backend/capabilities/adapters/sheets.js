// backend/capabilities/adapters/sheets.js
const { google } = require('googleapis');

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

function extractSpreadsheetId(input) {
  if (!input) return null;
  const s = String(input).trim();
  // אם זה URL מלא של גוגל — שלוף מהקטע /d/<ID>/
  const m = s.match(/\/d\/([A-Za-z0-9-_]{20,})/);
  if (m) return m[1];
  // אחרת, אם זה נראה כמו ID — החזר כפי שהוא
  if (/^[A-Za-z0-9-_]{20,}$/.test(s)) return s;
  return null;
}

function objectToRow(rowObj, header){
  return header.map(h => (rowObj && rowObj[h] != null) ? String(rowObj[h]) : '');
}

async function ensureHeader(sheets, spreadsheetId, sheetName, desiredHeader){
  const get = await sheets.spreadsheets.values.get({
    spreadsheetId, range: `${sheetName}!1:1`
  });
  let header = (get.data.values && get.data.values[0]) || [];
  if (!header.length && desiredHeader && desiredHeader.length){
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [desiredHeader] }
    });
    header = desiredHeader.slice();
  }
  return header;
}

module.exports = {
  async dryRun(_ctx, params){
    const spreadsheetId = extractSpreadsheetId(params.spreadsheetId);
    const sheetName     = params.sheetName || params.tab || 'Sheet1';
    const rowObj        = params.row || {};
    const header        = Object.keys(rowObj).length ? Object.keys(rowObj) : ['from','subject','ageHours'];
    return {
      ok: true,
      type: 'sheets.append',
      dryRun: true,
      spreadsheetId,
      tab: sheetName,
      header,
      preview: [ objectToRow(rowObj, header) ],
      appended: 0
    };
  },

  async execute(_ctx, params){
    const spreadsheetId = extractSpreadsheetId(params.spreadsheetId);
    const sheetName     = params.sheetName || params.tab || 'Sheet1';
    const rowObj        = params.row || {};

    if (!spreadsheetId) throw new Error('spreadsheetId is required (ID or full Google Sheets URL)');
    if (!sheetName)     throw new Error('sheetName is required');

    const sheets = await getSheetsClient();
    const headerDesired = Object.keys(rowObj).length ? Object.keys(rowObj) : ['from','subject','ageHours'];
    const header = await ensureHeader(sheets, spreadsheetId, sheetName, headerDesired);
    const values = [ objectToRow(rowObj, header) ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values }
    });

    return {
      ok: true,
      type: 'sheets.append',
      spreadsheetId,
      tab: sheetName,
      columns: header,
      appended: 1
    };
  }
};
