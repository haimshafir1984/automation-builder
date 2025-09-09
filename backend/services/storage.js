// דמו איחסון פשוט בזיכרון. מומלץ להחליף ל-Upstash/Redis.
const store = new Map();

function set(key, value, ttlMs) {
  const expiry = ttlMs ? Date.now() + ttlMs : null;
  store.set(key, { value, expiry });
}

function get(key) {
  const item = store.get(key);
  if (!item) return null;
  if (item.expiry && item.expiry < Date.now()) {
    store.delete(key);
    return null;
  }
  return item.value;
}

function del(key) {
  store.delete(key);
}

module.exports = { set, get, del };
