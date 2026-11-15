import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, TrainFront } from 'lucide-react';
import { useLiveData } from '../context/LiveDataContext';
import CorridorMap from '../components/CorridorMap';
import Countdown from '../components/Countdown';
import { Panel, StatusBadge, ConfidenceBadge, SourceBadge, Empty } from '../components/ui';
import { DIRECTION_META, CORRIDOR_STATUS, STATE_META } from '../lib/constants';
import { fmtTime, fmtDistance, fmtDuration, ago } from '../lib/format';

function CrossingDetail({ c }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><div><div className="text-xs text-slate-400">Phatak {c.number} · Group {c.group}</div><div className="text-lg font-semibold">{c.name}</div></div><StatusBadge state={c.state} /></div>
      <p className="text-xs text-slate-400">{c.reason}</p>
      {c.predictions.length === 0 ? <Empty>No train predicted.</Empty> : c.predictions.map((p) => (
        <div key={p.trainNumber} className="rounded-lg bg-slate-900/60 p-3 text-sm">
          <div className="flex items-center justify-between"><span className="font-semibold">{p.trainNumber} <span className="text-xs text-slate-500">{DIRECTION_META[p.direction]?.short}</span></span><span className="space-x-1"><SourceBadge source={p.source} simulated={p.isSimulated} /><ConfidenceBadge confidence={p.confidence} /></span></div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-400">
            <span>Arrival: <b className="text-slate-200">{fmtTime(p.predictedArrival)}</b> (<Countdown to={p.predictedArrival} />)</span>
            <span>Distance: <b className="text-slate-200">{fmtDistance(p.distanceMeters)}</b></span>
            <span>Closure: <b className="text-slate-200">{fmtTime(p.predictedClosureStart)}</b></span>
            <span>Reopen: <b className="text-slate-200">{fmtTime(p.predictedReopen)}</b></span>
            <span>Est. wait: <b className="text-slate-200">{fmtDuration(p.closureDurationSeconds)}</b></span>
            <span>Impact: <b className={STATE_META[p.impact]?.text}>{STATE_META[p.impact]?.label}</b></span>
          </div>
        </div>
      ))}
      <Link to={`/crossings/${c.number}`} className="text-sm text-sky-300 hover:underline">Open full crossing details →</Link>
    </div>
  );
}

function TrainDetail({ t, now }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between"><div><div className="text-lg font-semibold">{t.trainNumber}</div><div className="text-xs text-slate-400">{t.trainName}</div></div><span className="space-x-1"><SourceBadge source={t.source} simulated={t.isSimulated} /><ConfidenceBadge confidence={t.confidence} /></span></div>
      <div className="grid grid-cols-2 gap-1 text-xs text-slate-400">
        <span>Direction: <b className="text-slate-200">{DIRECTION_META[t.direction]?.label}</b></span>
        <span>Status: <b className="text-slate-200">{CORRIDOR_STATUS[t.corridorStatus]}</b></span>
        <span>Speed: <b className="text-slate-200">{t.measuredSpeedKmh ?? '—'} km/h</b>{t.stopped ? ' (stopped)' : ''}</span>
        <span>Delay: <b className="text-slate-200">{t.delayMinutes ?? '—'} min</b></span>
        <span>Observed: <b className={t.isStale ? 'text-amber-300' : 'text-slate-200'}>{ago(t.observedAt, now)}</b></span>
        <span>Position: <b className="text-slate-200">{t.positionMethod || '—'}</b></span>
      </div>
      {t.nextCrossing && <div className="rounded-lg bg-slate-900/60 p-2 text-xs">Next: Phatak <b>{t.nextCrossing.phatakNumber}</b> in <Countdown to={t.nextCrossing.predictedArrival} /> ({fmtDistance(t.nextCrossing.distanceMeters)})</div>}
      <p className="text-xs text-slate-500">{t.reason}</p>
      <Link to={`/trains/${encodeURIComponent(t.trainNumber)}`} className="text-sky-300 hover:underline">Train details →</Link>
    </div>
  );
}

export default function MapPage() {
  const { crossings, trains, now } = useLiveData();
  const [selected, setSelected] = useState(null);
  const c = selected && selected.type === 'crossing' ? crossings.find((x) => x.number === selected.id) : null;
  const t = selected && selected.type === 'train' ? trains.find((x) => x.trainNumber === selected.id) : null;
  const unplaced = trains.filter((x) => !x.coordinates);
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Live railway map</h1><p className="text-sm text-slate-400">Click a crossing or train for details. Train arrows point in the direction of travel; positions marked stale are older than the staleness threshold.</p></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><CorridorMap height="min(70vh, 640px)" selected={selected} onSelect={setSelected} /></div>
        <div className="space-y-4">
          <Panel title={c ? 'Crossing' : t ? 'Train' : 'Details'} icon={c ? MapPin : TrainFront}>
            {c ? <CrossingDetail c={c} /> : t ? <TrainDetail t={t} now={now} /> : <Empty>Select a crossing or train on the map.</Empty>}
          </Panel>
          <Panel title="Legend">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(STATE_META).map(([k, m]) => <span key={k} className="flex items-center gap-2"><span className="h-3 w-3 rounded" style={{ background: m.color }} />{m.label}</span>)}
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-sky-400" />Live train</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-fuchsia-400" />Simulated train</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-slate-400" />Stale position</span>
            </div>
          </Panel>
          {unplaced.length > 0 && (
            <Panel title="Trains without a position">
              <ul className="space-y-1 text-xs text-slate-400">{unplaced.map((x) => <li key={x.trainNumber}><Link className="text-sky-300 hover:underline" to={`/trains/${encodeURIComponent(x.trainNumber)}`}>{x.trainNumber}</Link> · {CORRIDOR_STATUS[x.corridorStatus]} · {x.source.replace(/_/g, ' ').toLowerCase()}</li>)}</ul>
              <p className="mt-2 text-[11px] text-slate-500">These trains are predicted from the timetable; no live position is available, so none is drawn.</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
