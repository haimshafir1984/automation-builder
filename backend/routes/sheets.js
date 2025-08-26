const express = require('express');
const router = express.Router();
const gs = require('../lib/googleSheets');

router.get('/test-access', async (req, res) => {
  try {
    const { spreadsheetId, tab='Sheet1' } = req.query;
    if (!spreadsheetId) return res.json({ ok: false, error: 'spreadsheetId is required' });
    const header = await gs.readHeader(spreadsheetId, tab);
    return res.json({ ok: true, spreadsheetId, tab, header });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
});

router.post('/append-test', async (req, res) => {
  try {
    const { spreadsheetId, sheetName='Sheet1', row={} } = req.body || {};
    if (!spreadsheetId) return res.json({ ok: false, error: 'spreadsheetId is required' });
    const { header, appended } = await gs.appendRowObject({ spreadsheetId, tab: sheetName, rowObj: row });
    return res.json({ ok: true, spreadsheetId, sheetName, header, appended });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
});

module.exports = router;
