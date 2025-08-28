// backend/routes/google.js
const express = require('express');
const router = express.Router();
const {
  getAuthUrl, exchangeCodeForTokens, getGmailClient,
  getStoredRefreshToken, deleteRefreshToken
} = require('../lib/googleAuth');
const store = require('../lib/tokenStore');

function key(req){ return (req.query.userKey || 'default').toString(); }

// בקשת קישור OAuth (אם כבר מחוברים – מחזיר connected:true)
router.get('/oauth/url', async (req, res) => {
  try {
    const userKey = key(req);
    const force = String(req.query.force||'') === '1';
    const existing = await getStoredRefreshToken(userKey);
    if (existing && !force) return res.json({ ok:true, connected:true, url:null, userKey });
    const url = await getAuthUrl({ force, userKey });
    res.json({ ok:true, connected:false, url, userKey });
  } catch (e) {
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

// callback – קורא state כדי לדעת userKey, ושומר ל-store
router.get('/oauth/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const state = decodeURIComponent(req.query.state || 'default');
    if (!code) return res.status(400).send('Missing code');
    const tokens = await exchangeCodeForTokens(code, state);
    const note = tokens.refresh_token ? 'נשמר refresh_token למשתמש '+state : 'אין refresh_token חדש (קיים כבר).';
    res.send(`
      <meta charset="utf-8" />
      <h2>מחובר ל-Gmail ✅</h2>
      <p>${note}</p>
      <p><a href="/" style="font-family:system-ui;display:inline-block;margin-top:12px;">⬅ חזרה לאפליקציה</a></p>
    `);
  } catch (e) {
    res.status(500).send('OAuth error: ' + String(e.message||e));
  }
});

// מי אני (פר־משתמש)
router.get('/me', async (req, res) => {
  try {
    const { me } = await getGmailClient(key(req));
    res.json({ ok:true, me });
  } catch (e) {
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

// יש/אין טוקן (פר־משתמש)
router.get('/tokens', async (req, res) => {
  try {
    const exists = !!(await getStoredRefreshToken(key(req)));
    res.json({ ok:true, exists });
  } catch (e) {
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

// דיאגנוסטיקה
router.get('/debug', async (req, res) => {
  try {
    const kind = await store.kind();
    const exists = !!(await getStoredRefreshToken(key(req)));
    res.json({ ok:true, store:kind, userKey:key(req), refreshTokenExists:exists });
  } catch (e) {
    res.status(400).json({ ok:false, error:String(e.message||e) });
  }
});

// התנתקות (פר־משתמש)
router.post('/disconnect', async (req, res) => {
  try { await deleteRefreshToken(key(req)); res.json({ ok:true }); }
  catch (e) { res.status(400).json({ ok:false, error:String(e.message||e) }); }
});

module.exports = router;
