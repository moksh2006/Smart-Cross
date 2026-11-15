const log = require('../utils/logger')('http');

/** Never leaks stack traces or internal messages for unexpected errors. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Malformed JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Request body too large' });
  if (err.name === 'ValidationError' && err.errors) {
    return res.status(400).json({ success: false, message: 'Validation failed', details: Object.values(err.errors).map((e) => e.message) });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) log.error(`${req.method} ${req.originalUrl}: ${err.stack || err.message}`);
  const message = err.expose || status < 500 ? err.message : 'Internal server error';
  return res.status(status).json({ success: false, message });
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };
