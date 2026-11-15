import React from 'react';
import { Link } from 'react-router-dom';
import { Train, Clock, Timer, ChevronRight } from 'lucide-react';
import { StatusBadge, ConfidenceBadge, SourceBadge } from './ui';
import Countdown from './Countdown';
import { STATE_META, DIRECTION_META } from '../lib/constants';
import { fmtTime, fmtDistance, fmtDuration } from '../lib/format';

export default function CrossingCard({ crossing: c }) {
  const p = c.controlling;
  const meta = STATE_META[c.state] || STATE_META.UNKNOWN;
  const active = p && ['APPROACHING', 'AT_CROSSING', 'PASSED', 'DUE'].includes(p.status);
  return (
    <Link to={`/crossings/${c.number}`} className={`glass-panel group block rounded-2xl border-l-4 p-4 transition hover:bg-slate-800/60`} style={{ borderLeftColor: meta.color }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-slate-400">Phatak {c.number} · Group {c.group}</div>
          <div className="text-lg font-semibold text-slate-100">{c.name}</div>
        </div>
        <StatusBadge state={c.state} pending={c.pendingState} />
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs text-slate-400">{c.reason}</p>
      {active ? (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300"><Train className="w-4 h-4 text-sky-400" />{p.trainNumber}<span className="text-xs text-slate-500">{DIRECTION_META[p.direction]?.short}</span></span>
            <span className="flex gap-1"><SourceBadge source={p.source} simulated={p.isSimulated} /><ConfidenceBadge confidence={p.confidence} /></span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-900/60 p-2"><div className="text-[10px] uppercase text-slate-500">Arrival in</div><Countdown to={p.predictedArrival} className="text-sm font-semibold text-slate-100" /><div className="text-[10px] text-slate-500">{fmtTime(p.predictedArrival)}</div></div>
            <div className="rounded-lg bg-slate-900/60 p-2"><div className="text-[10px] uppercase text-slate-500">Closure ~</div><div className="text-sm font-semibold text-slate-100">{fmtDuration(p.closureDurationSeconds)}</div><div className="text-[10px] text-slate-500">from {fmtTime(p.predictedClosureStart)}</div></div>
            <div className="rounded-lg bg-slate-900/60 p-2"><div className="text-[10px] uppercase text-slate-500">Reopen in</div><Countdown to={p.predictedReopen} className="text-sm font-semibold text-slate-100" /><div className="text-[10px] text-slate-500">{fmtTime(p.predictedReopen)}</div></div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />{p.distanceMeters !== null ? fmtDistance(p.distanceMeters) : 'no live position'}</span>
            {c.predictions.length > 1 && <span>+{c.predictions.length - 1} more train(s)</span>}
            <ChevronRight className="w-4 h-4 opacity-0 transition group-hover:opacity-100" />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Clock className="w-3.5 h-3.5" />No train predicted within the warning window</div>
      )}
    </Link>
  );
}
