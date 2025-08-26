// backend/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');

// --- App ---
const app = express();

// boot marker for logs
console.log('boot-marker:', new Date().toISOString());
console.log('[boot] __dirname:', __dirname);
console.log('[boot] process.env.PORT:', process.env.PORT);
console.log('[boot] process.env.HOST:', process.env.HOST);

// --- Middlewares ---
app.use(morgan('dev'));
app.use(cors({ origin: '*'}));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// --- Static ---
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- Routes ---
const planRoutes = require('./routes/plan');
const automationsRoutes = require('./routes/automations');
const nlpRoutes = require('./routes/nlp');
const workflowsRoutes = require('./routes/workflows');
const { startEngine } = require('./engine/engine');

// engine can be optional - start if available
let engineApi = null;
try {
  engineApi = startEngine();
  console.log('[engine] started');
} catch (e) {
  console.warn('[engine] not started:', e.message);
}

// Mount routes
app.use('/api/plan', planRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/nlp', nlpRoutes);
app.use('/api', workflowsRoutes(engineApi));

// healthcheck
app.get('/health', (_, res) => res.send('OK'));

// default page
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'wizard_plus.html'))
);

// host/port
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
