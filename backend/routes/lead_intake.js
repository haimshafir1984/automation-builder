// backend/routes/lead_intake.js
const express = require('express');
const { run } = require('../jobs/leadIntake');

const router = express.Router();

// תצוגה ללא כתיבה ל־Sheets
router.get('/dry-run', async (req, res) => {
  try {
    const out = await run(req, { dryRun: true });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

// ריצה אמיתית (כותב ל־Sheets + Slack/Monday אם הוגדרו)
router.post('/run', async (req, res) => {
  try {
    const out = await run(req, { dryRun: false });
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

// סטטוס בסיסי
router.get('/status', async (_req, res) => {
  res.json({ ok: true, hint: 'Use /dry-run to preview and /run (POST) to execute.' });
});

module.exports = router;
