// backend/lib/googleSheets.js
const { google } = require('googleapis');
const fs = require('fs');

function makeAuth(scopes=['https://www.googleapis.com/auth/spreadsheets']) {
  // אופציה א: שני משתני סביבה
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes,
    });
  }
  // אופציה ב: JSON מלא במשתנה סביבה
  if (process.env.GOOGLE_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const fp = '/tmp/gcp-sa.json';
    fs.writeFileSync(fp, process.env.GOOGLE_CREDENTIALS_JSON);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = fp;
  }
  // אופציה ג: Secret File עם GOOGLE_APPLICATION_CREDENTIALS (מומלץ)
  return new google.auth.GoogleAuth({ scopes });
}

function getSheets() {
  const auth = makeAuth();
  return google.sheets({ version: 'v4', auth });
}

async function readHeader(spreadsheetId, tab='Sheet1') {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!1:1` });
  const values = res.data.values || [];
  return (values[0] || []).map(v => String(v));
}

async function setHeader(spreadsheetId, tab, header) {
  const sheets = getSheets();
  const range = `${tab}!A1:${colLetter(header.length)}1`;
  await sheets.spreadsheets.values.update({
    spreadsheetId, range, valueInputOption: 'RAW',
    requestBody: { values: [header] }
  });
}

function rowObjectToArray(rowObj, header) {
  return header.map(h => (rowObj[h] ?? ''));
}

async function appendRows(spreadsheetId, tab, rows) {
  if (!rows?.length) return { appended: 0 };
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: `${tab}!A:Z`,
    valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  });
  return { appended: rows.length };
}

async function appendRowObject({ spreadsheetId, tab='Sheet1', rowObj }) {
  let header = await readHeader(spreadsheetId, tab);
  if (!header || !header.length) {
    header = Object.keys(rowObj);
    await setHeader(spreadsheetId, tab, header);
  }
  const row = rowObjectToArray(rowObj, header);
  const { appended } = await appendRows(spreadsheetId, tab, [row]);
  return { header, appended };
}

function colLetter(n){ let s=''; while(n>0){ n--; s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26);} return s; }

module.exports = { readHeader, setHeader, appendRows, appendRowObject };
