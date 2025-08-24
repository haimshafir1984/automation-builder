// backend/lib/sheetsHelper.js
const { google } = require('googleapis');
const { loadTokens } = require('./oauthStore');

function extractSpreadsheetId(input) {
  if (!input) return null;
  if (/^[a-zA-Z0-9-_]{30,}$/.test(input)) return input;
  const m = String(input).match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function getSheetsClientWithOAuth(req) {
  const tokens = req.session?.googleTokens || loadTokens();
  if (!tokens) throw new Error('Not connected to Google (OAuth)');
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2.setCredentials(tokens);
  return google.sheets({ version: 'v4', auth: oauth2 });
}

async function ensureHeaderRowIfEmpty(sheets, spreadsheetId, tab, header) {
  const range = `${tab}!A1:Z1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range }).catch(() => null);
  const values = res?.data?.values;
  if (!values || values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [header] },
    });
  }
}

async function appendRow(sheets, spreadsheetId, tab, row) {
  const range = `${tab}!A:Z`;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

module.exports = {
  extractSpreadsheetId,
  getSheetsClientWithOAuth,
  ensureHeaderRowIfEmpty,
  appendRow,
};
