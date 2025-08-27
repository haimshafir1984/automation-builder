// backend/server.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

console.log('[boot] commit:', process.env.RENDER_GIT_COMMIT || 'n/a');
console.log('[boot] __dirname:', __dirname);
console.log('[boot] process.env.PORT:', process.env.PORT);
console.log('[boot] process.env.HOST:', process.env.HOST);

app.use(morgan('dev'));
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '4mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/nlp', require('./routes/nlp'));
app.use('/api/plan', require('./routes/plan'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/sheets', require('./routes/sheets'));

// Health
app.get('/health', (_, res) => res.send('OK'));

// Home – הגש UI ללא OAuth אם קיים (sa.html). אם לא, נסה wizard_plus.html. אחרת טקסט.
app.get('/', (req, res) => {
  const sa = path.join(__dirname, 'public', 'sa.html');
  const wiz = path.join(__dirname, 'public', 'wizard_plus.html');
  if (fs.existsSync(sa)) return res.sendFile(sa);
  if (fs.existsSync(wiz)) return res.sendFile(wiz);
  res.send('Backend is up (no public/sa.html or wizard_plus.html)');
});

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Server listening on http://${HOST}:${PORT}`));
