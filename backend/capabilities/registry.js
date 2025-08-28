// backend/capabilities/registry.js
const gmail = require('./adapters/gmail');
const sheets = require('./adapters/sheets');
const whatsapp = require('./adapters/whatsapp');
const httpReq = require('./adapters/http');

module.exports = {
  // Triggers
  'gmail.unreplied': gmail.unreplied,

  // Actions
  'sheets.append':   sheets.append,
  'whatsapp.send':   whatsapp.send,
  'http.request':    httpReq.request,
};
