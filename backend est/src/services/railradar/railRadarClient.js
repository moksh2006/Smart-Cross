/**
 * RailRadar HTTP client (https://railradar.in/docs).
 *
 * Responsibilities:
 *  - Authentication with `Authorization: Bearer <key>` (key never leaves the server).
 *  - Timeouts, bounded retries with exponential backoff for transient failures.
 *  - Local per-minute limiter + monthly quota accounting (configurable; updated
 *    from the documented X-RateLimit-* response headers when present).
 *  - Short-lived response cache and in-flight de-duplication to avoid
 *    unnecessary calls.
 *  - Audit logging of every attempt.
 */
const axios = require('axios');
const env = require('../../config/env');
const AuditLog = require('../../models/AuditLog');
const log = require('../../utils/logger')('railradar');

const TRANSIENT_STATUSES = new Set([408, 500, 502, 503, 504]);

class RailRadarClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || env.RAILRADAR_BASE_URL;
    this.timeoutMs = options.timeoutMs || env.RAILRADAR_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? env.RAILRADAR_MAX_RETRIES;
    this.perMinuteLimit = options.perMinuteLimit || env.RAILRADAR_PER_MINUTE_LIMIT;
    this.monthlyQuota = options.monthlyQuota || env.RAILRADAR_MONTHLY_QUOTA;
    this.http = options.http || axios.create();
    this.keyProvider = options.keyProvider || (() => env.RAILRADAR_API_KEY);
    this.sleep = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.audit = options.audit !== undefined ? options.audit : true;

    this.recentCalls = [];          // timestamps of attempts in the last 60 s
    this.cache = new Map();         // path -> { expires, result }
    this.inFlight = new Map();      // path -> Promise
    this.cooldownUntil = 0;
    this.authFailedAt = null;
    this.usage = {
      periodStart: this.billingPeriodStart(),
      callsThisPeriod: 0,
      callsToday: 0,
      today: new Date().toDateString(),
      remainingMonthFromHeader: null,
      limitMonthFromHeader: null,
      remainingMinuteFromHeader: null,
      lastStatus: null,
      lastError: null,
      lastSuccessAt: null,
      lastCallAt: null,
      consecutiveFailures: 0
    };
  }

  isConfigured() {
    return Boolean(this.keyProvider());
  }

  billingPeriodStart(now = new Date()) {
    const day = env.RAILRADAR_BILLING_DAY;
    const d = new Date(now.getFullYear(), now.getMonth(), day);
    if (d > now) d.setMonth(d.getMonth() - 1);
    return d;
  }

  /** Restore usage counters from the audit log after a restart. */
  async restoreUsage() {
    try {
      const periodStart = this.billingPeriodStart();
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [period, today] = await Promise.all([
        AuditLog.countDocuments({ category: 'EXTERNAL_API', createdAt: { $gte: periodStart } }),
        AuditLog.countDocuments({ category: 'EXTERNAL_API', createdAt: { $gte: startOfDay } })
      ]);
      this.usage.periodStart = periodStart;
      this.usage.callsThisPeriod = period;
      this.usage.callsToday = today;
    } catch (e) {
      log.warn(`Could not restore API usage: ${e.message}`);
    }
  }

  rollCounters(now = new Date()) {
    const ps = this.billingPeriodStart(now);
    if (ps.getTime() !== this.usage.periodStart.getTime()) {
      this.usage.periodStart = ps;
      this.usage.callsThisPeriod = 0;
      this.usage.remainingMonthFromHeader = null;
    }
    if (now.toDateString() !== this.usage.today) {
      this.usage.today = now.toDateString();
      this.usage.callsToday = 0;
    }
    const cutoff = now.getTime() - 60000;
    this.recentCalls = this.recentCalls.filter((t) => t > cutoff);
  }

  /** Remaining monthly quota (header value is authoritative when available). */
  remainingQuota() {
    this.rollCounters();
    const local = Math.max(0, this.monthlyQuota - this.usage.callsThisPeriod);
    if (this.usage.remainingMonthFromHeader !== null) return Math.min(local, this.usage.remainingMonthFromHeader);
    return local;
  }

  /** Calls allowed today so the remaining quota lasts the rest of the billing period. */
  dailyBudget(now = new Date()) {
    const next = new Date(this.billingPeriodStart(now)); next.setMonth(next.getMonth() + 1);
    const daysLeft = Math.max(1, Math.ceil((next - now) / 86400000));
    const reserve = Math.ceil(this.monthlyQuota * (env.RAILRADAR_QUOTA_RESERVE_PERCENT / 100));
    const usable = Math.max(0, this.remainingQuota() + this.usage.callsToday - reserve);
    return Math.floor(usable / daysLeft);
  }

  canCallNow() {
    this.rollCounters();
    if (!this.isConfigured()) return { ok: false, reason: 'NO_API_KEY' };
    if (this.authFailedAt && Date.now() - this.authFailedAt < 30 * 60000) return { ok: false, reason: 'AUTH_FAILED' };
    if (Date.now() < this.cooldownUntil) return { ok: false, reason: 'COOLDOWN' };
    if (this.remainingQuota() <= 0) return { ok: false, reason: 'QUOTA_EXHAUSTED' };
    if (this.recentCalls.length >= this.perMinuteLimit) return { ok: false, reason: 'PER_MINUTE_LIMIT' };
    return { ok: true };
  }

  /**
   * GET a RailRadar endpoint.
   * @returns {Promise<{ok: boolean, status: number|null, data: any, errorCode: string|null, fromCache: boolean}>}
   */
  async get(path, { cacheTtlMs = 0, trainNumber = null, purpose = 'GET' } = {}) {
    const cached = this.cache.get(path);
    if (cached && cached.expires > Date.now()) return { ...cached.result, fromCache: true };
    if (this.inFlight.has(path)) return this.inFlight.get(path);

    const p = this.execute(path, { trainNumber, purpose })
      .then((result) => {
        if (result.ok && cacheTtlMs > 0) this.cache.set(path, { expires: Date.now() + cacheTtlMs, result });
        return result;
      })
      .finally(() => this.inFlight.delete(path));
    this.inFlight.set(path, p);
    return p;
  }

  async execute(path, { trainNumber, purpose }) {
    let attempt = 0;
    let backoff = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const gate = this.canCallNow();
      if (!gate.ok) return { ok: false, status: null, data: null, errorCode: gate.reason, fromCache: false };

      const started = Date.now();
      this.recentCalls.push(started);
      this.usage.callsThisPeriod += 1;
      this.usage.callsToday += 1;
      this.usage.lastCallAt = new Date(started);

      let status = null;
      let data = null;
      let errorCode = null;
      let headers = {};
      try {
        const res = await this.http.request({
          url: `${this.baseUrl}${path}`,
          method: 'GET',
          timeout: this.timeoutMs,
          headers: { Accept: 'application/json', Authorization: `Bearer ${this.keyProvider()}` },
          validateStatus: () => true
        });
        status = res.status;
        data = res.data;
        headers = res.headers || {};
        if (status >= 200 && status < 300 && data && data.success !== false) errorCode = null;
        else errorCode = (data && data.error && (data.error.code || data.error)) || `HTTP_${status}`;
      } catch (err) {
        errorCode = err.code === 'ECONNABORTED' ? 'TIMEOUT' : (err.code || 'NETWORK_ERROR');
      }
      const latencyMs = Date.now() - started;
      this.applyRateHeaders(headers);
      this.recordAudit({ path, trainNumber, purpose, status, errorCode, latencyMs });

      if (!errorCode) {
        this.usage.lastStatus = status;
        this.usage.lastError = null;
        this.usage.lastSuccessAt = new Date();
        this.usage.consecutiveFailures = 0;
        this.authFailedAt = null;
        return { ok: true, status, data, errorCode: null, fromCache: false };
      }

      this.usage.lastStatus = status;
      this.usage.lastError = String(errorCode);
      this.usage.consecutiveFailures += 1;

      if (status === 401 || status === 403) {
        if (status === 401) this.authFailedAt = Date.now();
        log.warn(`RailRadar ${status} on ${path} (${errorCode}). Check RAILRADAR_API_KEY.`);
        return { ok: false, status, data, errorCode: String(errorCode), fromCache: false };
      }
      if (status === 429) {
        // Per-minute: wait for next minute. Monthly exhaustion shows up as remaining=0.
        const now = new Date();
        this.cooldownUntil = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 1).getTime();
        log.warn(`RailRadar rate limited on ${path}; cooling down until ${new Date(this.cooldownUntil).toISOString()}`);
        return { ok: false, status, data, errorCode: 'RATE_LIMITED', fromCache: false };
      }
      const transient = status === null || TRANSIENT_STATUSES.has(status);
      if (transient && attempt < this.maxRetries) {
        attempt += 1;
        await this.sleep(backoff);
        backoff *= 2;
        continue;
      }
      return { ok: false, status, data, errorCode: String(errorCode), fromCache: false };
    }
  }

  applyRateHeaders(headers) {
    const h = (name) => {
      const v = headers[name] ?? headers[name.toLowerCase()];
      const n = Number(v);
      return v !== undefined && Number.isFinite(n) ? n : null;
    };
    const remMonth = h('X-RateLimit-Remaining-Month');
    const limMonth = h('X-RateLimit-Limit-Month');
    const remMin = h('X-RateLimit-Remaining-Min');
    if (remMonth !== null) this.usage.remainingMonthFromHeader = remMonth;
    if (limMonth !== null) this.usage.limitMonthFromHeader = limMonth;
    if (remMin !== null) this.usage.remainingMinuteFromHeader = remMin;
  }

  recordAudit({ path, trainNumber, purpose, status, errorCode, latencyMs }) {
    if (!this.audit) return;
    AuditLog.create({
      category: 'EXTERNAL_API',
      action: purpose,
      endpoint: path,
      trainNumber,
      httpStatus: status,
      success: !errorCode,
      errorCode,
      latencyMs
    }).catch(() => {});
  }

  status() {
    this.rollCounters();
    return {
      configured: this.isConfigured(),
      monthlyQuota: this.monthlyQuota,
      perMinuteLimit: this.perMinuteLimit,
      billingPeriodStart: this.usage.periodStart,
      callsThisPeriod: this.usage.callsThisPeriod,
      callsToday: this.usage.callsToday,
      callsLastMinute: this.recentCalls.length,
      remainingQuota: this.remainingQuota(),
      dailyBudget: this.dailyBudget(),
      headerRemainingMonth: this.usage.remainingMonthFromHeader,
      headerLimitMonth: this.usage.limitMonthFromHeader,
      cooldownUntil: this.cooldownUntil > Date.now() ? new Date(this.cooldownUntil) : null,
      authFailed: Boolean(this.authFailedAt),
      lastStatus: this.usage.lastStatus,
      lastError: this.usage.lastError,
      lastSuccessAt: this.usage.lastSuccessAt,
      lastCallAt: this.usage.lastCallAt,
      consecutiveFailures: this.usage.consecutiveFailures
    };
  }
}

module.exports = { RailRadarClient, client: new RailRadarClient() };
