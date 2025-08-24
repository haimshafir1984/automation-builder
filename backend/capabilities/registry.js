// backend/capabilities/registry.js
const gmail = require('./adapters/gmail');
const sheets = require('./adapters/sheets');
const whatsapp = require('./adapters/whatsapp');
const httpReq = require('./adapters/http');

const registry = {
  // Triggers
  'gmail.search': gmail.search,
  'gmail.unreplied': gmail.unreplied,

  // Actions
  'sheets.append': sheets.append,
  'whatsapp.send': whatsapp.send,
  'http.request': httpReq.request
};

function resolveAdapter(type){
  return registry[type] || null;
}

module.exports = { registry, resolveAdapter };
