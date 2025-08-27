// backend/server.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

/* ---------------- Boot diagnostics ---------------- */
console.log('boot-marker:', new Date().toISOString());
console.log('[boot] commit:', process.env.RENDER_GIT_COMMIT || 'n/a');
console.log('[boot] __dirname:', __dirname);
console.log('[boot] process.env.PORT:', process.env.PORT);
console.log('[boot] process.env.HOST:', process.env.HOST);

function safeResolve(p) {
  try { return require.resolve(p); } catch { return '(not found)'; }
}
console.log('[boot] routes resolve ->', {
  google:       safeResolve('./routes/google'),
  plan:         safeResolve('./routes/plan'),
  nlp:          safeResolve('./routes/nlp'),
  automations:  safeResolve('./routes/automations'),
  sheets:       safeResolve('./routes/sheets'),
});

/* ---------------- Middlewares ---------------- */
app.use(morgan('dev'));
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '4mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

/* ---------------- Static files ---------------- */
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ---------------- API routes ---------------- */
app.use('/api/google', require('./routes/google'));          // OAuth + Gmail checks
app.use('/api/plan', require('./routes/plan'));              // free-text -> pipeline
app.use('/api/nlp', require('./routes/nlp'));                // any NLP endpoints you have
app.use('/api/automations', require('./routes/automations'));// engine executor
app.use('/api/sheets', require('./routes/sheets'));          // SA diagnostics & direct tests

/* ---------------- Env debug (safe) ---------------- */
// בודק הגעה של ENV חשובים, בלי לחשוף סודות מלאים
app.get('/api/debug/env', (_req, res) => {
  const mask = v => (v ? `${String(v).slice(0, 4)}***(${String(v).length})` : null);
  res.json({
    ok: true,
    has: {
      GOOGLE_CLIENT_ID:     !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      OAUTH_REDIRECT_URL:   !!process.env.OAUTH_REDIRECT_URL,
      GMAIL_REFRESH_TOKEN:  !!process.env.GMAIL_REFRESH_TOKEN,
      GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      NLP_PROVIDER:         process.env.NLP_PROVIDER || null,
      OLLAMA_BASE_URL:      !!process.env.OLLAMA_BASE_URL,
      OLLAMA_MODEL:         process.env.OLLAMA_MODEL || null,
      WHATSAPP_TOKEN:       !!process.env.WHATSAPP_TOKEN,
      WHATSAPP_PHONE_ID:    !!process.env.WHATSAPP_PHONE_ID,
    },
    peek: {
      GOOGLE_CLIENT_ID:     mask(process.env.GOOGLE_CLIENT_ID),
      OAUTH_REDIRECT_URL:   process.env.OAUTH_REDIRECT_URL || null,
      OLLAMA_BASE_URL:      process.env.OLLAMA_BASE_URL || null,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || null
    }
  });
});

/* ---------------- Health ---------------- */
app.get('/health', (_req, res) => res.send('OK'));

/* ---------------- Home (serve old wizard) ---------------- */
app.get('/', (req, res) => {
  const wiz = path.join(__dirname, 'public', 'wizard_plus.html');
  if (fs.existsSync(wiz)) {
    return res.sendFile(wiz);
  }
  return res
    .status(404)
    .send('wizard_plus.html לא נמצא בתיקייה backend/public');
});

/* ---------------- Listen ---------------- */
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
