const {
  getGmailUnreplied,
  appendRowToSheet,
  resolvePlaceholders,
} = require('./google-api');
const { sanitizeLog } = require('../utils/sanitize');

async function executeSteps(steps = []) {
  try {
    if (!Array.isArray(steps) || !steps.length) {
      return { ok: false, error: 'EMPTY_STEPS' };
    }

    let items = null;

    for (const step of steps) {
      const { trigger, action } = step;

      // -------- TRIGGERS --------
      if (trigger) {
        if (trigger.type === 'gmail.unreplied') {
          const p = normalizeGmailUnrepliedParams(trigger.params || {});
          if (!p.fromEmail) {
            return {
              ok: false,
              error: 'MISSING_FIELDS',
              missing: [{ key: 'fromEmail', label: 'כתובת המייל של השולח', example: 'name@example.com' }]
            };
          }

          const list = await getGmailUnreplied({
            fromEmail: p.fromEmail,
            newerThanDays: p.newerThanDays,
            hours: p.hours,
            limit: p.limit
          });

          items = list;
          continue;
        }
      }

      // -------- ACTIONS --------
      if (action) {
        if (action.type === 'sheets.append') {
          const p = normalizeSheetsAppendParams(action.params || {});

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

          const sourceItems = Array.isArray(items) && items.length ? items : [null];

          for (const item of sourceItems) {
            const resolvedRow = item ? resolvePlaceholders(p.row, item) : { ...p.row };
            await appendRowToSheet(p.spreadsheetId, p.sheetName, resolvedRow);
          }

          continue;
        }
      }
    }

    return { ok: true, message: 'executed' };
  } catch (err) {
    console.error('Execute error:', sanitizeLog(err?.message || String(err)));
    return { ok: false, error: 'EXECUTION_FAILED' };
  }
}

// -------------------- NORMALIZERS --------------------

function normalizeGmailUnrepliedParams(params) {
  const src = params || {};
  const out = {};

  out.fromEmail = src.fromEmail || src.from || null;

  // hours: מנסים לחלץ מספר. אם אין, נשאיר null (ה-Gmail query לא יכיל newer_than שעות)
  out.hours = coerceNumber(src.hours);
  if (!out.hours) {
    const h = extractLastNumber(src.minutes) || extractLastNumber(src.delay) || extractLastNumber(src.time);
    if (h) out.hours = Number(h);
  }

  // newerThanDays ברירת מחדל 30
  out.newerThanDays = coerceNumber(src.newerThanDays) || coerceNumber(src.days) || 30;

  // limit סביר
  out.limit = Math.min(Math.max(coerceNumber(src.limit) || coerceNumber(src.maxResults) || 50, 1), 200);

  return out;
}

function normalizeSheetsAppendParams(params) {
  const src = params || {};
  const out = {};

  out.spreadsheetId = src.spreadsheetId || src.spreadsheet || '';
  out.sheetName = src.sheetName || 'Sheet1';

  if (src.row && typeof src.row === 'object' && !Array.isArray(src.row)) {
    out.row = src.row;
  } else {
    out.row = {
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
  return m[m.length - 1][1];
}

module.exports = { executeSteps };
