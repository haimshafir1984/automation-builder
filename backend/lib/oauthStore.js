// backend/lib/oauthStore.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify({ tenants: {} }, null, 2));
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { tenants: {} };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function getTenant(tenantId) {
  const store = readStore();
  store.tenants ||= {};
  store.tenants[tenantId] ||= {};
  return store.tenants[tenantId];
}

function setTenant(tenantId, obj) {
  const store = readStore();
  store.tenants ||= {};
  store.tenants[tenantId] = { ...(store.tenants[tenantId] || {}), ...obj };
  writeStore(store);
  return store.tenants[tenantId];
}

function getGoogleTokens(tenantId) {
  const t = getTenant(tenantId);
  return t.googleTokens || null;
}

function setGoogleTokens(tenantId, tokens) {
  return setTenant(tenantId, { googleTokens: tokens, googleTokensSavedAt: new Date().toISOString() });
}

module.exports = {
  getTenant,
  setTenant,
  getGoogleTokens,
  setGoogleTokens,
};
