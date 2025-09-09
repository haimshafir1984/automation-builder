const { google } = require('googleapis');
const { OAuth2 } = require('google-auth-library');

// === אחסון טוקן בסיסי בזיכרון (מומלץ להחליף ל-Redis/DB בפרודקשן)
let oauthTokens = null;
let cachedMyEmail = null;

function getOAuthClient() {
  const client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  if (oauthTokens) client.setCredentials(oauthTokens);
  return client;
}

// === OAuth URL
async function getAuthUrl() {
  const oAuth2Client = getOAuthClient();
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/userinfo.email',
  ];
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
}

// === Callback
async function handleOAuthCallback(req) {
  const oAuth2Client = getOAuthClient();
  const code = req.query.code;
  const { tokens } = await oAuth2Client.getToken(code);
  oauthTokens = tokens; // TODO: לשמור באופן מאובטח ל-Redis/DB
  cachedMyEmail = null; // לאפס קאש
}

// === Who am I
async function getMe() {
  if (!oauthTokens) return null;
  const auth = getOAuthClient();
  const oauth2 = google.oauth2({ version: 'v2', auth });
  const { data } = await oauth2.userinfo.get();
  return { emailAddress: data.email };
}

async function getMyEmail() {
  if (cachedMyEmail) return cachedMyEmail;
  const me = await getMe();
  cachedMyEmail = me?.emailAddress || null;
  return cachedMyEmail;
}

// -------------------------------------------------------------------------------------
// Gmail helpers
// -------------------------------------------------------------------------------------

function gmailClient() {
  const auth = getOAuthClient();
  return google.gmail({ version: 'v1', auth });
}

/**
 * בונה שאילתת Gmail בסיסית:
 * - newer_than (ימים/שעות)
 * - from:someone@example.com
 * - מסנן שיחות/פרומושנס/סושיאל כדי לצמצם רעש
 */
function buildGmailQuery({ fromEmail, newerThanDays, hours }) {
  const parts = [];
  if (fromEmail) parts.push(`from:${fromEmail}`);
  if (hours) parts.push(`newer_than:${Math.max(1, Number(hours))}h`);
  else if (newerThanDays) parts.push(`newer_than:${Math.max(1, Number(newerThanDays))}d`);
  // מסננים קצת רעשים. ניתן להתאים.
  parts.push('-in:chats', '-category:promotions', '-category:social');
  return parts.join(' ');
}

/**
 * מחזיר רשימת הודעות (message ids) לפי query
 */
async function listMessagesByQuery({ query, maxResults = 50, pageToken }) {
  const gmail = gmailClient();
  const { data } = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
    pageToken,
  });
  return data;
}

/**
 * מחזיר פרטי הודעה (metadata + snippet + threadId + headers)
 */
async function getMessageDetails(messageId) {
  const gmail = gmailClient();
  const { data } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Cc', 'Date', 'Subject'],
  });
  const headers = indexHeaders(data.payload?.headers || []);

  // עברית: ממפים שדות שימושיים לאייטם
  const item = {
    id: data.id,
    threadId: data.threadId,
    snippet: data.snippet || '',
    from: headers.From || '',
    to: headers.To || '',
    cc: headers.Cc || '',
    subject: headers.Subject || '',
    date: headers.Date || '',
    labels: (data.labelIds || []).join(','),
    webLink: `https://mail.google.com/mail/u/0/#inbox/${data.id}`,
  };
  return item;
}

/**
 * מחזיר את כל ההודעות ב-thread כדי לבדוק האם השיבו (ע״י המשתמש)
 */
async function getThreadMessages(threadId) {
  const gmail = gmailClient();
  const { data } = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'metadata',
    metadataHeaders: ['From', 'Date', 'Subject'],
  });
  return data.messages || [];
}

/**
 * heuristics ל-"unreplied": בת’רד אין הודעה שנשלחה ע״י "me" אחרי ההודעה האחרונה מהשולח.
 * זו הערכה — אפשר לשפר לפי הצורך.
 */
