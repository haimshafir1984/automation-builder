// backend/routes/automations.js
const express = require('express');
const router = express.Router();

function normalizeSteps(body) {
  if (Array.isArray(body?.steps)) return body.steps;
  if (Array.isArray(body?.proposal?.steps)) return body.proposal.steps;
  return null;
}

// טען registry אמיתי
let registry = null;
try {
  registry = require('../capabilities/registry');
  console.log('[automations] loaded real registry');
} catch (e) {
  console.warn('[automations] registry load failed:', e.message);
  registry = null;
}

function getActionFn(type, mode) {
  const [cat, name] = String(type || '').split('.');
  if (!registry || !registry[cat] || !registry[cat][name]) return null;
  return registry[cat][name][mode || 'execute'];
}

router.post('/dry-run', async (req, res) => {
  const steps = normalizeSteps(req.body);
  if (!steps) return res.json({ ok: false, error: 'empty pipeline' });
  const ctx = {}; const results = []; let appended=0, checked=0, matched=0;
  for (const step of steps) {
    if (step.action) {
      const fn = getActionFn(step.action.type, 'dryRun');
      if (!fn) { results.push({ ok:false, type: step.action.type, note: 'no adapter found (dry-run)' }); continue; }
      const r = await fn(ctx, step.action.params || {});
      results.push({ ok: true, type: step.action.type, dryRun: true, ...r });
    } else if (step.trigger) {
      results.push({ ok: true, type: step.trigger.type, dryRun: true, items: 0 });
    }
  }
  return res.json({ ok: true, mode: 'dry-run', summary: { steps: steps.length, ok: true, checked, matched, appended }, results });
});

router.post('/execute', async (req, res) => {
  const steps = normalizeSteps(req.body);
  if (!steps) return res.json({ ok: false, error: 'empty pipeline' });
  const ctx = {}; const results = []; let appended=0, checked=0, matched=0;

  for (const step of steps) {
    if (step.trigger) {
      ctx.items = [];
      results.push({ ok: true, type: step.trigger.type, items: ctx.items.length });
      continue;
    }
    if (step.action) {
      const fn = getActionFn(step.action.type, 'execute');
      if (!fn) { results.push({ ok:false, type: step.action.type, note: 'no adapter found' }); continue; }
      try {
        const r = await fn(ctx, step.action.params || {});
        if (typeof r.appended === 'number') appended += r.appended;
        results.push({ ok: true, type: step.action.type, dryRun: false, ...r });
      } catch (e) {
        results.push({ ok: false, type: step.action.type, error: e.message });
      }
    }
  }
  return res.json({ ok: true, mode: 'execute', summary: { steps: steps.length, ok: true, checked, matched, appended }, results });
});

module.exports = router;
