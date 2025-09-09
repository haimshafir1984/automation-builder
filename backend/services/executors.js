const {
  getGmailUnreplied,
  appendRowToSheet,
  resolvePlaceholders,
} = require('./google-api');
const { sanitizeLog } = require('../utils/sanitize');

/**
 * מריץ steps לפי הסדר.
 * שומר "items" מהטריגר כדי שאקשנים אחרי זה ירוצו על כל item.
 */
async function executeSteps(steps = []) {
  try {
    if (!Array.isArray(steps) || !steps.length) {
      return { ok: false, error: 'EMPTY_STEPS' };
    }

    // הקשר מצטבר בין צעדים
    let items = null; // מערך של אייטמים (למשל הודעות Gmail)
    let lastTriggerType = null;

    for (const step of steps) {
      const { trigger, action } = step;

      // ===========================
      // TRIGGERS
      // ===========================
      if (trigger) {
        if (trigger.type === 'gmail.unreplied') {
          const p = normalizeGmailUnrepliedParams(trigger.params || {});
          // שדות חובה
          if (!p.fromEmail) {
            return {
              ok: false,
              error: 'MISSING_FIELDS',
              missing: [{
                key: 'fromEmail',
                label: 'כתובת המייל של השולח',
                example: 'name@example.com',
              }],
            };
          }

          const list = await getGmailUnreplied({
            fromEmail: p.fromEmail,
            newerThanDays: p.newerThanDays,
            hours: p.hours,
            limit: p.limit,
          });

          items = list;         // נשמור להמשך
          lastTriggerType = 'gmail.unreplied';
          continue;             // לצעד הבא
        }

        // טריגרים אחרים בעתיד...
      }

      // ===========================
      // ACTIONS
      // ===========================
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
                example: 'https://docs.google.com/spreadsheets/d/<ID>/edit',
              }],
            };
          }

          // אם הגיענו לפה בלי טריגר קודם שמייצר items — עדיין נכתוב שורה אחת "ריקה" עם פלייסהולדרים (אפשר לשנות התנהגות).
          const sourceItems = Array.isArray(items) && items.length ? items : [null];

          for (const item of sourceItems) {
            const resolvedRow = item ? resolvePlaceholders(p.row, item) : { ...p.row };
            await appendRowToSheet(p.spreadsheetId, p.sheetName, resolvedRow);
          }
          continue;
        }

        // אקשנים אחרים בעתיד...
      }
    }

    return { ok: true, message: 'executed' };
  } catch (err) {
    console.error('Execute error:', sanitizeLog(err?.message || String(err)));
    return { ok: false, error: 'EXECUTION_FAILED' };
  }
}

// -----------------------------
// Normalizers & defaults
// -----------------------------

function normalizeGmailUnrepliedParams(params) {
  const out = { ...params };
  // תמיכה בשמות שונים
  if (out.from) out.fromEmail = out.fromEmail || out.from;
  // ברירות מחדל ידידותיות
  out.newerThanDays = out.newerThanDays != null ? Number(out.newerThanDays) : 30;
  out.hours = out.hours != null ? Number(out.hours) : null;
  out.limit = out.limit != null ? Number(out.limit) : 50;
  return out;
}

function normalizeSheetsAppendParams(params) {
  const out = { ...params };
  if (out.spreadsheet && !out.spreadsheetId) {
    out.spreadsheetId = out.spreadsheet;
    delete out.spreadsheet;
  }
  // ברירת מחדל לשם גיליון
  out.sheetName = out.sheetName || 'Sheet1';

  // row חכם כברירת מחדל
  if (!out.row || typeof out.row !== 'object' || Array.isArray(out.row)) {
    out.row = {
      from: "{{item.from}}",
      subject: "{{item.subject}}",
      date: "{{item.date}}",
      webLink: "{{item.webLink}}",
      threadId: "{{item.threadId}}",
      snippet: "{{item.snippet}}",
      to: "{{item.to}}",
      cc: "{{item.cc}}",
      labels: "{{item.labels}}",
    };
  }
  return out;
}

module.exports = { executeSteps };
