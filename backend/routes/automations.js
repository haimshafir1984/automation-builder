// backend/routes/automations.js
const express = require('express');
const router = express.Router();
const registry = require('../capabilities/registry');

function normalizePipeline(body){
  if (body && Array.isArray(body.steps)) return { steps: body.steps };
  if (body && body.pipeline && Array.isArray(body.pipeline.steps)) return { steps: body.pipeline.steps };
  return { steps: [] };
}

async function runStep(step, mode, ctx){
  const unit = step.action || step.trigger || {};
  const type = unit.type;
  if (!type) return { ok:false, error:'missing type' };

  const adapter = registry[type];
  if (!adapter){
    const note = (mode === 'dryRun') ? 'no adapter found (dry-run)' : 'no adapter found';
    return { ok:false, type, note };
  }

  // תמיכה גם באובייקט (execute/dryRun) וגם בפונקציה
  let fn = null;
  if (typeof adapter === 'function') {
    fn = adapter; // נקרא ישירות
  } else {
    fn = adapter[mode] || adapter.execute || adapter.send || null;
  }
  if (!fn) return { ok:false, type, error:`adapter missing ${mode} handler` };

  const params = unit.params || {};
  try {
    const out = await fn(ctx, params);
    return { type, ...out };
  } catch(e){
    return { ok:false, type, error:String(e.message||e) };
  }
}

async function run(mode, req, res){
  const pipe = normalizePipeline(req.body || {});
  if (!pipe.steps.length) return res.json({ ok:false, error:'empty pipeline' });

  const ctx = {};
  const results = [];
  for (const step of pipe.steps){
    const r = await runStep(step, mode, ctx);
    results.push(r);
  }

  const sumSheets = results.find(r => r.type === 'sheets.append');
  const sumGmail  = results.find(r => r.type === 'gmail.unreplied');
  const summary = {
    steps: pipe.steps.length,
    ok: results.every(r => r.ok !== false),
    checked: sumGmail?.checked || 0,
    matched: sumGmail?.matched || 0,
    appended: sumSheets?.updated || sumSheets?.appended || 0,
  };
  return res.json({ ok:true, mode: mode === 'dryRun' ? 'dry-run' : 'execute', summary, results });
}

router.post('/dry-run',  (req,res) => run('dryRun',  req,res));
router.post('/execute',  (req,res) => run('execute', req,res));

module.exports = router;