async function filterUnreplied(items) {
  const myEmail = await getMyEmail();
  if (!myEmail) return items; // אם אין אימייל מחובר, נחזיר כמו שהוא

  const out = [];
  for (const item of items) {
    const threadMsgs = await getThreadMessages(item.threadId);

    const lastFromSender = threadMsgs
      .filter(m => {
        const h = indexHeaders(m.payload?.headers || []);
        return (h.From || '').toLowerCase().includes(item.from.toLowerCase());
      })
      .sort((a, b) => Number(b.internalDate) - Number(a.internalDate))[0];

    const anyReplyByMe = threadMsgs.some(m => {
      const h = indexHeaders(m.payload?.headers || []);
      return (h.From || '').toLowerCase().includes(myEmail.toLowerCase());
    });

    // אם אני לא מוצא תשובה ממני — נחשב כלא נענה
    if (!anyReplyByMe) {
      out.push(item);
      continue;
    }

    // אפשר להחמיר ולבדוק זמני הודעות (reply אחרי/לפני), מדלגים כרגע.
  }
  return out;
}

/**
 * מחזיר אייטמים של מיילים (with fields for {{item.*}}),
 * בקירוב ל-"unreplied".
 */
async function getGmailUnreplied({ fromEmail, newerThanDays = 30, hours = null, limit = 50 }) {
  const q = buildGmailQuery({ fromEmail, newerThanDays, hours });
  const first = await listMessagesByQuery({ query: q, maxResults: limit });
  const ids = (first.messages || []).map(m => m.id);

  // מביאים פרטי הודעה לכל id
  const details = await Promise.all(ids.map(id => getMessageDetails(id)));

  // מסננים לכאורה "לא נענו"
  const unreplied = await filterUnreplied(details);

  return unreplied;
}

// -------------------------------------------------------------------------------------
// Google Sheets helpers
// -------------------------------------------------------------------------------------

function sheetsClient() {
  const auth = getOAuthClient();
  return google.sheets({ version: 'v4', auth });
}

/**
 * קורא את שורת הכותרות הראשונה. מחזיר מערך headers (או [])
 */
async function readHeaders(spreadsheetId, sheetName) {
  const sheets = sheetsClient();
  const range = `${sheetName}!1:1`;
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: 'ROWS',
  });
  const firstRow = data.values?.[0] || [];
  return firstRow;
}

/**
 * מעדכן את שורת הכותרות הראשונה (מחליף/מוסיף).
 */
async function writeHeaders(spreadsheetId, sheetName, headers) {
  const sheets = sheetsClient();
  const range = `${sheetName}!1:1`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      majorDimension: 'ROWS',
      values: [headers],
    },
  });
}

/**
 * מבטיח שכל המפתחות קיימים בכותרת; אם אין — מוסיף אותם לסוף. מחזיר את ההדרים הסופיים.
 */
async function ensureHeaders(spreadsheetId, sheetName, keys) {
  const current = await readHeaders(spreadsheetId, sheetName);
  if (!current.length) {
    const initial = Array.from(new Set(keys));
    await writeHeaders(spreadsheetId, sheetName, initial);
    return initial;
  }
  const existing = [...current];
  let changed = false;
  for (const k of keys) {
    if (!existing.includes(k)) {
      existing.push(k);
      changed = true;
    }
  }
  if (changed) {
    await writeHeaders(spreadsheetId, sheetName, existing);
  }
  return existing;
}

/**
 * מוסיף שורה בהתאם ל-object. דואג לכותרות, ממפה ערכים לסדר העמודות.
 */
async function appendRowToSheet(spreadsheetId, sheetName, rowObj) {
  const keys = Object.keys(rowObj || {});
  if (!keys.length) return;

  const headers = await ensureHeaders(spreadsheetId, sheetName, keys);
  const rowValues = headers.map(h => rowObj[h] ?? '');

  const sheets = sheetsClient();
  const range = `${sheetName}!A:A`; // Append בסוף
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [rowValues],
    },
  });
}

// -------------------------------------------------------------------------------------
// Utilities
// -------------------------------------------------------------------------------------

function indexHeaders(headersArray) {
  const map = {};
  for (const h of headersArray) {
    map[h.name] = h.value;
  }
  return map;
}

/**
 * פותר טמפלייטים {{item.field}} בתוך ערכים מחרוזתיים
 */
function resolvePlaceholders(rowObj, item) {
  const out = {};
  for (const [k, v] of Object.entries(rowObj || {})) {
    if (typeof v === 'string') {
      out[k] = v.replace(/\{\{\s*item\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        return item?.[key] ?? '';
      });
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = {
  // OAuth / Identity
  getOAuthClient,
  getAuthUrl,
  handleOAuthCallback,
  getMe,

  // Gmail
  getGmailUnreplied,

  // Sheets
  appendRowToSheet,
  ensureHeaders,
  resolvePlaceholders,
};
