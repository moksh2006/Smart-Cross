export function fmtTime(d, withSeconds = false) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}), hour12: false, timeZone: 'Asia/Kolkata' });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
}

/** Seconds until a timestamp (live countdown), never negative. */
export function secondsUntil(d, now = Date.now()) {
  if (!d) return null;
  return Math.max(0, Math.round((new Date(d).getTime() - now) / 1000));
}

export function fmtDuration(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '—';
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function fmtMinutes(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '—';
  if (sec < 60) return '< 1 min';
  return `${Math.round(sec / 60)} min`;
}

export function fmtDistance(m) {
  if (m === null || m === undefined || !Number.isFinite(m)) return '—';
  const a = Math.abs(m);
  const s = a >= 1000 ? `${(a / 1000).toFixed(1)} km` : `${Math.round(a)} m`;
  return m < 0 ? `${s} past` : s;
}

export function ago(d, now = Date.now()) {
  if (!d) return 'never';
  const s = Math.round((now - new Date(d).getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
