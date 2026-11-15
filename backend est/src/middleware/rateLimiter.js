const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.API_RATE_LIMIT_PER_MINUTE,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again in a minute.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, try again later.' }
});

module.exports = { apiLimiter, loginLimiter };
