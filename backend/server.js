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

const PORT = process.env.PORT || 5000, HOST = '127.0.0.1';
app.listen(PORT, HOST, () => console.log(`Server listening on http://${HOST}:${PORT}`));
