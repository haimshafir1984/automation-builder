function sanitizeLog(str = '') {
  return String(str)
    .replace(/Bearer\s+[A-Za-z0-9-._~+/]+=*/g, 'Bearer [REDACTED]')
    .replace(/key=[\w-]+/gi, 'key=[REDACTED]')
    .replace(/token=[\w-]+/gi, 'token=[REDACTED]')
    .replace(/api[_-]?key[:=]\s*[\w-]+/gi, 'apiKey=[REDACTED]');
}

module.exports = { sanitizeLog };
