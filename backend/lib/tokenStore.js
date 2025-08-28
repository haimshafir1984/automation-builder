// backend/lib/tokenStore.js
// Generic token store: redis (default, via Upstash REST), sheets, or file.

const STORE = (process.env.TOKEN_STORE || 'redis').toLowerCase();

// ---- Redis (Upstash REST) ----
// ENV needed:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
async function redisStore() {
  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !tok) throw new Error('Upstash Redis not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)');

  async function cmd(arr) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(arr)
    });
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
    return res.json();
  }
  async function get(key) {
    const r = await cmd(['GET', key]);
    return r && typeof r.result === 'string' ? r.result : null;
  }
  async function set(key, value) {
    await cmd(['SET', key, value]);
    return true;
  }
  async function del(key) {
    await cmd(['DEL', key]);
    return true;
  }
  return { get, set, del, kind: 'redis' };
}

// ---- Sheets (optional legacy) ----
async function sheetsStore() {
  const { google } = require('googleapis');
  const SHEET_ID  = process.env.TOKEN_SHEET_ID || process.env.DEFAULT_SPREADSHEET_ID || '';
  const SHEET_TAB = process.env.TOKEN_SHEET_TAB || 'CONFIG';
  if (!SHEET_ID) throw new Error('TOKEN_SHEET_ID/DEFAULT_SPREADSHEET_ID is required for sheets token store');

  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  async function ensureHeader() {
    try {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A1:B1` });
      if (!r.data.values || !r.data.values.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A1:B1`,
          valueInputOption: 'RAW', requestBody: { values: [['key','value']] }
        });
      }
    } catch {}
  }
  async function get(key) {
    await ensureHeader();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A:B` });
    const rows = r.data.values || [];
    for (let i=1; i<rows.length; i++){
      if ((rows[i][0]||'') === key) return (rows[i][1]||'');
    }
    return null;
  }
  async function set(key, value) {
    await ensureHeader();
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A:B` });
    const rows = r.data.values || [['key','value']];
    let found = false;
    for (let i=1; i<rows.length; i++){
      if ((rows[i][0]||'') === key) { rows[i][1] = value; found = true; break; }
    }
    if (!found) rows.push([key, value]);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A1:B${rows.length}`,
      valueInputOption: 'RAW', requestBody: { values: rows }
    });
    return true;
  }
  async function del(key) {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A:B` });
    const rows = r.data.values || [['key','value']];
    const filtered = [rows[0]].concat(rows.slice(1).filter(r => (r[0]||'') !== key));
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A1:B${filtered.length}`,
      valueInputOption: 'RAW', requestBody: { values: filtered }
    });
    return true;
  }
  return { get, set, del, kind: 'sheets' };
}

// ---- File (dev only) ----
async function fileStore() {
  const fs = require('fs');
  const path = require('path');
  const FILE_PATH = process.env.TOKEN_FILE_PATH || './data/tokens.json';
  const p = path.resolve(FILE_PATH);
  function readAll(){ try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } }
  function writeAll(obj){ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8'); }
  async function get(key){ return readAll()[key] || null; }
  async function set(key, value){ const all = readAll(); all[key]=value; writeAll(all); return true; }
  async function del(key){ const all = readAll(); delete all[key]; writeAll(all); return true; }
  return { get, set, del, kind: 'file', path: p };
}

async function getStore() {
  if (STORE === 'redis')  return redisStore();
  if (STORE === 'sheets') return sheetsStore();
  if (STORE === 'file')   return fileStore();
  // default fallback
  return redisStore();
}

module.exports = {
  async get(key){ return (await getStore()).get(key); },
  async set(key,val){ return (await getStore()).set(key,val); },
  async del(key){ return (await getStore()).del(key); },
  async kind(){ return (await getStore()).kind; },
};
