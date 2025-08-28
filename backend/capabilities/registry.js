// backend/capabilities/registry.js
const gmail    = require('./adapters/gmail');     // trigger
const sheets   = require('./adapters/sheets');    // object with execute/dryRun
const whatsapp = require('./adapters/whatsapp');  // object with execute/dryRun
const httpReq  = require('./adapters/http');      // object with execute/dryRun

module.exports = {
  // Triggers
  'gmail.unreplied': gmail.unreplied || gmail,

  // Actions
  'sheets.append'  : sheets,    // לא sheets.append
  'whatsapp.send'  : whatsapp,  // לא whatsapp.send
  'http.request'   : httpReq,   // לא httpReq.request
};
