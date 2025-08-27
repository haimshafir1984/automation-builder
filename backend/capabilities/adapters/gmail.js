// backend/capabilities/adapters/gmail.js
const { getGmailClient } = require('../../lib/googleAuth');

function getHeader(msg, name) {
  const h = msg.payload?.headers || [];
  const row = h.find(x => x.name?.toLowerCase() === name.toLowerCase());
  return row ? row.value : '';
}
function parseDateMs(msg) {
  // Gmail נותן internalDate (ms)
  const d = Number(msg.internalDate || msg.internalDateMs || 0);
  if (d) return d;
  const hv = getHeader(msg, 'Date');
  const t = hv ? Date.parse(hv) : 0;
  return isNaN(t) ? 0 : t;
}
function ageHoursSince(ms) {
  return Math.max(0, (Date.now() - ms) / 36e5);
}

async function listByQuery(gmail, userId, q, maxResults=50) {
  const out = [];
  let pageToken;
  while (out.length < maxResults) {
    const { data } = await gmail.users.messages.list({
      userId, q, maxResults: Math.min(100, maxResults - out.length), pageToken
    });
    (data.messages || []).forEach(m => out.push(m));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

async function fetchThread(gmail, userId, threadId) {
  const { data } = await gmail.users.threads.get({
    userId, id: threadId, format: 'full'
  });
  return data;
}

function extractFromAddress(str) {
  // "Name <addr@domain>" -> addr@domain
  const m = String(str||'').match(/<([^>]+)>/);
  return m ? m[1] : (str || '');
}

async function unrepliedCore(params) {
  const { gmail, me } = await getGmailClient();
  const { fromEmail=null, newerThanDays=30, hours=4, limit=50 } = params || {};
  // בונים שאילתא
  let q = `in:inbox -in:chats newer_than:${Number(newerThanDays)}d`;
  if (fromEmail) q += ` from:${fromEmail}`;
  q += ' -from:me'; // נרצה הודעות שהגיעו ממישהו אחר

  const msgs = await listByQuery(gmail, 'me', q, limit);
  const items = [];

  for (const m of msgs) {
    // קבל את thread והודעותיו
    const th = await fetchThread(gmail, 'me', m.threadId);
    const messages = th.messages || [];

    // מצא הודעות "ממני"
    const myMsg = messages.find(mm => {
      const from = extractFromAddress(getHeader(mm, 'From'));
      return from.toLowerCase() === me.toLowerCase();
    });

    if (myMsg) {
      // יש כבר reply ממני — דלג
      continue;
    }

    // קח את ההודעה האחרונה מהשולח (לא ממני)
    const lastOther = messages.reduce((acc, mm) => {
      const from = extractFromAddress(getHeader(mm, 'From'));
      if (from.toLowerCase() === me.toLowerCase()) return acc;
      const t = parseDateMs(mm);
      if (!acc || t > acc._t) acc = { _t: t, msg: mm };
      return acc;
    }, null);

    if (!lastOther) continue;

    const ageH = ageHoursSince(lastOther._t);
    if (ageH < Number(hours)) continue;

    const subj = getHeader(lastOther.msg, 'Subject') || '(no subject)';
    const from = extractFromAddress(getHeader(lastOther.msg, 'From'));
    items.push({
      id: m.id,
      threadId: m.threadId,
      from,
      subject: subj,
      date: new Date(lastOther._t).toISOString(),
      ageHours: Math.round(ageH * 10) / 10
    });
  }

  return { me, items };
}

module.exports = {
  search: {
    async dryRun(ctx, params={}) {
      return { ok: true, dryRun: true, note: 'gmail.search not implemented in this build' };
    },
    async execute(ctx, params={}) {
      return { ok: true, note: 'gmail.search noop' };
    }
  },
  unreplied: {
    async dryRun(ctx, params={}) {
      try {
        const { items, me } = await unrepliedCore(params);
        // חשוב: שים את ה-items בהקשר, כדי שה-automation יוכל למפות ל-{{item.*}}
        ctx.items = items;
        return { ok: true, dryRun: true, items: items.length, sample: items.slice(0, 3), me };
      } catch (e) {
        return { ok: false, dryRun: true, error: String(e.message || e) };
      }
    },
    async execute(ctx, params={}) {
      try {
        const { items, me } = await unrepliedCore(params);
        ctx.items = items;
        return { ok: true, items: items.length, me };
      } catch (e) {
        return { ok: false, error: String(e.message || e) };
      }
    }
  }
};
