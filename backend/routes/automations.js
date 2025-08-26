// backend/routes/automations.js
const express = require('express');
const router = express.Router();

/* =======================================================
   Registry loading (external if exists, else fallback)
   ======================================================= */
let externalRegistry = null;
try {
  externalRegistry = require('../capabilities/registry'); // { registry, resolveAdapter }
} catch (_e) {
  // no-op: we'll use a local minimal registry below
}

/** --- Minimal inline adapters (fallback) ---
 * אם לא יצרת ../capabilities/registry והמתאמים,
 * נשתמש כאן במתאמים מינימליים כדי שהשרת יעלה
 * ותוכל לבדוק dry-run/execute מייד.
 */
const fallbackAdapters = {
  // Trigger: gmail.search
  'gmail.search': {
    async dryRun(_ctx, params = {}) {
      const q = params.q || 'in:anywhere -in:chats -in:drafts';
      return { q, items: [], checked: 0, note: 'fallback dry-run (no external registry)' };
    },
    async execute(ctx, params = {}) {
      const q = params.q || 'in:anywhere -in:chats -in:drafts';
      // אין גישה אמיתית ל-Gmail כאן. נחזיר דוגמאות.
      const items = [{
        id: 'demo-1',
        from: 'lead@example.com',
        subject: 'Lead: Example',
        date: new Date().toISOString(),
        ageHours: 6
      }];
      ctx.checked = (ctx.checked || 0) + items.length;
      return { q, items, checked: items.length, note: 'fallback execute (mock data)' };
    }
  },

  // Trigger: gmail.unreplied
  'gmail.unreplied': {
    async dryRun(_ctx, params = {}) {
      const { fromEmail, newerThanDays, dateAfter, hours = 4, limit = 50 } = params;
      const q =
        `in:anywhere from:${fromEmail || '*'} -in:chats -in:drafts` +
        (newerThanDays ? ` newer_than:${Number(newerThanDays)}d` : '') +
        (dateAfter ? ` after:${String(dateAfter).replace(/-/g, '/')}` : '');
      return { q, hours, items: [], checked: 0, matched: 0, note: 'fallback dry-run (no external registry)' };
    },
    async execute(ctx, params = {}) {
      const { fromEmail, newerThanDays, dateAfter, hours = 4, limit = 50 } = params;
      if (!fromEmail) throw new Error('fromEmail is required (fallback)');
      const q =
        `in:anywhere from:${fromEmail} -in:chats -in:drafts` +
        (newerThanDays ? ` newer_than:${Number(newerThanDays)}d` : '') +
        (dateAfter ? ` after:${String(dateAfter).replace(/-/g, '/')}` : '');
      // נחזיר 2 "הפרות" דמו
      const items = [
        {
          id: 'demo-u1',
          from: fromEmail,
          subject: 'Re: Support ticket #123',
          date: new Date(Date.now() - (hours + 2) * 3600 * 1000).toISOString(),
          ageHours: hours + 2
        },
        {
          id: 'demo-u2',
          from: fromEmail,
          subject: 'Re: SLA check',
          date: new Date(Date.now() - (hours + 5) * 3600 * 1000).toISOString(),
          ageHours: hours + 5
        }
      ];
      ctx.checked = (ctx.checked || 0) + items.length;
      ctx.matched = (ctx.matched || 0) + items.length;
      return { q, hours, items, checked: items.length, matched: items.length, note: 'fallback execute (mock data)' };
    }
  },

  // Action: sheets.append
  'sheets.append': {
    async dryRun(ctx, params = {}) {
      const { spreadsheetId, tab = 'Sheet1', columns = ['from', 'subject', 'date'] } = params;
      const preview = (ctx.items || []).slice(0, 3).map(i => columns.map(c => i[c] ?? ''));
      return {
        spreadsheetId,
        tab,
        columns,
        preview,
        appended: 0,
        note: 'fallback dry-run (no external registry)'
      };
    },
    async execute(ctx, params = {}) {
      const { spreadsheetId, tab = 'Sheet1', columns = ['from', 'subject', 'date'] } = params;
      if (!spreadsheetId) throw new Error('spreadsheetId is required (fallback)');
      const items = ctx.items || [];
      const rows = items.map(i => columns.map(c => i[c] ?? ''));
      // אין כתיבה אמיתית לשיטס כאן – נחזיר כמה היינו "מוסיפים"
      const appended = rows.length;
      return {
        spreadsheetId, tab, columns, appended,
        note: 'fallback execute (mock – no real Sheets write)'
      };
    }
  },

  // Action: whatsapp.send
  'whatsapp.send': {
    async dryRun(_ctx, params = {}) {
      const { to, template = 'sla_breach_basic' } = params;
      return { to, template, preview: true, note: 'fallback dry-run (no WhatsApp config)' };
    },
    async execute(_ctx, params = {}) {
      // אין אינטגרציית וואטסאפ אמיתית כאן
      const { to, template = 'sla_breach_basic' } = params;
      return { to, template, sent: false, note: 'fallback execute (no real WhatsApp provider configured)' };
    }
  },

  // Action: http.request (כללי)
  'http.request': {
    async dryRun(_ctx, params = {}) {
      const { url, method = 'POST', headers = {}, body = null } = params;
      return { url, method, headers, body, preview: true, note: 'fallback dry-run' };
    },
    async execute(_ctx, params = {}) {
      // כדי להריץ בפועל – צריך node-fetch וקונפיג; בפולבאק נחזיר Not Implemented
      return { ok: false, status: 501, note: 'fallback: http.request not implemented in inline registry' };
    }
  }
};

