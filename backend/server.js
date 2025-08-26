require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

console.log('boot-marker:', new Date().toISOString());
console.log('[boot] __dirname:', __dirname);
console.log('[boot] process.env.PORT:', process.env.PORT);
console.log('[boot] process.env.HOST:', process.env.HOST);

app.use(morgan('dev'));
app.use(cors({ origin: '*'}));
app.use(bodyParser.json({ limit: '4mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/nlp', require('./routes/nlp'));           // existing
app.use('/api/plan', require('./routes/plan'));         // existing
app.use('/api/automations', require('./routes/automations'));
app.use('/api/sheets', require('./routes/sheets'));     // diagnostics & direct tests

// Health
app.get('/health', (_, res) => res.send('OK'));

// Home (optional)
app.get('/', (req, res) => res.send('Backend is up'));

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Server listening on http://${HOST}:${PORT}`));
