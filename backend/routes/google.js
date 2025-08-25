// backend/routes/google.js
const express = require('express');
const { URLSearchParams } = require('url');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Helper: read env with defaults
function getEnv() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
    tokensDir: process.env.TOKENS_DIR || '/tmp/tokens'
  };
}

// Debug endpoint: do not expose secrets, only flags
router.get('/debug', (req, res) => {
  const env = getEnv();
  res.json({
    ok: true,
    env: {
      GOOGLE_CLIENT_ID: env.clientId ? '[set]' : '',
      GOOGLE_CLIENT_SECRET: env.clientSecret ? '[set]' : '',
      GOOGLE_REDIRECT_URI: env.redirectUri || '',
      TOKENS_DIR: env.tokensDir || ''
    }
  });
});

// OAuth URL
router.get('/oauth/url', (req, res) => {
  try {
    const { clientId, redirectUri } = getEnv();

    if (!clientId) {
      return res.status(500).json({ ok: false, error: 'Missing GOOGLE_CLIENT_ID' });
    }
    if (!redirectUri || !/^https?:\/\//i.test(redirectUri)) {
      return res.status(500).json({
        ok: false,
        error: 'Invalid GOOGLE_REDIRECT_URI (must be full URL, e.g. https://your-app.onrender.com/api/google/oauth/callback)'
      });
    }

    const scope = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
      'openid',
      'email',
      'profile'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope,
      state: JSON.stringify({ tenantId: 'default' })
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.json({ ok: true, url });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// OAuth callback (exchange code -> tokens)
// נשאיר כאן מבנה בסיסי, בלי כתיבה לקבצים אם אין צורך כרגע.
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { clientId, clientSecret, redirectUri, tokensDir } = getEnv();

    if (!code) return res.status(400).send('OAuth error: missing code');

    // ודא תיקייה לכתיבת טוקנים (ב-Free על Render זה /tmp)
    try { fs.mkdirSync(tokensDir, { recursive: true }); } catch (_) {}

    // חילוף קוד לטוקנים
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type':'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResp.json();
    if (!tokenResp.ok) {
      return res.status(400).send(`OAuth error: ${tokens.error || 'invalid_client'}`);
    }

    // כתיבה זמנית לקובץ (לא חובה, אבל שימושי לבדיקות)
    fs.writeFileSync(path.join(tokensDir, 'google_tokens.json'), JSON.stringify(tokens, null, 2));
    return res.send('✅ Google OAuth Connected<br><br>Tenant: default<br><br>אפשר לסגור את החלון ולחזור לאפליקציה.');
  } catch (e) {
    return res.status(500).send(`OAuth error: ${e.message || String(e)}`);
  }
});

// (אופציונלי) מצב טוקנים בסיסי
router.get('/tokens', (req, res) => {
  const { tokensDir } = getEnv();
  const p = path.join(tokensDir, 'google_tokens.json');
  const exists = fs.existsSync(p);
  res.json({
    ok: true,
    path: p,
    exists
  });
});

module.exports = router;
