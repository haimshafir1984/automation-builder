// backend/jobs/dailySummary.js
const { getGmailClient } = require('../lib/googleGmail');
const {
  extractSpreadsheetId,
  getSheetsClientWithOAuth,
  ensureHeaderRowIfEmpty,
  appendRow,
} = require('../lib/sheetsHelper');

/**
 * options:
 *  - dryRun: boolean
 *  - dateAfter: 'YYYY/MM/DD' | null
 *  - newerThanDays: number | null
 *  - fromDomains: string[] (optional)
 *  - spreadsheetIdOverride: string | null
 *  - tabOverride: string (default 'Daily')
 *  - topSubjects: number (default 5)
 *
 * עושה תקציר ליום/טווח: #כולל, #UNREAD, #ללא מענה, #שולחים שונים, TOP נושאים
 * אם לא dryRun → כותב שורה ל-Google Sheets.
 */
async function run(req, {
  dryRun = true,
  dateAfter = null,
  newerThanDays = null,
  fromDomains = null,
  spreadsheetIdOverride = null,
  tabOverride = 'Daily',
  topSubjects = 5,
  limit = 300,
} = {}) {
  const { gmail } = getGmailClient(req);

  // 1) Build query
  let q = 'in:anywhere -in:chats';
  if (dateAfter) q += ` after:${dateAfter}`;
  else if (newerThanDays && Number(newerThanDays) > 0) q += ` newer_than:${Number(newerThanDays)}d`;
  if (fromDomains && Array.isArray(fromDomains) && fromDomains.length) {
    const parts = fromDomains.map(d => `from:${d}`);
    q += ` (${parts.join(' OR ')})`;
  }

  // 2) List messages
  const list = await gmail.users.messages.list({
    userId: 'me',
    q,
    maxResults: Math.max(1, Math.min(500, Number(limit) || 300)),
  });
  const ids = list.data.messages || [];
  if (ids.length === 0) {
    return {
      ok: true, dryRun, query: q,
      summary: { total: 0, unread: 0, unrepliedThreads: 0, uniqueSenders: 0, topSubjects: [] },
      appended: 0, sample: []
    };
  }

  // helpers
  const headerMap = (msg) => Object.fromEntries((msg.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
  const emailFromFromHeader = (from) => {
    if (!from) return '';
    const m = from.match(/<([^>]+)>/);
    if (m) return m[1];
    const token = (from.split(/\s+/).find(t => t.includes('@')) || '').replace(/[<>,"]/g, '').trim();
    return token || from;
  };
  const normalizeSubject = (s='') => s.replace(/^\s*(re|fw|fwd)\s*:\s*/i, '').trim();

  // 3) Fetch full threads to detect "unreplied"
  const myProf = await gmail.users.getProfile({ userId: 'me' });
  const myEmail = myProf?.data?.emailAddress?.toLowerCase() || null;

  const byThread = new Map();
  for (const { id } of ids) {
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const threadId = msg.data.threadId;
    if (!byThread.has(threadId)) {
      const thr = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
      byThread.set(threadId, thr.data.messages || []);
    }
  }

  let total = 0;
  let unread = 0;
  let unrepliedThreads = 0;
  const senders = new Set();
  const subjMap = new Map();
  const sample = [];

  for (const [threadId, msgs] of byThread.entries()) {
    msgs.sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
    total += msgs.length;

    // unread? (אם אחת ההודעות האחרות בשרשור נושאת UNREAD)
    if (msgs.some(m => (m.labelIds || []).includes('UNREAD'))) unread++;

    // last inbound (not from me)
    const lastInbound = [...msgs].reverse().find(m => {
      const h = headerMap(m);
      const from = (emailFromFromHeader(h['from'] || '') || '').toLowerCase();
      return myEmail ? !from.includes(myEmail) : true;
    });

    // replied?
    const replied = msgs.some(m => {
      const h = headerMap(m);
      const from = (emailFromFromHeader(h['from'] || '') || '').toLowerCase();
      const t = Number(m.internalDate);
      return (myEmail && from.includes(myEmail)) && lastInbound && t > Number(lastInbound.internalDate);
    });
    if (!replied) unrepliedThreads++;

    // senders set + subjects
    for (const m of msgs) {
      const h = headerMap(m);
      const from = emailFromFromHeader(h['from'] || '');
      const subj = normalizeSubject(h['subject'] || '');
      if (from) senders.add(from.toLowerCase());
      if (subj) subjMap.set(subj, (subjMap.get(subj) || 0) + 1);
    }

    if (sample.length < 5 && lastInbound) {
      const h = headerMap(lastInbound);
      sample.push({
        threadId,
        from: emailFromFromHeader(h['from'] || ''),
        subject: h['subject'] || '',
        last_inbound_at: new Date(Number(lastInbound.internalDate)).toISOString()
      });
    }
  }

  const uniqueSenders = senders.size;
  const top = [...subjMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, topSubjects).map(([s, n]) => `${s} (${n})`);

  // 4) Append to Sheets
  let appended = 0;
  if (!dryRun) {
    const spreadsheetIdRaw = spreadsheetIdOverride || process.env.DAILY_SHEET_SPREADSHEET_ID || process.env.SLA_SHEET_SPREADSHEET_ID || process.env.LEADS_SHEET_SPREADSHEET_ID;
    const spreadsheetId = extractSpreadsheetId(spreadsheetIdRaw);
    const tab = tabOverride || 'Daily';
    if (!spreadsheetId) throw new Error('DAILY_SHEET_SPREADSHEET_ID (or SLA/LEADS) is missing/invalid');
    const sheets = getSheetsClientWithOAuth(req);
    const header = ['date', 'query', 'total', 'unread', 'unreplied_threads', 'unique_senders', 'top_subjects'];
    await ensureHeaderRowIfEmpty(sheets, spreadsheetId, tab, header);
    const row = [
      new Date().toISOString(),
      q,
      total,
      unread,
      unrepliedThreads,
      uniqueSenders,
      top.join(' | ')
    ];
    await appendRow(sheets, spreadsheetId, tab, row);
    appended = 1;
  }

  return {
    ok: true,
    dryRun,
    query: q,
    summary: { total, unread, unrepliedThreads, uniqueSenders, topSubjects: top },
    appended,
    sample
  };
}

module.exports = { run };
