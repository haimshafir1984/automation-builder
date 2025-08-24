// backend/routes/invoices.js
const express = require('express');
const { run } = require('../jobs/invoiceTracker');

const router = express.Router();

// GET dry-run
router.get('/dry-run', async (req, res) => {
  try {
    const out = await run(req, {
      dryRun: true,
      dateAfter: req.query.after || null,
      newerThanDays: req.query.newerThan ? Number(req.query.newerThan) : 30,
      vendors: req.query.vendors ? String(req.query.vendors).split(',').map(s => s.trim()) : null,
      tabOverride: req.query.tab || 'Invoices',
      minAmount: req.query.min ? Number(req.query.min) : null,
    });
    res.json(out);
  } catch (e) { res.status(400).json({ ok: false, error: e.message || String(e) }); }
});

// POST run
router.post('/run', async (req, res) => {
  try {
    const out = await run(req, {
      dryRun: !!req.body?.dryRun === true,
      dateAfter: req.body?.dateAfter || null,
      newerThanDays: req.body?.newerThanDays || 30,
      vendors: req.body?.vendors || null,
      spreadsheetIdOverride: req.body?.spreadsheetIdOverride || null,
      tabOverride: req.body?.tabOverride || 'Invoices',
      minAmount: req.body?.minAmount || null,
      limit: req.body?.limit || 200,
    });
    res.json(out);
  } catch (e) { res.status(400).json({ ok: false, error: e.message || String(e) }); }
});

module.exports = router;
