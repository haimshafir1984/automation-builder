// backend/capabilities/registry.js
const gmail    = require('./adapters/gmail');     // יכול להיות אובייקט או פונקציה
const sheets   = require('./adapters/sheets');    // אובייקט עם execute/dryRun
const whatsapp = require('./adapters/whatsapp');  // אובייקט עם execute/dryRun/send
const httpReq  = require('./adapters/http');      // אובייקט עם execute/dryRun

module.exports = {
  // Triggers
  'gmail.unreplied': gmail.unreplied || gmail,   // תומך גם בפונקציה וגם באובייקט

  // Actions
  'sheets.append'  : sheets,                     // לא sheets.append
  'whatsapp.send'  : whatsapp,                   // לא whatsapp.send
  'http.request'   : httpReq,                    // לא httpReq.request
};
