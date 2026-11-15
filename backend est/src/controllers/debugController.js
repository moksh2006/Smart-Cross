const { fetchLiveTrain } = require('../services/railradar/liveTrainService');
const { getSchedule, nearestCorridorTiming } = require('../services/railradar/trainScheduleService');
const { trainNumber } = require('../middleware/validate');

/** Admin-only: one live fetch with full normalization diagnostics (consumes one API call). */
exports.railRadar = async (req, res) => {
  const n = trainNumber(req.params.number);
  const schedule = await getSchedule(n);
  const timing = schedule ? nearestCorridorTiming(schedule, new Date()) : null;
  const result = await fetchLiveTrain(n, { kmPosts: timing ? { ptaKm: timing.ptaKm, dbnKm: timing.dbnKm } : {}, purpose: 'DEBUG', persist: false });
  res.json({ success: true, data: { trainNumber: n, timing, result } });
};
