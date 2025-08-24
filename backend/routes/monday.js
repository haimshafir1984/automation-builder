// backend/routes/monday.js
const express = require('express');
const { run } = require('../jobs/mondayStuck');

const router = express.Router();

router.get('/dry-run', async (req, res) => {
  try {
    const out = await run(req, {
      dryRun: true,
      boardId: req.query.boardId || process.env.MONDAY_BOARD_ID,
      statusColumnId: req.query.statusColumnId || process.env.MONDAY_STATUS_COLUMN_ID,
      stuckStatuses: req.query.stuck ? String(req.query.stuck).split(',').map(s => s.trim()) : undefined,
      olderThanDays: req.query.days ? Number(req.query.days) : 3,
      tabOverride: req.query.tab || 'MondayStuck',
    });
    res.json(out);
  } catch (e) { res.status(400).json({ ok: false, error: e.message || String(e) }); }
});

router.post('/run', async (req, res) => {
  try {
    const out = await run(req, {
      dryRun: !!req.body?.dryRun === true,
      boardId: req.body?.boardId || process.env.MONDAY_BOARD_ID,
      statusColumnId: req.body?.statusColumnId || process.env.MONDAY_STATUS_COLUMN_ID,
      stuckStatuses: req.body?.stuckStatuses || undefined,
      olderThanDays: req.body?.olderThanDays || 3,
      spreadsheetIdOverride: req.body?.spreadsheetIdOverride || null,
      tabOverride: req.body?.tabOverride || 'MondayStuck',
    });
    res.json(out);
  } catch (e) { res.status(400).json({ ok: false, error: e.message || String(e) }); }
});

module.exports = router;
