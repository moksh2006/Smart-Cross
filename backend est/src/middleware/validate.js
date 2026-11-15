/** Small request validation helpers (no extra dependency). */
class BadRequest extends Error {
  constructor(msg) { super(msg); this.status = 400; this.expose = true; }
}

const TRAIN_NO = /^[0-9A-Za-z\-_/ ]{1,20}$/;

function intParam(value, { name, min = -Infinity, max = Infinity, def }) {
  if (value === undefined || value === '') {
    if (def !== undefined) return def;
    throw new BadRequest(`${name} is required`);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequest(`${name} must be an integer between ${min} and ${max}`);
  return n;
}

function numParam(value, { name, min = -Infinity, max = Infinity, def }) {
  if (value === undefined || value === '') {
    if (def !== undefined) return def;
    throw new BadRequest(`${name} is required`);
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new BadRequest(`${name} must be a number between ${min} and ${max}`);
  return n;
}

function trainNumber(value) {
  const v = String(value || '').trim();
  if (!TRAIN_NO.test(v)) throw new BadRequest('Invalid train number');
  return v;
}

function oneOf(value, allowed, { name, def }) {
  if (value === undefined || value === '') { if (def !== undefined) return def; throw new BadRequest(`${name} is required`); }
  if (!allowed.includes(value)) throw new BadRequest(`${name} must be one of ${allowed.join(', ')}`);
  return value;
}

/** Wraps async route handlers so rejections reach the error handler. */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { BadRequest, intParam, numParam, trainNumber, oneOf, ah };
