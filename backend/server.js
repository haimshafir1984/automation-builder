// backend/server.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// -------- Boot diagnostics --------
function safeResolve(p) {
  try { return require.resolve(p); }
  catch { return '(not found)'; }
}

console.log('[boot] commit:', process.env.RENDER_GIT_COMMIT || 'n/a');
console.log('[boot] __dirname:', __dirname);
console.log('[boot] process.env.PORT:', process.env.PORT);
console.log('[boot] process.env.HOST:', process.env.HOST);
console.log('[boot] routes resolve: ', {
  google:      safeResolve('./routes/google'),
  plan:        safeResolve('./routes/plan'),
  nlp:         safeResolve('./routes/nlp'),
  automations: safeResolve('./routes/automations'),
  sheets:      safeResolve('./routes/sheets'),
});
console.log('[boot] registry resolve:', safeResolve('./capabilities/registry'));
console.log('boot-marker:', new Date().toISOString());

// -------- Middleware --------
app.use(morgan('dev'));
app.use(cors({ origin: '*'}));
app.use(bodyParser.json({ limit: '4mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// -------- Routes --------
app.use('/api/google', require('./routes/google'));
app.use('/api/plan', require('./routes/plan'));
app.use('/api/nlp', require('./routes/nlp'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/sheets', require('./routes/sheets'));

// Health
app.get('/health', (_req, res) => res.send('OK'));

// -------- Debug: ENV deep --------
function mask(val, keepStart = 4, keepEnd = 2) {
  if (!val) return null;
  const s = String(val);
  if (s.length <= keepStart + keepEnd) return s.replace(/./g, '*');
  return s.slice(0, keepStart) + '***' + s.slice(-keepEnd);
}
app.get('/api/debug/env', (_req, res) => {
  try {
    const has = {
      GOOGLE_CLIENT_ID:          !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET:      !!process.env.GOOGLE_CLIENT_SECRET,
      OAUTH_REDIRECT_URL:        !!process.env.OAUTH_REDIRECT_URL,
      GMAIL_REFRESH_TOKEN:       !!process.env.GMAIL_REFRESH_TOKEN, // fallback only
      GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,

      NLP_PROVIDER:              process.env.NLP_PROVIDER || null,
      OLLAMA_BASE_URL:           !!process.env.OLLAMA_BASE_URL,
      OLLAMA_MODEL:              process.env.OLLAMA_MODEL || null,

      // WhatsApp (Meta)
      WHATSAPP_TOKEN:            !!process.env.WHATSAPP_TOKEN,
      WHATSAPP_PHONE_ID:         !!process.env.WHATSAPP_PHONE_ID,

      // Twilio
      TWILIO_ACCOUNT_SID:        !!process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN:         !!process.env.TWILIO_AUTH_TOKEN,
      TWILIO_WHATSAPP_FROM:      !!process.env.TWILIO_WHATSAPP_FROM,
      TWILIO_WHATSAPP_TO:        !!process.env.TWILIO_WHATSAPP_TO,

      // Defaults / planner
      DEFAULT_SPREADSHEET_ID:    !!process.env.DEFAULT_SPREADSHEET_ID,

      // Token store (Redis/Sheets/File)
      TOKEN_STORE:               process.env.TOKEN_STORE || 'redis',
      TOKEN_SHEET_ID:            !!process.env.TOKEN_SHEET_ID,
      TOKEN_SHEET_TAB:           process.env.TOKEN_SHEET_TAB || null,
      UPSTASH_REDIS_REST_URL:    !!process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN:  !!process.env.UPSTASH_REDIS_REST_TOKEN,
    };

    const peek = {
      GOOGLE_CLIENT_ID:     mask(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: mask(process.env.GOOGLE_CLIENT_SECRET),
      OAUTH_REDIRECT_URL:   process.env.OAUTH_REDIRECT_URL || null,
      OLLAMA_BASE_URL:      process.env.OLLAMA_BASE_URL || null,
      OLLAMA_MODEL:         process.env.OLLAMA_MODEL || null,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
      TWILIO_ACCOUNT_SID:   mask(process.env.TWILIO_ACCOUNT_SID),
      TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM || null,
      TWILIO_WHATSAPP_TO:   process.env.TWILIO_WHATSAPP_TO || null,
      TOKEN_STORE:          process.env.TOKEN_STORE || 'redis',
      TOKEN_SHEET_ID:       process.env.TOKEN_SHEET_ID || null,
      TOKEN_SHEET_TAB:      process.env.TOKEN_SHEET_TAB || null,
      UPSTASH_REDIS_REST_URL:   mask(process.env.UPSTASH_REDIS_REST_URL, 12, 4),
    };

    res.json({ ok:true, has, peek });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e.message || e) });
  }
});

// -------- Debug: Registry keys --------
app.get('/api/debug/registry', (_req, res) => {
  try {
    const reg = require('./capabilities/registry');
    const keys = Object.keys(reg || {});
    res.json({ ok:true, keys });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e.message || e) });
  }
});

// -------- Home --------
app.get('/', (req, res) => {
  const p = path.join(__dirname, 'public', 'wizard_plus.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.send('Backend is up (no public/wizard_plus.html)');
});

// -------- Listen --------
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
