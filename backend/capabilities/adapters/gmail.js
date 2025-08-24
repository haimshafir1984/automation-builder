// backend/capabilities/adapters/gmail.js
/**
 * Gmail adapters: search & unreplied
 * נדרש חיבור OAuth לגוגל (כפי שכבר בנוי אצלך), ו-helperים קיימים.
 */
const googleGmail = require('../../lib/googleGmail'); // קיימים אצלך בפרויקט
const { parseISO } = require('date-fns');

function daysToQuery(newerThanDays){
  if (!newerThanDays) return '';
  return ` newer_than:${Number(newerThanDays)}d`;
}
function buildDateAfterQuery(dateAfter){
  if (!dateAfter) return '';
  // Gmail doesn't support exact date filters via API, but we can approximate with after:YYYY/MM/DD
  return ` after:${dateAfter.replace(/-/g,'/')}`;
}
function ageHoursSince(epochMs) {
  const ms = Date.now() - Number(epochMs);
  return Math.floor(ms / 1000 / 3600);
}

module.exports = {
  /** Trigger: gmail.search */
  search: {
    async dryRun(_ctx, params={}){
      const q = params.q || 'in:anywhere -in:chats -in:drafts';
      return { q, items: [], checked: 0 };
    },
    async execute(ctx, params={}){
      const q = params.q || 'in:anywhere -in:chats -in:drafts';
      const limit = params.limit || 30;
      const list = await googleGmail.searchMessages({ q, maxResults: limit }); // helper שלך
      const items = (list || []).map(m => ({
        id: m.id,
        threadId: m.threadId,
        subject: m.subject,
        from: m.from,
        date: m.date,
        ageHours: m.internalDate ? ageHoursSince(m.internalDate) : null
      }));
      ctx.checked = (ctx.checked||0) + items.length;
      return { q, items, checked: items.length };
    }
  },

  /** Trigger: gmail.unreplied
   * fromEmail, newerThanDays|dateAfter, hours, limit
   */
  unreplied: {
    async dryRun(_ctx, params={}){
      const { fromEmail, newerThanDays, dateAfter, hours=4, limit=50 } = params;
      const q =
        `in:anywhere from:${fromEmail || '*'} -in:chats -in:drafts` +
        (newerThanDays ? daysToQuery(newerThanDays) : '') +
        (dateAfter ? buildDateAfterQuery(dateAfter) : '');
      return { q, hours, items: [], checked: 0, matched: 0 };
    },
    async execute(ctx, params={}){
      const { fromEmail, newerThanDays, dateAfter, hours=4, limit=50 } = params;
      if (!fromEmail) throw new Error('fromEmail is required');

      const q =
        `in:anywhere from:${fromEmail} -in:chats -in:drafts` +
        (newerThanDays ? daysToQuery(newerThanDays) : '') +
        (dateAfter ? buildDateAfterQuery(dateAfter) : '');

      const list = await googleGmail.searchMessages({ q, maxResults: limit });
      const now = Date.now();
      const items = [];
      for (const m of (list || [])) {
        const ageH = m.internalDate ? Math.floor((now - Number(m.internalDate)) / 3600000) : null;
        // Heuristic "unreplied": message is older than X hours and not from me
        // (אפשר לשפר בהמשך ע"י בדיקת thread replies מלאות)
        const fromMe = m.from && /<.*?>/.test(m.from) && /me|my|reply/i.test(m.from) ? true : false;
        if ((ageH==null || ageH >= Number(hours)) && !fromMe) {
          items.push({
            id: m.id,
            threadId: m.threadId,
            subject: m.subject,
            from: m.from,
            date: m.date,
            ageHours: ageH
          });
        }
      }
      ctx.checked = (ctx.checked||0) + (list?.length || 0);
      ctx.matched = (ctx.matched||0) + items.length;
      return { q, hours, items, checked: list?.length || 0, matched: items.length };
    }
  }
};
