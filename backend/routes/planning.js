const express = require('express');
const { body } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validation');
const { NLPService } = require('../services/nlp');

const router = express.Router();

router.post('/from-text',
  validate([
    body('text').isString().trim().isLength({ min: 2 }).withMessage('טקסט קצר מדי')
  ]),
  asyncHandler(async (req, res) => {
    const nlp = new NLPService(process.env.GROQ_API_KEY, process.env.GROQ_MODEL || 'llama3.1-8b-instant');
    const result = await nlp.planFromText(req.body.text || '');
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error, details: result.details });
    }

    // === COERCE: normalize proposal & build friendly missing ===
    const proposal = (result.proposal || []).map(step => {
      const copy = JSON.parse(JSON.stringify(step));
      if (copy?.action?.params?.spreadsheet && !copy.action.params.spreadsheetId) {
        copy.action.params.spreadsheetId = copy.action.params.spreadsheet;
        delete copy.action.params.spreadsheet;
      }
      return copy;
    });

    let missing = Array.isArray(result.missing) ? [...result.missing] : [];

    const needsSpreadsheetId =
      proposal.some(s => s.action?.type === 'sheets.append' && !s.action.params?.spreadsheetId);
    if (needsSpreadsheetId && !missing.find(m => m.key === 'spreadsheetId')) {
      missing.push({
        key: 'spreadsheetId',
        label: 'ה-ID של ה-Google Sheet',
        example: 'https://docs.google.com/spreadsheets/d/<ID>/edit'
      });
    }

    const needsRow =
      proposal.some(s => s.action?.type === 'sheets.append' && !s.action.params?.row);
    if (needsRow && !missing.find(m => m.key === 'row')) {
      missing.push({
        key: 'row',
        label: 'עמודות לשורה בגיליון',
        example: 'from, subject, date, webLink, threadId, snippet, to, cc, labels'
      });
    }

    res.json({ ok: true, proposal, missing, questions: result.questions || [] });
  })
);

module.exports = router;
