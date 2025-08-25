// backend/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

app.use((req,res,next) => { console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); next(); });
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/google', require('./routes/google'));
app.use('/api/plan', require('./routes/plan'));
app.use('/api/nlp', require('./routes/nlp'));
app.use('/api/automations', require('./routes/automations')); // כפי שהיה אצלך

app.get('/health', (_,res)=>res.send('OK'));
app.get('/', (req,res)=>res.sendFile(path.join(__dirname, 'public', 'wizard_plus.html')));

// ... כל מה שלמעלה נשאר ...
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

// דיבאג קצר שיעזור לנו לוודא מה נטען בענן
console.log('[boot] __dirname:', __dirname);
console.log('[boot] process.env.PORT:', process.env.PORT);
console.log('[boot] process.env.HOST:', process.env.HOST);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

