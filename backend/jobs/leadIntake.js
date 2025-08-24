// backend/jobs/leadIntake.js
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { getGmailClient } = require('../lib/googleGmail');
const {
  extractSpreadsheetId,
  getSheetsClientWithOAuth,
  ensureHeaderRowIfEmpty,
  appendRow,
} = require('../lib/sheetsHelper');

const STORE_PATH = path.resolve(__dirname, '..', 'data', 'lead_intake_state.json');

function loadState() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')); }
  catch { return { processedIds: [], lastRun: null, totalAppended: 0 }; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2));
}

// טלפונים IL גמיש
const PHONE_IL = new RegExp(
  String.raw`(?:\+972|0)\s*(?:-|\s)?\s*(?:[23489]\s*(?:-|\s)?\s*\d\s*(?:-|\s)?\s*\d{6}|5\s*(?:-|\s)?\s*\d\s*(?:-|\s)?\s*\d{7})`,
  'g'
);

function extractLeadFieldsFromText(text) {
  const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [null])[0];

  let phone = null;
  const phones = text.match(PHONE_IL);
  if (phones && phones.length) {
    phone = phones[0].replace(/[\s-]/g, '');
    if (phone.startsWith('+972')) phone = '0' + phone.slice(4);
  }

  let name = null;
  const byLabelHe = text.match(/(?:שם|לקוח|פונה)\s*[:\-]\s*(.+)/i);
  const byLabelEn = text.match(/(?:Name|Full\s*Name)\s*[:\-]\s*(.+)/i);
  const byLead = text.match(/(?:ליד|Lead)\s*[:\-]\s*([^\n\r]+)/i);

  if (byLabelHe) name = byLabelHe[1].trim().split(/\r?\n/)[0];
  else if (byLabelEn) name = byLabelEn[1].trim().split(/\r?\n/)[0];
  else if (byLead) name = byLead[1].trim();

  if (!name && email) {
    const before = text.split(email)[0].split(/\s+/).slice(-2).join(' ');
    name = before.replace(/[\<\>\(\),"]/g, '').trim() || null;
  }

  return { name, email, phone };
}

async function fetchMessages(req, query, maxResults = 20) {
  const { gmail } = getGmailClient(req);
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });
  const msgs = list.data.messages || [];
  if (msgs.length === 0) return [];

  const full = [];
  for (const m of msgs) {
    const g = await gmail.users.messages.get({
      userId: 'me',
      id: m.id,
      format: 'full',
    });
    full.push(g.data);
  }
  return full;
}

function messageToText(msg) {
  const headers = Object.fromEntries(
    (msg.payload.headers || []).map((h) => [h.name.toLowerCase(), h.value])
  );
  const subject = headers['subject'] || '';
  const snippet = msg.snippet || '';
  let body = '';
  const parts = msg.payload.parts || [];
  const plain = parts.find((p) => (p.mimeType || '').startsWith('text/plain'));
  if (plain && plain.body && plain.body.data) {
    body = Buffer.from(plain.body.data, 'base64').toString('utf8');
  } else if (msg.payload.body && msg.payload.body.data) {
    body = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
  }
  return `${subject}\n${snippet}\n${body}`;
}

async function postToSlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return true;
  } catch {
    return false;
  }
}

async function createMondayItem(name, email, phone) {
  const token = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;
  if (!token || !boardId) return false;
  const groupId = process.env.MONDAY_GROUP_ID || null;
  const mutation = `
    mutation($board:Int!, $item:String!, $group:String) {
      create_item(board_id:$board, group_id:$group, item_name:$item) { id }
    }
  `;
  const variables = {
    board: Number(boardId),
    item: name || email || phone || 'New Lead',
    group: groupId,
  };
  try {
    await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ query: mutation, variables }),
    });
    return true;
  } catch {
    return false;
  }
}

async function run(
  req,
  {
    dryRun = false,
    queryOverride = null,
    maxResults = 30,
    spreadsheetIdOverride = null,
    tabOverride = null,
  } = {}
) {
  const state = loadState();
  const query =
    queryOverride ||
    process.env.LEADS_GMAIL_QUERY ||
    'in:anywhere (subject:"ליד" OR subject:Lead) -in:chats';

  const spreadsheetIdRaw =
    spreadsheetIdOverride || process.env.LEADS_SHEET_SPREADSHEET_ID;
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdRaw);
  const tab = tabOverride || process.env.LEADS_SHEET_TAB || 'Leads';

  if (!spreadsheetId) {
    throw new Error('LEADS_SHEET_SPREADSHEET_ID is missing/invalid in .env');
  }

  const messages = await fetchMessages(req, query, maxResults);
  const toProcess = messages.filter((m) => !state.processedIds.includes(m.id));

  const sheets = getSheetsClientWithOAuth(req);
  const header = [
    'created_at',
    'source',
    'name',
    'email',
    'phone',
    'gmail_id',
    'subject',
  ];
  if (!dryRun) await ensureHeaderRowIfEmpty(sheets, spreadsheetId, tab, header);

  let appended = 0;
  const results = [];

  for (const msg of toProcess) {
    const headers = Object.fromEntries(
      (msg.payload.headers || []).map((h) => [h.name.toLowerCase(), h.value])
    );
    const subject = headers['subject'] || '';
    const text = messageToText(msg);
    const { name, email, phone } = extractLeadFieldsFromText(text);

    results.push({ id: msg.id, subject, name, email, phone });

    if (!dryRun) {
      const row = [
        new Date().toISOString(),
        'gmail',
        name || '',
        email || '',
        phone || '',
        msg.id,
        subject,
      ];
      await appendRow(sheets, spreadsheetId, tab, row);
      appended++;

      await postToSlack(
        `Lead captured: ${name || '(no name)'} ${email || ''} ${phone || ''} | Subject: ${subject}`
      );
      await createMondayItem(name, email, phone);
    }

    state.processedIds.push(msg.id);
  }

  if (!dryRun) {
    state.totalAppended += appended;
    state.lastRun = new Date().toISOString();
    saveState(state);
  }

  return {
    query,
    dryRun,
    checked: messages.length,
    newItems: toProcess.length,
    appended,
    sample: results.slice(0, 5),
  };
}

module.exports = { run };
