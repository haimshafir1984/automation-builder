// backend/routes/google.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const router = express.Router();

/* ================== אחסון טוקנים: חדש (per-tenant) + ישן (קובץ יחיד) ================== */
const DATA_DIR = path.join(__dirname, '..', 'data');
const LEGACY_PATH = path.join(DATA_DIR, 'google_tokens.json');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadLegacy() {
  try { return JSON.parse(fs.readFileSync(LEGACY_PATH, 'utf8')); } catch { return null; }
}
function saveLegacy(tokens) {
  ensureDir();
  fs.writeFileSync(LEGACY_PATH, JSON.stringify(tokens, null, 2));
}
function readStore() {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return { tenants: {} }; }
}
function writeStore(s) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2));
}
function getGoogleTokens(tenantId) {
  const s = readStore();
  return s.tenants?.[tenantId]?.googleTokens || null;
}
function setGoogleTokens(tenantId, tokens) {
  const s = readStore();
  s.tenants ||= {};
  s.tenants[tenantId] ||= {};
  s.tenants[tenantId].googleTokens = tokens;
  s.tenants[tenantId].googleTokensSavedAt = new Date().toISOString();
  writeStore(s);
  return tokens;
}

/* ================== ENV + OAuth Client ================== */
function requireEnv() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error(
      'Missing env vars: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI'
    );
  }
  return { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI };
}
function makeOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = requireEnv();
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

/* ================== Scopes ================== */
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'openid',
  'email',
  'profile',
];

/* ================== בניית URL ידנית (בלי URLSearchParams) ================== */
function buildAuthUrl({ tenantId = 'default' }) {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = requireEnv();
  const q = [
    ['client_id', GOOGLE_CLIENT_ID],
    ['redirect_uri', GOOGLE_REDIRECT_URI],
    ['response_type', 'code'],
    ['access_type', 'offline'],
    ['prompt', 'consent'],
    ['include_granted_scopes', 'true'],
    ['scope', SCOPES.join(' ')],
    ['state', JSON.stringify({ tenantId })],
  ]
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + q;
}

/* ================== GET /api/google/oauth/url ================== */
router.get('/oauth/url', (req, res) => {
  try {
    const tenantId = (req.query.tenantId || 'default').trim();
    const url = buildAuthUrl({ tenantId });
    const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = process.env;
    console.log('[google/oauth/url] client_id:', GOOGLE_CLIENT_ID);
    console.log('[google/oauth/url] redirect_uri:', GOOGLE_REDIRECT_URI);
    console.log('[google/oauth/url] scope:', SCOPES.join(' '));
    return res.json({ ok: true, url });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

/* ================== Callback: תומך גם /oauth/callback וגם /callback ================== */
router.get('/oauth/callback', handleCallback);
router.get('/callback', handleCallback);

async function handleCallback(req, res) {
  try {
    const code = (req.query.code || '').trim();
    const state = req.query.state || '';
    if (!code) throw new Error('missing code');

    let tenantId = 'default';
    if (state) {
      try { tenantId = JSON.parse(decodeURIComponent(state)).tenantId || 'default'; } catch {}
    }

    const oauth2Client = makeOAuthClient();
    const result = await oauth2Client.getToken(code);
    const tokens = result.tokens || {};

    // נשמור גם ל"חדש" (per-tenant) וגם ל"ישן" (קובץ יחיד) לתאימות
    setGoogleTokens(tenantId, tokens);
    saveLegacy(tokens);

    return res.send(
      '<html><body style="font-family:sans-serif">' +
      '<h3>✅ Google OAuth Connected</h3>' +
      '<p>Tenant: <b>' + tenantId + '</b></p>' +
      '<p>אפשר לסגור את החלון ולחזור לאפליקציה.</p>' +
      '</body></html>'
    );
  } catch (e) {
    try {
      if (e.response && e.response.data) {
        console.error('[oauth/callback] token error data:', e.response.data);
      }
    } catch {}
    console.error('[oauth/callback] error:', e && e.message ? e.message : e);
    return res.status(400).send('OAuth error: ' + (e.message || String(e)));
  }
}

/* ================== יבוא ידני של refresh_token (אופציונלי) ================== */
router.post('/tokens/import', express.json(), (req, res) => {
  try {
    const tenantId = (req.body?.tenantId || 'default').trim();
    const refresh_token = (req.body?.refresh_token || '').trim();
    if (!refresh_token) return res.status(400).json({ ok: false, error: 'missing refresh_token' });
    setGoogleTokens(tenantId, { refresh_token, token_type: 'Bearer' });
    saveLegacy({ refresh_token, token_type: 'Bearer' });
    return res.json({ ok: true, saved: true });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

/* ================== בדיקת טוקנים ================== */
router.get('/tokens', (req, res) => {
  try {
    const tenantId = (req.query.tenantId || 'default').trim();
    const tokensNew = getGoogleTokens(tenantId);
    const tokensOld = loadLegacy();
    const any = tokensNew || tokensOld;
    return res.json({
      ok: true,
      hasTokens: !!any,
      where: tokensNew ? 'store.json' : (tokensOld ? 'google_tokens.json' : null),
      tokens: any ? { ...any, access_token: '***' } : null
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || String(e) });
  }
});

/* ================== Debug: לראות מה השרת רואה מה-.env ================== */
router.get('/debug', (req, res) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  return res.json({
    ok: true,
    env: {
      GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID ? '[set]' : '[MISSING]',
      GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET ? '[set]' : '[MISSING]',
      GOOGLE_REDIRECT_URI: GOOGLE_REDIRECT_URI || '[MISSING]',
    }
  });
});

module.exports = router;
