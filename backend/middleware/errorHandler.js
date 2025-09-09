const { sanitizeLog } = require('../utils/sanitize');

const errorHandler = (err, req, res, _next) => {
  const msg = sanitizeLog(err?.message || String(err));
  const statusCode = err.statusCode || 500;

  console.error('Error:', {
    message: msg,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(statusCode).json({
    ok: false,
    error: statusCode === 500 ? 'Internal Server Error' : msg
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };
