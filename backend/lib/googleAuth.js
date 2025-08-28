// backend/lib/googleAuth.js
const { google } = require('googleapis');
const store = require('./tokenStore');

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URL   = process.env.OAUTH_REDIRECT_URL || '';
const ENV_REFRESH          = process.env.GMAIL_REFRESH_TOKEN || ''; // fallback only

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function getOAuth2Client(refreshToken) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !OAUTH_REDIRECT_URL) {
    throw new Error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / OAUTH_REDIRECT_URL');
    }
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL);
  if (refreshToken) client.setCredentials({ refresh_token: refreshToken });
  return client;
}

function keyFor(userKey='default') {
  return `GMAIL_REFRESH_TOKEN:${userKey}`;
}

async function getStoredRefreshToken(userKey='default') {
  const k = keyFor(userKey);
  const t = await store.get(k);
  // backward-compat: plain env if none
  return t || ENV_REFRESH || '';
}

async function saveRefreshToken(token, userKey='default') {
  if (!token) return false;
  await store.set(keyFor(userKey), token);
  return true;
}

async function deleteRefreshToken(userKey='default') {
  await store.del(keyFor(userKey));
  return true;
}

async function getAuthUrl({ force=false, userKey='default' } = {}) {
  const existing = await getStoredRefreshToken(userKey);
  const client = getOAuth2Client(existing || undefined);
  const params = {
    access_type: 'offline',
    scope: SCOPES,
    state: encodeURIComponent(userKey)
  };
  if (!existing || force) params.prompt = 'consent';
  return client.generateAuthUrl(params);
}

async function exchangeCodeForTokens(code, userKey='default') {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (tokens.refresh_token) {
    await saveRefreshToken(tokens.refresh_token, userKey);
  }
  return tokens;
}

async function getGmailClient(userKey='default') {
  const refreshToken = await getStoredRefreshToken(userKey);
  if (!refreshToken) throw new Error('Not connected: no refresh_token in store');
  const auth = getOAuth2Client(refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return { gmail, me: profile.data.emailAddress };
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  getGmailClient,
  getStoredRefreshToken,
  saveRefreshToken,
  deleteRefreshToken,
};
