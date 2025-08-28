const express = require('express');
const router = express.Router();
const Mustache = require('mustache');
const registry = require('../capabilities/registry');

function normalizePipeline(body){
  if (body && Array.isArray(body.steps)) return { steps: body.steps };
  if (body && body.pipeline && Array.isArray(body.pipeline.steps)) return { steps: body.pipeline.steps };
  return { steps: [] };
}

function renderDeep(val, scope){
  if (val == null) return val;
  if (typeof val === 'string') {
    try { return Mustache.render(val, scope || {}); } catch { return val; }
  }
  if (Array.isArray(val)) return val.map(v => renderDeep(v, scope));
  if (typeof val === 'object') {
    const out = {};
    for (const [k,v] of Object.entries(val)) out[k] = renderDeep(v, scope);
    return out;
  }
  return val;
}

async function callAdapter(adapter, mode, ctx, params){
  let fn = null;
  if (typeof adapter === 'function') fn = adapter;
  else fn = adapter[mode] || adapter.execute || adapter.send || null;
  if (!fn) throw new Error(`adapter missing ${mode} handler`);
  return fn(ctx, params);
}

async function run(mode, req, res){
  const pipe = normalizePipeline(req.body || {});
  if (!pipe.steps.length) return res.json({ ok:false, error:'empty pipeline' });

  const results = [];
  let items = null;

  for (const step of pipe.steps){
    const unit = step.action || step.trigger || {};
    const type = unit.type;
    const params = unit.params || {};
    const adapter = registry[type];

    if (!type || !adapter){
      results.push({ ok:false, type: type || '(missing type)', note: 'no adapter found' });
      continue;
    }

    if (step.trigger){
      try {
        const out = await callAdapter(adapter, mode === 'dryRun' ? 'dryRun' : 'execute', { items: null }, params);
        results.push({ type, ...out });
        items = Array.isArray(out.items) ? out.items : null;
      } catch (e) {
        results.push({ ok:false, type, error: String(e.message||e) });
      }
      continue;
    }

    if (step.action){
      if (Array.isArray(items) && items.length){
        let okCount = 0, appended = 0;
        const sids = [];
        for (const it of items){
          const scope  = { item: it, params };
          const pRR    = renderDeep(params, scope);
          try {
            const out = await callAdapter(adapter, mode === 'dryRun' ? 'dryRun' : 'execute', { item: it }, pRR);
            if (out && out.ok !== false) okCount++;
            if (out && (out.appended || out.updated)) appended += (out.appended || out.updated || 0);
            if (out && out.sid) sids.push(out.sid);
          } catch (e) { /* ממשיכים לפריט הבא */ }
        }
        results.push({ ok: okCount === items.length, type, processed: items.length, succeeded: okCount, appended, sids: sids.length ? sids : undefined });
      } else {
        const pRR = renderDeep(params, { item:{}, params });
        try {
          const out = await callAdapter(adapter, mode === 'dryRun' ? 'dryRun' : 'execute', {}, pRR);
          results.push({ type, ...out });
        } catch (e) {
          results.push({ ok:false, type, error: String(e.message||e) });
        }
      }
    }
  }

  const checked  = results.filter(r => r.type === 'gmail.unreplied' && r.checked).reduce((a,b)=>a+b.checked, 0);
  const matched  = results.filter(r => r.type === 'gmail.unreplied' && r.matched).reduce((a,b)=>a+b.matched, 0);
  const appended = results.filter(r => r.type === 'sheets.append' && (r.appended || r.updated)).reduce((a,b)=>a+(b.appended||b.updated||0), 0);
  const okAll    = results.every(r => r.ok !== false);

  return res.json({ ok:true, mode: mode === 'dryRun' ? 'dry-run' : 'execute', summary: { steps: pipe.steps.length, ok: okAll, checked, matched, appended }, results });
}

router.post('/dry-run',  (req,res) => run('dryRun',  req,res));
router.post('/execute',  (req,res) => run('execute', req,res));

module.exports = router;
