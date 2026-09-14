function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };

  const sensitiveKeys = ['password', 'apiKey', 'x-api-key', 'secret', 'jwt', 'token', 'authorization'];

  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      copy[key] = '***REDACTED***';
    } else if (typeof copy[key] === 'object') {
      copy[key] = sanitize(copy[key]);
    }
  }
  return copy;
}

function apiLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;

    // Redact query params if any key looks sensitive
    const sanitizedQuery = sanitize(req.query);

    console.log(`[HTTP] ${method} ${url} ${statusCode} - ${duration}ms`);
  });

  next();
}

module.exports = { apiLogger, sanitize };
