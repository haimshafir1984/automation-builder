// backend/server.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// לוגים קצרים בעת עלייה
console.log('[boot] commit:', process.env.RENDER_GIT_COMMIT || 'n/a');
console.log('[boot] __dirname:', __dirname);

app.use(morgan('dev'));
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '4mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// קבצים סטטיים
app.use('/public', express.static(path.join(__dirname, 'public')));

// נתיבי API קיימים
app.use('/api/nlp', require('./routes/nlp'));
app.use('/api/plan', require('./routes/plan'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/sheets', require('./routes/sheets'));

// בריאות
app.get('/health', (_, res) => res.send('OK'));

// דף הבית — תמיד מגיש את העיצוב הישן
app.get('/', (req, res) => {
  const wiz = path.join(__dirname, 'public', 'wizard_plus.html');
  if (fs.existsSync(wiz)) return res.sendFile(wiz);
  return res.status(404).send('wizard_plus.html לא נמצא בתיקייה backend/public');
});

// הפעלה
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
