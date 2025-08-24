// backend/routes/sla.js
const express = require('express');
const { run } = require('../jobs/slaMonitor');

const router = express.Router();

// GET /api/sla/dry-run?q=...&hours=...
router.get('/dry-run', async (req, res) => {
  try {
    const q = req.query.q || null;
    const hours = req.query.hours ? Number(req.query.hours) : null;
    const out = await run(req, { dryRun: true, queryOverride: q, hoursOverride: hours });
    res.json(out);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

// POST /api/sla/run { q?: string, hours?: number }
router.post('/run', async (req, res) => {
  try {
    const q = req.body?.q || null;
    const hours = req.body?.hours ? Number(req.body.hours) : null;
    const out = await run(req, { dryRun: false, queryOverride: q, hoursOverride: hours });
    res.json(out);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

module.exports = router;
