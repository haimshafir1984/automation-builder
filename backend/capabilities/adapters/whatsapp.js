// backend/capabilities/adapters/whatsapp.js
const GRAPH = 'https://graph.facebook.com/v20.0';

function getCfg() {
  const token = process.env.WHATSAPP_TOKEN;     // דוגמה: EAAG... (User/Business Access Token)
  const phoneId = process.env.WHATSAPP_PHONE_ID; // דוגמה: 123456789012345
  return { token, phoneId };
}

module.exports = {
  send: {
    async dryRun(ctx, params={}) {
      const { to, text } = params;
      return { to, text, note: 'dry-run whatsapp.send' };
    },
    async execute(ctx, params={}) {
      const { token, phoneId } = getCfg();
      if (!token || !phoneId) return { ok:false, error:'WhatsApp not configured (set WHATSAPP_TOKEN & WHATSAPP_PHONE_ID)' };
      const { to, text } = params;
      if (!to || !text) return { ok:false, error:'to and text are required' };

      const url = `${GRAPH}/${phoneId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to, type: 'text', text: { body: text }
        })
      });
      const json = await res.json().catch(()=>null);
      return { ok: res.ok, status: res.status, response: json };
    }
  }
};
