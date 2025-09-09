const { sanitizeLog } = require('../utils/sanitize');

async function executeSteps(steps = []) {
  try {
    if (!Array.isArray(steps) || !steps.length) {
      return { ok: false, error: 'EMPTY_STEPS' };
    }

    for (const step of steps) {
      const { trigger, action } = step;

      // --- תיקוני gmail.sent אם יש ---
      if (trigger?.type === 'gmail.sent') {
        const p = trigger.params = trigger.params || {};
        if (typeof p.fromEmails === 'string') {
          p.fromEmails = p.fromEmails.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (!Array.isArray(p.fromEmails) || !p.fromEmails.length) {
          return {
            ok: false,
            error: 'MISSING_FIELDS',
            missing: [{ key: 'fromEmails', label: 'אימיילים', example: 'a@example.com,b@example.com' }]
          };
        }
      }

      // --- normalize sheets.append ---
      if (action?.type === 'sheets.append') {
        const p = action.params = action.params || {};

        // spreadsheet → spreadsheetId
        if (p.spreadsheet && !p.spreadsheetId) {
          p.spreadsheetId = p.spreadsheet;
          delete p.spreadsheet;
        }

        // spreadsheetId חובה
        if (!p.spreadsheetId) {
          return {
            ok: false,
            error: 'MISSING_FIELDS',
            missing: [{
              key: 'spreadsheetId',
              label: 'ה-ID של ה-Google Sheet',
              example: 'https://docs.google.com/spreadsheets/d/<ID>/edit'
            }]
          };
        }

        // sheetName ברירת מחדל, אם חסר
        if (!p.sheetName) {
          p.sheetName = 'Sheet1';
        }

        // row כאובייקט – ברירת מחדל “חכמה”
        if (!p.row || typeof p.row !== 'object' || Array.isArray(p.row)) {
          p.row = {
            from: "{{item.from}}",
            subject: "{{item.subject}}",
            date: "{{item.date}}",
            webLink: "{{item.webLink}}",
            threadId: "{{item.threadId}}",
            snippet: "{{item.snippet}}",
            to: "{{item.to}}",
            cc: "{{item.cc}}",
            labels: "{{item.labels}}"
          };
        }

        // TODO: כאן תממש בפועל: append ל-Google Sheets
        // await appendRowToSheet(p.spreadsheetId, p.sheetName, p.row)
      }

      // TODO: מממשים טריגרים/אקשנים נוספים לפי הצורך
      await new Promise(r => setTimeout(r, 20));
    }

    return { ok: true, message: 'executed' };
  } catch (err) {
    console.error('Execute error:', sanitizeLog(err?.message || String(err)));
    return { ok: false, error: 'EXECUTION_FAILED' };
  }
}

module.exports = { executeSteps };
