function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.url}:`, err.message);

  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal Server Error'
    : err.message || 'An unexpected error occurred';

  res.status(status).json({
    success: false,
    status,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = errorHandler;
