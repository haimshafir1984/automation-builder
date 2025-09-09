const express = require('express');
const { body } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validation');
const { NLPService } = require('../services/nlp');

const router = express.Router();

router.post('/from-text',
  validate([ body('text').isString().trim().isLength({ min: 2 }).withMessage('טקסט קצר מדי') ]),
  asyncHandler(async (req, res) => {
    const nlp = new NLPService(process.env.GROQ_API_KEY, process.env.GROQ_MODEL || 'llama3.1-8b-instant');
    const result = await nlp.planFromText(req.body.text || '');
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error, details: result.details });
    }

    // --- Normalize proposal strictly ---
    const proposal = (result.proposal || []).map(step => normalizeStep(step));

    // --- Build friendly missing list ---
    let missing = [];

    const needsFromEmail = proposal.some(s => s.trigger?.type === 'gmail.unreplied' && !s.trigger.params?.fromEmail);
    if (needsFromEmail) {
      missing.push({ key: 'fromEmail', label: 'כתובת המייל של השולח', example: 'name@example.com' });
    }

    const needsSpreadsheetId = proposal.some(s => s.action?.type === 'sheets.append' && !s.action.params?.spreadsheetId);
    if (needsSpreadsheetId) {
      missing.push({
        key: 'spreadsheetId',
        label: 'ה-ID של ה-Google Sheet',
        example: 'https://docs.google.com/spreadsheets/d/<ID>/edit'
      });
    }

    const needsSheetName = proposal.some(s => s.action?.type === 'sheets.append' && !s.action.params?.sheetName);
    if (needsSheetName) {
      missing.push({ key: 'sheetName', label: 'שם הלשונית (Sheet) בגיליון', example: 'InboxLog' });
    }

    const needsRow = proposal.some(s => s.action?.type === 'sheets.append' && !s.action.params?.row);
    if (needsRow) {
      missing.push({
        key: 'row',
        label: 'עמודות לשורה בגיליון',
        example: 'from, subject, date, webLink, threadId, snippet, to, cc, labels'
      });
    }

    res.json({ ok: true, proposal, missing, questions: [] });
  })
);

function normalizeStep(step) {
  const out = JSON.parse(JSON.stringify(step || {}));

  // Normalize trigger gmail.unreplied
  if (out.trigger?.type === 'gmail.unreplied') {
    const p = out.trigger.params = out.trigger.params || {};
    const norm = {};

    // Map aliases → fromEmail
    norm.fromEmail = p.fromEmail || p.from || null;

    // Hours / Days
    norm.hours = coerceNumber(p.hours);
    if (!norm.hours) {
      // parse "10 hours" or weird strings like "30-10" → ננסה לחלץ את המספר האחרון
      const num = extractLastNumber(p.minutes) || extractLastNumber(p.delay) || extractLastNumber(p.time) || extractLastNumber(p.minutesRange);
      if (num) norm.hours = Number(num);
    }
    // כגיבוי: newerThanDays
    norm.newerThanDays = coerceNumber(p.newerThanDays) || coerceNumber(p.days) || 30;

    // limit סביר
    norm.limit = Math.min(Math.max(coerceNumber(p.limit) || coerceNumber(p.maxResults) || 50, 1), 200);

    out.trigger.params = norm;
  }

  // Normalize action sheets.append
  if (out.action?.type === 'sheets.append') {
    const p = out.action.params = out.action.params || {};
    const norm = {};

    // spreadsheetId
    norm.spreadsheetId = p.spreadsheetId || p.spreadsheet || '';

    // sheetName
    norm.sheetName = p.sheetName || 'Sheet1';

    // row object (placeholders by default)
    if (p.row && typeof p.row === 'object' && !Array.isArray(p.row)) {
      norm.row = p.row;
    } else {
      norm.row = {
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

    out.action.params = norm;
  }

  return out;
}

function coerceNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  }
  return null;
}

function extractLastNumber(v) {
  if (typeof v !== 'string') return null;
  const m = [...v.matchAll(/(\d+(?:\.\d+)?)/g)];
  if (!m.length) return null;
  return m[m.length - 1][1]; // האחרון
}

module.exports = router;
