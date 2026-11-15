import axios from 'axios';

const TOKEN_KEY = 'smartcross_admin_token';

export const tokenStore = {
  get() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } }
};

const http = axios.create({ baseURL: import.meta.env.VITE_API_BASE || '/api', timeout: 15000 });

http.interceptors.request.use((cfg) => {
  const t = tokenStore.get();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

http.interceptors.response.use(
  (r) => r.data && r.data.data !== undefined ? r.data.data : r.data,
  (err) => {
    const status = err.response ? err.response.status : 0;
    const message = (err.response && err.response.data && err.response.data.message) || err.message || 'Network error';
    if (status === 401 && !String(err.config.url).includes('/auth/login')) onUnauthorized();
    return Promise.reject(Object.assign(new Error(message), { status }));
  }
);

export const api = {
  state: () => http.get('/state'),
  corridor: () => http.get('/corridor'),
  systemStatus: () => http.get('/system/status'),
  phatak: (n) => http.get(`/phataks/${n}`),
  nearby: (lat, lon, radius = 5000) => http.get('/phataks/nearby', { params: { lat, lon, radius } }),
  trains: () => http.get('/trains'),
  train: (n) => http.get(`/trains/${encodeURIComponent(n)}`),
  refreshTrain: (n) => http.post(`/trains/${encodeURIComponent(n)}/refresh`),
  predictions: (phatak) => http.get('/predictions', { params: phatak ? { phatak } : {} }),
  recalculate: () => http.post('/predictions/recalculate'),
  alerts: (params) => http.get('/alerts', { params }),
  subscribe: (body) => http.post('/alerts/subscribe', body),
  analytics: (params) => http.get('/analytics/summary', { params }),
  settings: () => http.get('/settings'),
  updateSetting: (key, value) => http.put('/settings', { key, value }),
  resetSetting: (key) => http.delete(`/settings/${key}`),
  login: (password) => http.post('/auth/login', { password }),
  me: () => http.get('/auth/me'),
  setMode: (mode) => http.put('/admin/mode', { mode }),
  metrics: () => http.get('/admin/metrics'),
  apiLogs: (category = 'EXTERNAL_API', limit = 100) => http.get('/admin/api-logs', { params: { category, limit } }),
  scheduler: () => http.get('/admin/scheduler'),
  sim: {
    status: () => http.get('/simulation/status'),
    scenario: (name) => http.post(`/simulation/scenarios/${name}`),
    addTrain: (spec) => http.post('/simulation/trains', spec),
    updateTrain: (id, patch) => http.patch(`/simulation/trains/${encodeURIComponent(id)}`, patch),
    removeTrain: (id) => http.delete(`/simulation/trains/${encodeURIComponent(id)}`),
    pause: () => http.post('/simulation/pause'),
    resume: () => http.post('/simulation/resume'),
    reset: () => http.post('/simulation/reset'),
    stop: () => http.post('/simulation/stop')
  }
};
