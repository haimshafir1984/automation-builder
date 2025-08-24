// backend/lib/googleGmail.js
const { google } = require('googleapis');
const { loadTokens } = require('./oauthStore');

function getOAuthClientFromSessionOrStore(req) {
  const tokens = req.session?.googleTokens || loadTokens();
  if (!tokens) throw new Error('Not connected to Google (OAuth)');
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2.setCredentials(tokens);
  return oauth2;
}

function getGmailClient(req) {
  const auth = getOAuthClientFromSessionOrStore(req);
  const gmail = google.gmail({ version: 'v1', auth });
  return { gmail, auth };
}

module.exports = { getGmailClient, getOAuthClientFromSessionOrStore };
