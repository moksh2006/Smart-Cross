/**
 * Admin authentication: a single admin password (ADMIN_PASSWORD) exchanged
 * for a signed JWT. All state-changing operations require the token.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const log = require('../utils/logger')('auth');

const DEV_DEFAULT_PASSWORD = 'smartcross-dev';
let adminPassword = env.ADMIN_PASSWORD;
if (!adminPassword && !env.isProduction) {
  adminPassword = DEV_DEFAULT_PASSWORD;
  if (!env.isTest) log.warn(`ADMIN_PASSWORD not set; using development default "${DEV_DEFAULT_PASSWORD}". Set ADMIN_PASSWORD in .env.`);
}
if (env.isProduction && (!adminPassword || adminPassword === DEV_DEFAULT_PASSWORD || adminPassword.length < 10)) {
  log.warn('ADMIN_PASSWORD is missing/weak in production: admin login is disabled until a strong password (10+ chars) is set.');
  if (!adminPassword || adminPassword === DEV_DEFAULT_PASSWORD) adminPassword = '';
}

if (env.isProduction && /change-me/i.test(adminPassword || '')) log.warn('ADMIN_PASSWORD is still the example default: change it before exposing this server.');
if (env.isProduction && /change-me/i.test(env.JWT_SECRET || '')) log.warn('JWT_SECRET is still the example default: change it.');

const jwtSecret = env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!env.JWT_SECRET && !env.isTest) log.warn('JWT_SECRET not set; using a random secret (admin sessions end on restart).');

function adminEnabled() { return Boolean(adminPassword); }

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function login(password) {
  if (!adminEnabled()) { const e = new Error('Admin login is not configured on this server'); e.status = 503; e.expose = true; throw e; }
  if (typeof password !== 'string' || !safeEqual(password, adminPassword)) {
    const e = new Error('Invalid credentials'); e.status = 401; e.expose = true; throw e;
  }
  const token = jwt.sign({ sub: 'admin', role: 'admin' }, jwtSecret, { expiresIn: env.JWT_EXPIRES_IN });
  return { token, expiresIn: env.JWT_EXPIRES_IN };
}

function verify(token) {
  try { return jwt.verify(token, jwtSecret); } catch (e) { return null; }
}

function requireAdmin(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const claims = token ? verify(token) : null;
  if (!claims || claims.role !== 'admin') {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }
  req.admin = claims;
  return next();
}

module.exports = { login, verify, requireAdmin, adminEnabled };
