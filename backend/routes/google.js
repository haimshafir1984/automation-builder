// backend/routes/google.js
const express = require('express');
const router = express.Router();
const { getAuthUrl, exchangeCodeForTokens, getGmailClient } = require('../lib/googleAuth');

router.get('/oauth/url', (req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ ok: true, url });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

router.get('/oauth/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code param');
    const tokens = await exchangeCodeForTokens(code);

    // הצג למשתמש את ה-refresh_token כדי שיעתיק ל-ENV שברנדר.
    // (בחשבון חינמי אין איפה לשמור בטוח בצד שרת)
    const html = `
      <h2>OAuth Success ✅</h2>
      <p>Copy this <b>refresh_token</b> into Render Environment as <code>GMAIL_REFRESH_TOKEN</code>, then Redeploy:</p>
      <pre style="white-space:pre-wrap;border:1px solid #ccc;padding:12px">${tokens.refresh_token || '(no refresh_token — if empty, delete app access and run again with prompt=consent)'}</pre>
      <p>Access token (temporary):</p>
      <pre style="white-space:pre-wrap;border:1px solid #ccc;padding:12px">${tokens.access_token || ''}</pre>
    `;
    res.send(html);
  } catch (e) {
    res.status(500).send('OAuth error: ' + String(e.message || e));
  }
});

// בדיקה בסיסית
router.get('/me', async (req, res) => {
  try {
    const { gmail, me } = await getGmailClient();
    res.json({ ok: true, me });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message || e) });
  }
});

module.exports = router;
