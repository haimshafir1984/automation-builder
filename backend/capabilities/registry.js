// backend/capabilities/registry.js
const gmail = require('./adapters/gmail');
const sheets = require('./adapters/sheets');
const whatsapp = require('./adapters/whatsapp');
const httpReq = require('./adapters/http');

// חשוב: לא למפות ל-whatsapp.send (פונקציה),
// אלא לכל האובייקט של האדפטר כדי שלrunner יהיו execute/dryRun.
module.exports = {
  // Triggers
  'gmail.unreplied': gmail.unreplied,

  // Actions
  'sheets.append':   sheets,    // אובייקט עם execute/dryRun
  'whatsapp.send':   whatsapp,  // אובייקט עם execute/dryRun (מהקובץ ששלחתי קודם)
  'http.request':    httpReq,   // כנ"ל
};
