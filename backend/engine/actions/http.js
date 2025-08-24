const fetch = require("node-fetch");
async function post(params = {}, payload = {}) {
  const url = params.url;
  if (!url) throw new Error("http.post requires params.url");
  const method = (params.method || "POST").toUpperCase();
  const headers = Object.assign({ "Content-Type": "application/json; charset=utf-8" }, params.headers || {});
  const body = params.body ? JSON.stringify(params.body) : JSON.stringify(payload);
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return { status: res.status, text };
}
module.exports = { post };
