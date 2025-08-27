// backend/lib/googleAuth.js
const { google } = require('googleapis');

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URL   = process.env.OAUTH_REDIRECT_URL || ''; // e.g. https://automation-builder-backend.onrender.com/api/google/oauth/callback
const GMAIL_REFRESH_TOKEN  = process.env.GMAIL_REFRESH_TOKEN || ''; // שים ברנדר אחרי ההתחברות הראשונה

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  // אם תרצה גם שליחה/תוויות בעתיד: 'https://www.googleapis.com/auth/gmail.modify'
];

function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !OAUTH_REDIRECT_URL) {
    throw new Error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / OAUTH_REDIRECT_URL');
  }
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL);
  if (GMAIL_REFRESH_TOKEN) {
    client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  }
  return client;
}

function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

async function exchangeCodeForTokens(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  // tokens.refresh_token חשוב! אותו נכניס ל־ENV ברנדר (GMAIL_REFRESH_TOKEN)
  return tokens;
}

async function getGmailClient() {
  const auth = getOAuth2Client();
  if (!GMAIL_REFRESH_TOKEN) {
    throw new Error('GMAIL_REFRESH_TOKEN is not set. Complete OAuth first.');
  }
  const gmail = google.gmail({ version: 'v1', auth });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const me = profile.data.emailAddress;
  return { gmail, me };
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  getGmailClient,
};
