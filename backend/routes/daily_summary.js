// backend/routes/daily_summary.js
const express = require('express');
const { run } = require('../jobs/dailySummary');

const router = express.Router();

/** Dry-run via GET (simple) */
router.get('/dry-run', async (req, res) => {
  try {
    const out = await run(req, {
      dryRun: true,
      dateAfter: req.query.after || null,
      newerThanDays: req.query.newerThan ? Number(req.query.newerThan) : 1, // דיפולט יום אחרון
      fromDomains: req.query.from ? String(req.query.from).split(',').map(s => s.trim()) : null,
      tabOverride: req.query.tab || 'Daily',
      topSubjects: req.query.top ? Number(req.query.top) : 5,
    });
    res.json(out);
  } catch (e) { res.status(400).json({ ok: false, error: e.message || String(e) }); }
});

/** Run via POST */
router.post('/run', async (req, res) => {
  try {
    const out = await run(req, {
      dryRun: !!req.body?.dryRun === true,
      dateAfter: req.body?.dateAfter || null,
      newerThanDays: req.body?.newerThanDays || null,
      fromDomains: req.body?.fromDomains || null,
      spreadsheetIdOverride: req.body?.spreadsheetIdOverride || null,
      tabOverride: req.body?.tabOverride || 'Daily',
      topSubjects: req.body?.topSubjects || 5,
      limit: req.body?.limit || 300,
    });
    res.json(out);
  } catch (e) { res.status(400).json({ ok: false, error: e.message || String(e) }); }
});

module.exports = router;
