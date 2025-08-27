// backend/capabilities/registry.js
module.exports = {
  // Triggers
  'gmail.unreplied': require('./adapters/gmail').unreplied,

  // Actions
  'sheets.append': require('./adapters/sheets').append,
  'http.request':  require('./adapters/http').request,
  'whatsapp.send': require('./adapters/whatsapp').send,
};
