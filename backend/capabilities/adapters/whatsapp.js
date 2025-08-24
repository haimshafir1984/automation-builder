// backend/capabilities/adapters/whatsapp.js
/**
 * Placeholder WhatsApp adapter.
 * אם אין קונפיגורציה (Twilio/Meta), נחזיר 501 כדי שתדע שזה לא מחובר עדיין.
 */
function isConfigured(){
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.WHATSAPP_FROM);
}

module.exports = {
  send: {
    async dryRun(ctx, params={}){
      const { to, template='sla_breach_basic' } = params;
      return { to, template, note: isConfigured() ? 'configured' : 'not-configured' };
    },
    async execute(ctx, params={}){
      if (!isConfigured()) {
        const err = new Error('WhatsApp channel not configured');
        err.code = 501;
        throw err;
      }
      const { to, template='sla_breach_basic' } = params;
      // TODO: שליחה אמיתית דרך Twilio/Meta API
      // כרגע נחזיר ACK סימבולי
      return { to, template, sent: true };
    }
  }
};
