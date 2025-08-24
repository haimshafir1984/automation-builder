// backend/jobs/slaToSheet.js
const { getGmailClient } = require('../lib/googleGmail');
const {
  extractSpreadsheetId,
  getSheetsClientWithOAuth,
  ensureHeaderRowIfEmpty,
  appendRow,
} = require('../lib/sheetsHelper');

/**
 * options:
 *  - dryRun (bool)
 *  - fromEmail (string, required)
 *  - hours (number, required)
 *  - spreadsheetIdOverride (string)
 *  - tabOverride (string, default 'SLA')
 *  - limit (number, default 100)
 *  - dateAfter ('YYYY/MM/DD')   -> will add "after:" to Gmail query
 *  - newerThanDays (number)     -> will add "newer_than:Nd" to Gmail query
 *  - requireUnreplied (bool)    -> only include threads with NO reply from us after last inbound (default: true)
 *
 * What it does:
 *  1) Builds q: in:anywhere -in:chats from:<email> [+ after/newer_than]
 *  2) Fetches message IDs, groups by thread
 *  3) For each thread:
 *       - find last inbound from <fromEmail>
 *       - check if we replied after it (from:me / from our profile email)
 *       - if requireUnreplied=true and there IS reply -> skip
 *       - if age since last inbound >= hours -> include
 *  4) Writes to Sheets: [from, sent_at, subject]
 */
function parseBool(v, d=false){ if (v==null) return d; return String(v).toLowerCase()==='true'; }

function headerMap(msg){
  return Object.fromEntries((msg.payload?.headers||[]).map(h=>[h.name.toLowerCase(), h.value]));
}
function getEmailFromHeader(from){
  if (!from) return '';
  const m = from.match(/<([^>]+)>/); if (m) return m[1];
  const token = (from.split(/\s+/).find(t=>t.includes('@')) || '').replace(/[<>,"]/g,'').trim();
  return token || from;
}
function parseInternal(ms){ const n=Number(ms); return isFinite(n)? new Date(n): null; }

async function getMyEmail(gmail, req){
  const sess = req?.session?.googleUser?.email || null;
  if (sess) return sess;
  try{
    const prof = await gmail.users.getProfile({ userId:'me' });
    return prof?.data?.emailAddress || null;
  }catch{return null;}
}

async function run(req, {
  dryRun = true,
  fromEmail,
  hours,
  spreadsheetIdOverride = null,
  tabOverride = 'SLA',
  limit = 100,
  dateAfter = null,
  newerThanDays = null,
  requireUnreplied = true,
} = {}) {
  if (!fromEmail) throw new Error('missing fromEmail');
  const H = Number(hours); if (!H || H<=0) throw new Error('missing/invalid hours');

  const { gmail } = getGmailClient(req);
  const myEmail = await getMyEmail(gmail, req);

  // 1) query
  let q = `in:anywhere -in:chats from:${JSON.stringify(fromEmail).slice(1,-1)}`;
  if (dateAfter) q += ` after:${dateAfter}`;
  else if (newerThanDays && Number(newerThanDays)>0) q += ` newer_than:${Number(newerThanDays)}d`;

  const list = await gmail.users.messages.list({ userId:'me', q, maxResults: Math.max(1, Math.min(500, Number(limit)||100)) });
  const ids = list.data.messages || [];
  if (ids.length===0){
    return { ok:true, dryRun, fromEmail, hours:H, query:q, checkedThreads:0, matched:0, appended:0, sample:[] };
  }

  // 2) fetch threads (to detect replies)
  const byThread = new Map();
  for (const { id } of ids) {
    const msg = await gmail.users.messages.get({ userId:'me', id, format:'full' });
    const threadId = msg.data.threadId;
    if (!byThread.has(threadId)) {
      const thr = await gmail.users.threads.get({ userId:'me', id: threadId, format:'full' });
      byThread.set(threadId, thr.data.messages || []);
    }
  }

  const now = Date.now();
  const thresholdMs = H * 60 * 60 * 1000;
  const breaches = [];

  for (const [threadId, msgs] of byThread.entries()){
    // מיון לפי זמן
    msgs.sort((a,b)=> Number(a.internalDate)-Number(b.internalDate));

    // הודעת INBOUND אחרונה מאותו שולח
    const lastInbound = [...msgs].reverse().find(m => {
      const h = headerMap(m);
      const from = getEmailFromHeader(h['from']||'').toLowerCase();
      return from && from.includes(fromEmail.toLowerCase());
    });
    if (!lastInbound) continue;

    const lastInboundAt = parseInternal(lastInbound.internalDate);
    if (!lastInboundAt) continue;

    // האם יש OUTBOUND מאיתנו אחרי אותה INBOUND?
    const replied = msgs.some(m => {
      const t = parseInternal(m.internalDate);
      if (!t || t <= lastInboundAt) return false;
      const h = headerMap(m);
      const from = (h['from']||'').toLowerCase();
      const isUs = myEmail ? from.includes(myEmail.toLowerCase()) : /me|myself/i.test(from);
      return isUs;
    });

    if (requireUnreplied && replied) continue; // כבר ענינו — לא הפרה

    // גודל פער הזמן
    const age = now - lastInboundAt.getTime();
    if (age >= thresholdMs) {
      const h = headerMap(lastInbound);
      breaches.push({
        threadId,
        from: getEmailFromHeader(h['from']||''),
        subject: h['subject'] || '',
        sent_at: lastInboundAt.toISOString(),
        ageHours: Math.round(age/(60*60*1000)),
      });
    }
  }

  // 3) כתיבה ל־Sheets
  let appended = 0;
  if (!dryRun && breaches.length){
    const spreadsheetIdRaw = spreadsheetIdOverride || process.env.SLA_SHEET_SPREADSHEET_ID || process.env.LEADS_SHEET_SPREADSHEET_ID;
    const spreadsheetId = extractSpreadsheetId(spreadsheetIdRaw);
    const tab = tabOverride || process.env.SLA_SHEET_TAB || 'SLA';
    if (!spreadsheetId) throw new Error('SLA_SHEET_SPREADSHEET_ID (or LEADS_SHEET_SPREADSHEET_ID) is missing/invalid');

    const sheets = getSheetsClientWithOAuth(req);
    const header = ['from','sent_at','subject'];
    await ensureHeaderRowIfEmpty(sheets, spreadsheetId, tab, header);

    for (const b of breaches){
      await appendRow(sheets, spreadsheetId, tab, [b.from, b.sent_at, b.subject]);
      appended++;
    }
  }

  return {
    ok:true,
    dryRun,
    fromEmail,
    hours:H,
    query:q,
    checkedThreads: byThread.size,
    matched: breaches.length,
    appended,
    sample: breaches.slice(0,5),
  };
}

module.exports = { run };
