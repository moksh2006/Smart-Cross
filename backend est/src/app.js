/** Express application (no listening, no background services) — used by server and tests. */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const log = require('./utils/logger')('http');

function createApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin(origin, cb) {
      if (!origin || env.CLIENT_URLS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '50kb' }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.originalUrl.startsWith('/api/health')) return;
      log.debug(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
  app.use('/api', apiLimiter, routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
