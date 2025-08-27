// backend/capabilities/registry.js
module.exports = {
  sheets: require('./adapters/sheets'),
  http:   require('./adapters/http'),
  whatsapp: require('./adapters/whatsapp')
};
