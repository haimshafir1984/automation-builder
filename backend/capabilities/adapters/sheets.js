// backend/capabilities/adapters/sheets.js
const { google } = require('googleapis');

async function getSheetsClient() {
  // מחייב GOOGLE_APPLICATION_CREDENTIALS מצביע לקובץ ה-SA
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

function objectToRow(rowObj, header){
  // מסדר ערכים לפי סדר הכותרת
  return header.map(h => (rowObj && rowObj[h] != null) ? String(rowObj[h]) : '');
}

async function ensureHeader(sheets, spreadsheetId, sheetName, desiredHeader){
  // אם אין כותרת – נכתוב את הכותרת המבוקשת
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
  // DryRun: מציג מה היה נכתב
  async dryRun(_ctx, params){
    const spreadsheetId = params.spreadsheetId;
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

  // Execute: כותב באמת
  async execute(_ctx, params){
    const spreadsheetId = params.spreadsheetId;
    const sheetName     = params.sheetName || params.tab || 'Sheet1';
    const rowObj        = params.row || {};

    if (!spreadsheetId) throw new Error('spreadsheetId is required');
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
