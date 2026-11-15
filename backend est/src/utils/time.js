/**
 * Time helpers. Indian Railways timetables are in IST (UTC+05:30, no DST),
 * so all schedule arithmetic is done in IST regardless of server timezone.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** 'YYYY-MM-DD' service date in IST for a Date. */
function istDateString(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 3-letter IST weekday for a Date. */
function istDayName(date = new Date()) {
  return DAY_NAMES[new Date(date.getTime() + IST_OFFSET_MS).getUTCDay()];
}

/** Date for HH:MM (IST) on the IST service date, plus dayOffset days. */
function istTimeOnDate(serviceDate, hhmm, dayOffset = 0) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const base = Date.parse(`${serviceDate}T00:00:00.000Z`) - IST_OFFSET_MS;
  return new Date(base + ((dayOffset * 24 + h) * 60 + m) * 60000);
}

/** Shift an IST service date by n days. */
function addDays(serviceDate, n) {
  const d = new Date(Date.parse(`${serviceDate}T00:00:00.000Z`) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

module.exports = { IST_OFFSET_MS, DAY_NAMES, istDateString, istDayName, istTimeOnDate, addDays };
