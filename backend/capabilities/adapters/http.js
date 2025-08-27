// backend/capabilities/adapters/http.js
module.exports = {
  request: {
    async dryRun(ctx, params={}) {
      const { url, method='GET', headers={}, body } = params;
      return { url, method, headers, body, note: 'dry-run http.request (no network)' };
    },
    async execute(ctx, params={}) {
      const { url, method='GET', headers={}, body } = params;
      if (!url) return { ok:false, error:'url is required' };
      const init = { method, headers };
      if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
      const res = await fetch(url, init);
      const text = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers),
        bodyPreview: text.slice(0, 4000)
      };
    }
  }
};
