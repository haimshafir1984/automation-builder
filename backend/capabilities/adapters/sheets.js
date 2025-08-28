// backend/capabilities/adapters/sheets.js
const { google } = require('googleapis');

async function getSheetsClient() {
  // נשען על GOOGLE_APPLICATION_CREDENTIALS (Secret File ברנדר)
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

function objToRow(rowObj) {
  // מייצר סדר עמודות קבוע: לפי מפתחות האובייקט
  const keys = Object.keys(rowObj || {});
  const values = keys.map(k => String(rowObj[k] ?? ''));
  return { header: keys, values };
}

async function appendRow(spreadsheetId, sheetName, rowObj) {
  const sheets = await getSheetsClient();
  const { header, values } = objToRow(rowObj);

  // נכתוב תמיד ל- A1 (append), וה-API יוסיף שורה מתחת לאחרונות
  const range = `${sheetName}!A1`;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] }
  });
  return { updated: res.data.updates?.updatedRows || 0, header };
}

module.exports = {
  append: {
    async dryRun(_ctx, params = {}) {
      const { spreadsheetId, sheetName = 'Sheet1', row = {} } = params;
      const r = objToRow(row);
      return {
        ok: true,
        dryRun: true,
        spreadsheetId: spreadsheetId || null,
        tab: sheetName,
        header: r.header,
        preview: [r.values],
        appended: 0,
        mode: 'row-object'
      };
    },
    async execute(_ctx, params = {}) {
      try {
        const { spreadsheetId, sheetName = 'Sheet1', row = {} } = params;
        if (!spreadsheetId) return { ok: false, error: 'spreadsheetId is required' };
        if (!sheetName)     return { ok: false, error: 'sheetName is required' };
        const out = await appendRow(spreadsheetId, sheetName, row);
        return { ok: true, ...out };
      } catch (e) {
        return { ok: false, error: String(e.message || e) };
      }
    }
  }
};
