/** Minimal levelled logger. Never logs secrets (callers must not pass them). */
const env = require('../config/env');

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const current = () => LEVELS[env.LOG_LEVEL] ?? LEVELS.info;

function log(level, scope, msg, extra) {
  if (LEVELS[level] > current()) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (extra !== undefined) out(line, extra); else out(line);
}

module.exports = (scope) => ({
  error: (m, e) => log('error', scope, m, e),
  warn: (m, e) => log('warn', scope, m, e),
  info: (m, e) => log('info', scope, m, e),
  debug: (m, e) => log('debug', scope, m, e)
});
