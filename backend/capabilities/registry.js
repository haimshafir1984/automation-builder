const gmail    = require('./adapters/gmail');
const sheets   = require('./adapters/sheets');
const whatsapp = require('./adapters/whatsapp');
const httpReq  = require('./adapters/http');

module.exports = {
  // Triggers
  'gmail.unreplied': gmail.unreplied || gmail,

  // Actions
  'sheets.append'  : sheets,     // חשוב: לא sheets.append
  'whatsapp.send'  : whatsapp,   // חשוב: לא whatsapp.send
  'http.request'   : httpReq
};
