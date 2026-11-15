/** Mirrors backend/src/config/constants.js */
export const GATE_STATES = ['OPEN', 'CLOSING_SOON', 'CLOSED', 'OPENING_SOON', 'UNKNOWN'];

export const STATE_META = {
  OPEN: { label: 'Open', long: 'Predicted open', color: '#10b981', text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
  CLOSING_SOON: { label: 'Closing soon', long: 'Closure expected soon', color: '#f59e0b', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/50' },
  CLOSED: { label: 'Closed', long: 'Predicted closed', color: '#ef4444', text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/60' },
  OPENING_SOON: { label: 'Opening soon', long: 'Reopening expected soon', color: '#38bdf8', text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/50' },
  UNKNOWN: { label: 'Unknown', long: 'Prediction unavailable', color: '#64748b', text: 'text-slate-300', bg: 'bg-slate-600/20', border: 'border-slate-500/40' }
};

export const SOURCE_META = {
  LIVE_POSITION: { label: 'Live position', level: 1, short: 'L1 Live' },
  LATEST_OBSERVATION: { label: 'Last observation + dead reckoning', level: 2, short: 'L2 Dead reckoning' },
  TIMETABLE_WITH_DELAY: { label: 'Timetable + known delay', level: 3, short: 'L3 Timetable+delay' },
  HISTORICAL_AVERAGE: { label: 'Historical average', level: 4, short: 'L4 Historical' },
  TIMETABLE_ESTIMATE: { label: 'Scheduled timetable', level: 5, short: 'L5 Timetable' },
  UNKNOWN: { label: 'Unknown', level: 6, short: 'Unknown' }
};

export const CONFIDENCE_META = {
  HIGH: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40',
  MEDIUM: 'text-amber-300 bg-amber-500/15 border-amber-500/40',
  LOW: 'text-orange-300 bg-orange-500/15 border-orange-500/40',
  NONE: 'text-slate-400 bg-slate-600/20 border-slate-500/40'
};

export const DIRECTION_META = {
  PATIALA_TO_DHABLAN: { label: 'Patiala → Dhablan', short: 'PTA→DBN' },
  DHABLAN_TO_PATIALA: { label: 'Dhablan → Patiala', short: 'DBN→PTA' },
  UNKNOWN: { label: 'Unknown direction', short: '?' }
};

export const CORRIDOR_STATUS = {
  APPROACHING_CORRIDOR: 'Approaching corridor',
  IN_CORRIDOR: 'In corridor',
  LEFT_CORRIDOR: 'Left corridor',
  SCHEDULED: 'Scheduled',
  EXPECTED_IN_CORRIDOR: 'Expected in corridor (no live data)',
  EXPECTED_DEPARTED: 'Expected to have left',
  UNKNOWN: 'Unknown'
};

export const DISCLAIMER = 'Crossing states are software predictions from train position and timetable data, not readings from gate sensors.';
