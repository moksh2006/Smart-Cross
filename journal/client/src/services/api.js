import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const customMessage = error.response?.data?.message || error.message || 'Network error';
    console.warn('[API Error]:', customMessage);
    return Promise.reject(error);
  }
);

export const phatakApi = {
  getAll: () => api.get('/phataks'),
  getById: (id) => api.get(`/phataks/${id}`),
  getNearby: (lat, lon, radius = 1500) => api.get(`/phataks/nearby?lat=${lat}&lon=${lon}&radius=${radius}`)
};

export const trainApi = {
  getAll: () => api.get('/trains'),
  getByNumber: (number) => api.get(`/trains/${number}`),
  refresh: (number) => api.post(`/trains/${number}/refresh`),
  simulateSchedule: (number, speed = 2) => api.post(`/trains/${number}/simulate-schedule`, { speed })
};

export const predictionApi = {
  getActive: () => api.get('/predictions'),
  recalculate: () => api.post('/predictions/recalculate')
};

export const alertApi = {
  getRecent: (limit = 50, phatak = null) => api.get(`/alerts?limit=${limit}${phatak ? `&phatak=${phatak}` : ''}`),
  subscribePush: (subData) => api.post('/alerts/subscribe', subData)
};

export const adminApi = {
  getMetrics: () => api.get('/admin/metrics'),
  getApiLogs: (limit = 50) => api.get(`/admin/api-logs?limit=${limit}`)
};

export const simulationApi = {
  start: (config) => api.post('/simulation/start', config),
  stop: () => api.post('/simulation/stop'),
  reset: () => api.post('/simulation/reset'),
  getStatus: () => api.get('/simulation/status')
};

export const settingApi = {
  getAll: () => api.get('/settings'),
  update: (key, value, description) => api.put('/settings', { key, value, description })
};

export const systemApi = {
  getStatus: () => api.get('/system/status')
};

export const debugApi = {
  getRailRadar: (trainNumber) => api.get(`/debug/railradar/${trainNumber}`),
  testTrain: (trainNumber) => api.post(`/debug/test-train/${trainNumber}`)
};

export default api;
