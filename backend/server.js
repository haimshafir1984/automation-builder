require('dotenv').config();

const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');
const planningRouter = require('./routes/planning');
const googleRouter = require('./routes/google');
const automationsRouter = require('./routes/automations');

const app = express();

// --- Security headers
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://cdn.tailwindcss.com"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"]
    }
  }
}));

// --- Compression & logging
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// --- CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*'
}));

// --- Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Rate limit APIs only
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  max: 100,
  message: 'Too many requests from this IP'
});
app.use('/api', apiLimiter);

// --- Static frontend (your wizard)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// --- Routes
app.use('/health', healthRouter);
app.use('/api/planning', planningRouter);
app.use('/api/google', googleRouter);
app.use('/api/automations', automationsRouter);

// --- Fallback to index (wizard)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wizard_plus.html'));
});

// --- Error handler (must be last)
app.use(errorHandler);

// --- Export for tests & start
const PORT = process.env.PORT || 10000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
}
module.exports = app;
