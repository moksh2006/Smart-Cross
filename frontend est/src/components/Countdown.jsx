import React from 'react';
import { useLiveData } from '../context/LiveDataContext';
import { secondsUntil, fmtDuration } from '../lib/format';

/** Live countdown to a predicted time, ticking every second on the client. */
export default function Countdown({ to, fallback = '—', className = '' }) {
  const { now } = useLiveData();
  const s = secondsUntil(to, now);
  if (s === null) return <span className={className}>{fallback}</span>;
  return <span className={`font-mono tabular-nums ${className}`}>{s === 0 ? 'now' : fmtDuration(s)}</span>;
}
