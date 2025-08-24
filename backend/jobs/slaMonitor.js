// backend/jobs/slaMonitor.js
const { getGmailClient } = require('../lib/googleGmail');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/**
 * רעיון בסיס:
 * - חיפוש threads לפי שאילתה (SLA_QUERY)
 * - קיבוץ לפי threadId
 * - לכל thread: נמצא את הודעת ה-INBOUND האחרונה (לא מאתנו)
 *   ואם אין OUTBOUND מאיתנו אחרי זה בטווח SLA — זה הפרה.
 *
 * ENV:
 *  SLA_QUERY (ברירת מחדל: 'in:anywhere -in:chats (label:Support OR subject:Support)')
 *  SLA_HOURS (מספר, ברירת מחדל: 4)
 *  SLA_ONLY_UNREAD (true/false, ברירת מחדל: false)
 *  SLA_NOTIFY_SLACK (true/false, ברירת מחדל: true אם SLACK_WEBHOOK_URL מוגדר)
 *  MY_EMAIL (אופציונלי; אם לא קיים ננסה להביא מ-Gmail profile)
 */

function parseBool(v, d=false){
  if (v==null) return d;
  return String(v).toLowerCase() === 'true';
}

async function getMyEmail(gmail, req){
  // נסה מסשן
  const m = req?.session?.googleUser?.email || null;
  if (m) return m;
  try {
    const prof = await gmail.users.getProfile({ userId: 'me' });
    return prof?.data?.emailAddress || null;
  } catch {
    return null;
  }
}

function headerMap(msg){
  return Object.fromEntries((msg.payload?.headers||[]).map(h => [h.name.toLowerCase(), h.value]));
}
function decodeBody(partOrPayload){
  const b64 = partOrPayload?.body?.data;
  if (!b64) return '';
  try { return Buffer.from(b64, 'base64').toString('utf8'); } catch { return ''; }
}
function isFromUs(headers, myEmail){
  const from = headers['from'] || '';
  return myEmail && from.toLowerCase().includes(myEmail.toLowerCase());
}
function isInbound(headers, myEmail){
  return !isFromUs(headers, myEmail);
}

async function listMessages(gmail, q, maxResults = 100){
  const list = await gmail.users.messages.list({ userId:'me', q, maxResults });
  return list.data.messages || [];
}
async function getFullMessage(gmail, id){
  const g = await gmail.users.messages.get({ userId:'me', id, format:'full' });
  return g.data;
}

function groupByThread(messages){
  const map = new Map();
  for (const m of messages){
    const arr = map.get(m.threadId) || [];
    arr.push(m);
    map.set(m.threadId, arr);
  }
  return map;
}

function parseInternalDate(ms){
  const n = Number(ms);
  return isFinite(n) ? new Date(n) : null;
}

async function notifySlack(text){
  const url = process.env.SLACK_WEBHOOK_URL;
  const enabled = parseBool(process.env.SLA_NOTIFY_SLACK, !!url);
  if (!enabled || !url) return false;
  try {
    await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
    return true;
  } catch { return false; }
}

async function run(req, { dryRun = true, queryOverride = null, hoursOverride = null } = {}){
  const { gmail } = getGmailClient(req);
  const myEmail = process.env.MY_EMAIL || await getMyEmail(gmail, req) || null;

  const onlyUnread = parseBool(process.env.SLA_ONLY_UNREAD, false);
  const baseQuery = queryOverride || process.env.SLA_QUERY || 'in:anywhere -in:chats (label:Support OR subject:Support)';
  const q = onlyUnread ? `${baseQuery} is:unread` : baseQuery;

  const hours = Number(hoursOverride || process.env.SLA_HOURS || 4);
  const msThreshold = hours * 60 * 60 * 1000;

  // שלב 1: רשימת הודעות ids
  const ids = await listMessages(gmail, q, 100);
  if (ids.length === 0) {
    return { ok:true, dryRun, checkedThreads:0, breaches:0, sample:[], query:q, hours };
  }

  // שלב 2: הורדת הודעות מלאות
  const full = [];
  for (const { id } of ids){
    const m = await getFullMessage(gmail, id);
    full.push(m);
  }

  // שלב 3: קיבוץ לפי thread
  const byThread = groupByThread(full);

  const breaches = [];
  const now = Date.now();

  for (const [threadId, msgs] of byThread.entries()){
    // מיין לפי זמן
    msgs.sort((a,b)=> Number(a.internalDate)-Number(b.internalDate));

    // הודעה אחרונה נכנסת
    const lastInbound = [...msgs].reverse().find(m => isInbound(headerMap(m), myEmail));
    if (!lastInbound) continue;

    const lastInboundAt = parseInternalDate(lastInbound.internalDate);
    if (!lastInboundAt) continue;

    // האם קיימת OUTBOUND (מאיתנו) אחרי ה-INBOUND האחרון?
    const replied = msgs.some(m => {
      const h = headerMap(m);
      const t = parseInternalDate(m.internalDate);
      return t && lastInboundAt && t > lastInboundAt && isFromUs(h, myEmail);
    });

    if (replied) continue; // כבר ענינו

    // לא ענינו מאז ההודעה הנכנסת האחרונה — בדוק SLA
    const age = now - (lastInboundAt.getTime());
    if (age >= msThreshold){
      const h = headerMap(lastInbound);
      breaches.push({
        threadId,
        lastInboundAt: lastInboundAt.toISOString(),
        from: h['from'] || '',
        subject: h['subject'] || '',
        ageHours: Math.round(age / (60*60*1000)),
      });
    }
  }

  // שלב 4: התראה (אם לא dry-run)
  if (!dryRun && breaches.length){
    const lines = breaches.slice(0,10).map(b => `• [${b.ageHours}h] ${b.subject} — ${b.from}`).join('\n');
    await notifySlack(`⚠️ הפרות SLA (${breaches.length}) — חלון ${hours} שעות:\n${lines}`);
  }

  return {
    ok: true,
    dryRun,
    query: q,
    hours,
    checkedThreads: byThread.size,
    breaches: breaches.length,
    sample: breaches.slice(0,5),
  };
}

module.exports = { run };
