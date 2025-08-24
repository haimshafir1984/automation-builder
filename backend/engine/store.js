// backend/engine/store.js
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const WF_FILE = path.join(DATA_DIR, "workflows.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(p) {
  try {
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("[store] failed to read JSON", p, e.message);
    return {};
  }
}

function writeJson(p, obj) {
  try {
    fs.writeFileSync(p, JSON.stringify(obj || {}, null, 2), "utf-8");
  } catch (e) {
    console.error("[store] failed to write JSON", p, e.message);
  }
}

function loadStore() {
  ensureDir();
  return readJson(STATE_FILE);
}

function saveStore(data) {
  ensureDir();
  writeJson(STATE_FILE, data || {});
  return true;
}

function getState(ns, key, _default) {
  const s = loadStore();
  if (!s[ns]) return _default;
  if (typeof key === "undefined") return s[ns];
  return typeof s[ns][key] === "undefined" ? _default : s[ns][key];
}

function setState(ns, key, val) {
  const s = loadStore();
  if (!s[ns]) s[ns] = {};
  s[ns][key] = val;
  saveStore(s);
  return true;
}

module.exports = {
  loadStore,
  saveStore,
  getState,
  setState,
  DATA_DIR,
  STATE_FILE,
  WF_FILE
};
