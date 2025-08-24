// backend/jobs/invoiceTracker.js
const { getGmailClient } = require('../lib/googleGmail');
const {
  extractSpreadsheetId,
  getSheetsClientWithOAuth,
  ensureHeaderRowIfEmpty,
  appendRow,
} = require('../lib/sheetsHelper');

/**
 * options:
 *  - dryRun
 *  - dateAfter | newerThanDays
 *  - spreadsheetIdOverride
 *  - tabOverride (default 'Invoices')
 *  - vendors: string[] (optional domains or names to prefer)
 *  - minAmount: number (optional filter)
 *
 * מחפש חשבוניות לפי subject/body (invoice/חשבונית), מציג {date, from, subject, amount?}
 */
async function run(req, {
  dryRun = true,
  dateAfter = null,
  newerThanDays = 30,
  spreadsheetIdOverride = null,
  tabOverride = 'Invoices',
  vendors = null,
  minAmount = null,
  limit = 200,
} = {}) {
  const { gmail } = getGmailClient(req);

  let q = 'in:anywhere -in:chats (subject:invoice OR subject:"חשבונית" OR "חשבונית" OR invoice) has:attachment';
  if (dateAfter) q += ` after:${dateAfter}`;
  else if (newerThanDays && Number(newerThanDays) > 0) q += ` newer_than:${Number(newerThanDays)}d`;

  if (vendors && vendors.length) {
    const parts = vendors.map(v => `("${v}")`).join(' OR ');
    q += ` (${parts})`;
  }

  const list = await gmail.users.messages.list({
    userId: 'me',
    q,
    maxResults: Math.max(1, Math.min(500, Number(limit) || 200)),
  });
  const ids = list.data.messages || [];
  if (!ids.length) {
    return { ok: true, dryRun, query: q, checked: 0, appended: 0, items: [] };
  }

  const headerMap = (msg) => Object.fromEntries((msg.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
  const emailFromFromHeader = (from) => {
    if (!from) return '';
    const m = from.match(/<([^>]+)>/);
    if (m) return m[1];
    const token = (from.split(/\s+/).find(t => t.includes('@')) || '').replace(/[<>,"]/g, '').trim();
    return token || from;
  };

  // Try parse amount from snippet / text/plain
  function tryParseAmount(s='') {
    // ₪ 1,234.56 | $123.45 | 1,234 ₪ | 123.45 NIS
    const m = s.match(/(?:₪|\$|€)?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s?(?:₪|nis|\$|usd|eur)?/i);
    if (!m) return null;
    const raw = m[1].replace(/,/g, '');
    const val = Number(raw.replace(',', '.'));
    return Number.isFinite(val) ? val : null;
  }

  const items = [];
  for (const { id } of ids) {
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const h = headerMap(msg.data);
    const from = emailFromFromHeader(h['from'] || '');
    const subject = h['subject'] || '';
    const sentAt = new Date(Number(msg.data.internalDate || 0)).toISOString();

    let bodyText = msg.data.snippet || '';
    const parts = msg.data.payload?.parts || [];
    const textPart = parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      try {
        bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf8');
      } catch (_) {}
    }

    const amount = tryParseAmount(`${subject} ${bodyText}`);
    if (minAmount && amount != null && amount < Number(minAmount)) continue;

    items.push({ id, from, subject, sent_at: sentAt, amount });
  }

  // write to Sheets
  let appended = 0;
  if (!dryRun && items.length) {
    const spreadsheetIdRaw = spreadsheetIdOverride || process.env.INVOICES_SHEET_SPREADSHEET_ID || process.env.LEADS_SHEET_SPREADSHEET_ID;
    const spreadsheetId = extractSpreadsheetId(spreadsheetIdRaw);
    const tab = tabOverride || 'Invoices';
    if (!spreadsheetId) throw new Error('INVOICES_SHEET_SPREADSHEET_ID (or LEADS) is missing/invalid');

    const sheets = getSheetsClientWithOAuth(req);
    const header = ['sent_at', 'from', 'subject', 'amount'];
    await ensureHeaderRowIfEmpty(sheets, spreadsheetId, tab, header);

    for (const it of items) {
      await appendRow(sheets, spreadsheetId, tab, [it.sent_at, it.from, it.subject, (it.amount != null ? it.amount : '')]);
      appended++;
    }
  }

  return { ok: true, dryRun, query: q, checked: items.length, appended, items: items.slice(0, 20) };
}

module.exports = { run };
