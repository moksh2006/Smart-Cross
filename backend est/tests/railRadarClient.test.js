const { RailRadarClient } = require('../src/services/railradar/railRadarClient');

function makeClient(responses, opts = {}) {
  const calls = [];
  const http = {
    request: jest.fn(async (cfg) => {
      calls.push(cfg);
      const r = responses.shift();
      if (r instanceof Error) throw r;
      return r;
    })
  };
  const client = new RailRadarClient({
    http, keyProvider: () => 'test-key', sleep: async () => {}, audit: false,
    perMinuteLimit: 10, monthlyQuota: 1000, maxRetries: 2, ...opts
  });
  return { client, http, calls };
}

const ok = (data = { success: true, data: {} }, headers = {}) => ({ status: 200, data, headers });

describe('RailRadarClient', () => {
  test('sends bearer auth and never puts the key in the URL', async () => {
    const { client, calls } = makeClient([ok()]);
    const r = await client.get('/v1/trains/14508/live');
    expect(r.ok).toBe(true);
    expect(calls[0].headers.Authorization).toBe('Bearer test-key');
    expect(calls[0].url).not.toMatch(/test-key/);
    expect(calls[0].timeout).toBeGreaterThan(0);
  });
  test('uses X-RateLimit headers for remaining quota', async () => {
    const { client } = makeClient([ok(undefined, { 'x-ratelimit-remaining-month': '42', 'x-ratelimit-limit-month': '100' })]);
    await client.get('/v1/x');
    expect(client.remainingQuota()).toBe(42);
    expect(client.status().headerLimitMonth).toBe(100);
  });
  test('retries transient 503 with bounded attempts', async () => {
    const { client, http } = makeClient([{ status: 503, data: {} }, { status: 503, data: {} }, ok()]);
    const r = await client.get('/v1/y');
    expect(r.ok).toBe(true);
    expect(http.request).toHaveBeenCalledTimes(3);
  });
  test('gives up after max retries', async () => {
    const { client, http } = makeClient([{ status: 500, data: {} }, { status: 500, data: {} }, { status: 500, data: {} }, ok()]);
    const r = await client.get('/v1/z');
    expect(r.ok).toBe(false);
    expect(http.request).toHaveBeenCalledTimes(3);
  });
  test('timeout / network errors are retried then reported', async () => {
    const e = Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
    const { client } = makeClient([e, e, e]);
    const r = await client.get('/v1/t');
    expect(r).toMatchObject({ ok: false, errorCode: 'TIMEOUT' });
  });
  test('429 sets a cooldown and blocks further calls', async () => {
    const { client, http } = makeClient([{ status: 429, data: { error: { code: 'TOO_MANY_REQUESTS' } } }, ok()]);
    const r = await client.get('/v1/a');
    expect(r.errorCode).toBe('RATE_LIMITED');
    const r2 = await client.get('/v1/b');
    expect(r2.errorCode).toBe('COOLDOWN');
    expect(http.request).toHaveBeenCalledTimes(1);
  });
  test('401 marks auth failure and is not retried', async () => {
    const { client, http } = makeClient([{ status: 401, data: {} }, ok()]);
    const r = await client.get('/v1/a');
    expect(r.ok).toBe(false);
    expect(client.canCallNow()).toEqual({ ok: false, reason: 'AUTH_FAILED' });
    expect(http.request).toHaveBeenCalledTimes(1);
  });
  test('local per-minute limit', async () => {
    const { client } = makeClient([ok(), ok(), ok()], { perMinuteLimit: 2 });
    await client.get('/v1/1');
    await client.get('/v1/2');
    const r = await client.get('/v1/3');
    expect(r.errorCode).toBe('PER_MINUTE_LIMIT');
  });
  test('monthly quota exhaustion', async () => {
    const { client } = makeClient([ok(), ok()], { monthlyQuota: 1 });
    await client.get('/v1/1');
    expect((await client.get('/v1/2')).errorCode).toBe('QUOTA_EXHAUSTED');
  });
  test('cache and in-flight de-duplication prevent repeat calls', async () => {
    const { client, http } = makeClient([ok({ success: true, data: { n: 1 } })]);
    const [a, b] = await Promise.all([client.get('/v1/c', { cacheTtlMs: 10000 }), client.get('/v1/c', { cacheTtlMs: 10000 })]);
    const c = await client.get('/v1/c', { cacheTtlMs: 10000 });
    expect(a.ok && b.ok && c.ok).toBe(true);
    expect(c.fromCache).toBe(true);
    expect(http.request).toHaveBeenCalledTimes(1);
  });
  test('no API key -> no HTTP call', async () => {
    const { client, http } = makeClient([ok()], { keyProvider: () => '' });
    expect((await client.get('/v1/x')).errorCode).toBe('NO_API_KEY');
    expect(http.request).not.toHaveBeenCalled();
  });
  test('daily budget spreads remaining quota', () => {
    const { client } = makeClient([], { monthlyQuota: 300 });
    expect(client.dailyBudget()).toBeGreaterThan(0);
    expect(client.dailyBudget()).toBeLessThanOrEqual(300);
  });
});
