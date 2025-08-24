// backend/capabilities/adapters/http.js
/**
 * Generic HTTP request adapter (Webhook/REST), כדי לחבר שירותים בלי קוד ייעודי.
 */
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

module.exports = {
  request: {
    async dryRun(_ctx, params={}){
      const { url, method='POST', headers={}, body=null } = params;
      return { url, method, headers, body, preview: true };
    },
    async execute(_ctx, params={}){
      const { url, method='POST', headers={}, body=null, timeoutMs=12000 } = params;
      if (!url) throw new Error('url is required');
      const res = await fetch(url, {
        method, headers,
        body: (body && typeof body==='object') ? JSON.stringify(body) : body,
        timeout: timeoutMs
      });
      const text = await res.text();
      return { status: res.status, ok: res.ok, body: text.slice(0, 2000) };
    }
  }
};