function resolveAdapter(type) {
  if (externalRegistry && typeof externalRegistry.resolveAdapter === 'function') {
    return externalRegistry.resolveAdapter(type);
  }
  return fallbackAdapters[type] || null;
}

/* =======================================================
   Helpers: legacy → pipeline
   ======================================================= */
function toPipeline(body) {
  // accept either {steps:[]} or {proposal:{steps:[]}}
  if (Array.isArray(body?.proposal?.steps)) return { steps: body.proposal.steps };
  if (Array.isArray(body?.steps)) return body; // already pipeline

  const { type, proposal = {} } = body || {};
  if (!type) return { steps: [] };

  // sla-simple → gmail.unreplied → sheets.append
  if (type === 'sla-simple') {
    const trig = {
      type: 'gmail.unreplied',
      params: {
        fromEmail: proposal.fromEmail,
        newerThanDays: proposal.newerThanDays ?? (proposal.dateAfter ? null : 30),
        dateAfter: proposal.dateAfter || null,
        hours: proposal.hours ?? 4,
        limit: proposal.limit ?? 100
      }
    };
    const act = {
      type: 'sheets.append',
      params: {
        spreadsheetId: proposal.spreadsheetId,
        tab: proposal.tab || 'SLA',
        columns: ['from', 'subject', 'date', 'ageHours']
      }
    };
    return { steps: [ { trigger: trig }, { action: act } ] };
  }

  // lead-intake → gmail.search → sheets.append
  if (type === 'lead-intake') {
    const trig = {
      type: 'gmail.search',
      params: {
        q: proposal.q || 'in:anywhere (subject:"ליד" OR subject:Lead) -in:chats',
        limit: proposal.limit ?? 30
      }
    };
    const act = {
      type: 'sheets.append',
      params: {
        spreadsheetId: proposal.spreadsheetId,
        tab: proposal.tab || 'Leads',
        columns: ['from', 'subject', 'date']
      }
    };
    return { steps: [ { trigger: trig }, { action: act } ] };
  }

  // whatsapp-notify → gmail.unreplied → whatsapp.send
  if (type === 'whatsapp-notify') {
    const trig = {
      type: 'gmail.unreplied',
      params: {
        fromEmail: proposal.fromEmail,
        newerThanDays: proposal.newerThanDays ?? 30,
        dateAfter: proposal.dateAfter || null,
        hours: proposal.hours ?? 4,
        limit: proposal.limit ?? 50
      }
    };
    const act = {
      type: 'whatsapp.send',
      params: {
        to: proposal.toPhone,
        template: proposal.template || 'sla_breach_basic'
      }
    };
    return { steps: [ { trigger: trig }, { action: act } ] };
  }

  // unknown
  return { steps: [] };
}

/* =======================================================
   Executor
   ======================================================= */
async function execPipeline(pipeline, { dryRun = false } = {}) {
  const results = [];
  let context = {}; // carry items/checked/matched/append count across steps

  for (const step of pipeline.steps) {
    const key = step.trigger ? 'trigger' : 'action';
    const unit = step[key];
    if (!unit || !unit.type) {
      results.push({ ok: false, error: `Missing ${key} or type` });
      continue;
    }

    const adapter = resolveAdapter(unit.type);
    if (!adapter) {
      results.push({ ok: false, type: unit.type, error: `Adapter not found for ${unit.type}` });
      continue;
    }

    const fn = (dryRun && typeof adapter.dryRun === 'function')
      ? adapter.dryRun
      : adapter.execute;

    if (typeof fn !== 'function') {
      results.push({ ok: false, type: unit.type, error: `Adapter has no ${dryRun ? 'dryRun' : 'execute'}()` });
      continue;
    }

    try {
      const out = await fn(context, unit.params || {});
      // normalize ok flag
      const ok = out && typeof out.ok === 'boolean' ? out.ok : true;
      results.push({ ok, type: unit.type, dryRun: !!dryRun, ...out });
      if (out && out.items) context.items = out.items;
      if (out && out.checked) context.checked = (context.checked || 0) + Number(out.checked);
      if (out && out.matched) context.matched = (context.matched || 0) + Number(out.matched);
      if (out && out.appended) context.appended = (context.appended || 0) + Number(out.appended);
    } catch (e) {
      results.push({ ok: false, type: unit.type, error: e.message || String(e) });
    }
  }

  const summary = {
    steps: results.length,
    ok: results.every(r => r.ok !== false),
    checked: context.checked || 0,
    matched: context.matched || 0,
    appended: context.appended || 0
  };
  return { summary, results };
}

/* =======================================================
   Routes
   ======================================================= */

// Health
router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'automations', time: new Date().toISOString() });
});

// Dry-run
// Body: { steps:[...]}  OR legacy {type, proposal}
router.post('/dry-run', async (req, res) => {
  try {
    const pipeline = toPipeline(req.body);
    if (!pipeline.steps.length) return res.json({ ok: false, error: 'empty pipeline' });
    const out = await execPipeline(pipeline, { dryRun: true });
    return res.json({ ok: true, mode: 'dry-run', ...out });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

// Execute
router.post('/execute', async (req, res) => {
  try {
    const pipeline = toPipeline(req.body);
    if (!pipeline.steps.length) return res.json({ ok: false, error: 'empty pipeline' });
    const out = await execPipeline(pipeline, { dryRun: false });
    return res.json({ ok: true, mode: 'execute', ...out });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

module.exports = router;
