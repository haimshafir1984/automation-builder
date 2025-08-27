// backend/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// חותמת בזמן עלייה — נזהה בקלות ב־logs של Railway
console.log('boot-marker:', new Date().toISOString());

// דיבאג נוסף על משתנים חשובים
console.log('[boot] __dirname:', __dirname);
console.log('[boot] process.env.PORT:', process.env.PORT);
console.log('[boot] process.env.HOST:', process.env.HOST);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// נתיבי API
app.use('/api/google', require('./routes/google'));
app.use('/api/plan', require('./routes/plan'));
app.use('/api/nlp', require('./routes/nlp'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/sheets', require('./routes/sheets'));

// healthcheck (שירותי deploy בודקים אותו)
app.get('/health', (_, res) => res.send('OK'));

// דף ברירת מחדל — wizard_plus.html
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'wizard_plus.html'))
);

// קביעת פורט והאזנה על כל הכתובות (0.0.0.0)
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
