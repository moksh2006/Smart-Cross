import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Layers, ShieldAlert, AlertTriangle, CheckCircle2, TrainFront, Clock, Gauge, Bell } from 'lucide-react';
import { useLiveData } from '../context/LiveDataContext';
import CrossingCard from '../components/CrossingCard';
import Countdown from '../components/Countdown';
import { Panel, StatCard, StatusBadge, ConfidenceBadge, SourceBadge, Empty, Spinner } from '../components/ui';
import { DIRECTION_META, CONFIDENCE_META } from '../lib/constants';
import { fmtTime, fmtDuration, ago, fmtDistance } from '../lib/format';

export default function DashboardPage() {
  const { snapshot, crossings, trains, groups, alerts, now, lastMessageAt } = useLiveData();

  const upcoming = useMemo(() => crossings
    .flatMap((c) => c.predictions.filter((p) => ['APPROACHING', 'DUE', 'AT_CROSSING'].includes(p.status) && (p.etaSeconds ?? 1e9) <= 60 * 60).map((p) => ({ ...p, crossingName: c.name })))
    .sort((a, b) => new Date(a.predictedArrival) - new Date(b.predictedArrival)), [crossings]);

  if (!snapshot) return <Spinner label="Connecting to SmartCross…" />;

  const count = (s) => crossings.filter((c) => c.state === s).length;
  const activeTrains = trains.filter((t) => ['IN_CORRIDOR', 'APPROACHING_CORRIDOR', 'EXPECTED_IN_CORRIDOR'].includes(t.corridorStatus)).length;
  const confidences = upcoming.slice(0, 4).map((p) => p.confidence);
  const overallConfidence = confidences.length ? ['NONE', 'LOW', 'MEDIUM', 'HIGH'].find((c) => confidences.includes(c)) : null;
  const maxWait = crossings.filter((c) => c.controlling && ['CLOSED', 'CLOSING_SOON'].includes(c.state)).map((c) => c.controlling.closureDurationSeconds || 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Corridor dashboard</h1>
          <p className="text-sm text-slate-400">Patiala (PTA) ⇄ Dhablan (DBN) · predicted crossing status</p>
        </div>
        <div className="text-xs text-slate-500">Last data update <span className="text-slate-300">{ago(lastMessageAt, now)}</span> · engine run {fmtTime(snapshot.generatedAt, true)}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Monitored crossings" value={crossings.length} icon={Layers} />
        <StatCard label="Predicted open" value={count('OPEN')} icon={CheckCircle2} tone="text-emerald-300" />
        <StatCard label="Closing soon" value={count('CLOSING_SOON')} icon={AlertTriangle} tone="text-amber-300" />
        <StatCard label="Predicted closed" value={count('CLOSED')} icon={ShieldAlert} tone="text-rose-300" />
        <StatCard label="Opening soon" value={count('OPENING_SOON')} icon={Clock} tone="text-sky-300" />
        <StatCard label="Active trains" value={activeTrains} sub={`${trains.length} tracked`} icon={TrainFront} />
        <StatCard label="Longest est. closure" value={maxWait.length ? fmtDuration(Math.max(...maxWait)) : '—'} sub="current/next closure" icon={Gauge} />
        <StatCard label="Prediction confidence" value={overallConfidence ? <span className={`rounded border px-2 text-base ${CONFIDENCE_META[overallConfidence]}`}>{overallConfidence}</span> : '—'} sub="lowest of next closures" icon={Activity} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {crossings.map((c) => <CrossingCard key={c.number} crossing={c} />)}
      </div>

      {groups.length > 0 && (
        <Panel title="Grouped closure warnings" icon={Layers}>
          <div className="grid gap-3 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-amber-200">{g.groupName}</div>
                  <ConfidenceBadge confidence={g.confidence} />
                </div>
                <div className="mt-1 text-sm text-slate-300">Train <b>{g.trainNumber}</b> ({DIRECTION_META[g.direction]?.short}) · sequence {g.sequence.join(' → ')}</div>
                <table className="mt-2 w-full text-xs">
                  <thead className="text-slate-500"><tr><th className="text-left">Phatak</th><th>Closes ~</th><th>Arrival</th><th>Reopens ~</th></tr></thead>
                  <tbody>
                    {g.crossings.map((w) => (
                      <tr key={w.phatakNumber} className="text-center text-slate-300"><td className="text-left">{w.phatakNumber}</td><td>{fmtTime(w.predictedClosureStart)}</td><td>{fmtTime(w.predictedArrival)}</td><td>{fmtTime(w.predictedReopen)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-slate-500">{g.predictedWindowsOverlap ? 'Predicted closure windows overlap.' : 'Predicted closure windows do not overlap.'} Barriers are not assumed to close simultaneously.</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Upcoming predicted closures (next 60 min)" icon={Clock} className="lg:col-span-2" bodyClass="p-0">
          {upcoming.length === 0 ? <div className="p-4"><Empty>No monitored train is predicted at any crossing in the next hour.</Empty></div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-slate-500"><tr className="border-b border-white/5"><th className="px-4 py-2">Phatak</th><th>Train</th><th>Arrival</th><th>In</th><th>Est. wait</th><th>Distance</th><th>Basis</th></tr></thead>
                <tbody>
                  {upcoming.slice(0, 12).map((p) => (
                    <tr key={`${p.trainNumber}-${p.phatakNumber}`} className="border-b border-white/5">
                      <td className="px-4 py-2"><Link className="text-sky-300 hover:underline" to={`/crossings/${p.phatakNumber}`}>{p.phatakNumber}</Link> <span className="text-xs text-slate-500">{p.crossingName}</span></td>
                      <td><Link className="hover:underline" to={`/trains/${encodeURIComponent(p.trainNumber)}`}>{p.trainNumber}</Link> <span className="text-xs text-slate-500">{DIRECTION_META[p.direction]?.short}</span></td>
                      <td>{fmtTime(p.predictedArrival)}</td>
                      <td><Countdown to={p.predictedArrival} /></td>
                      <td>{fmtDuration(p.closureDurationSeconds)}</td>
                      <td className="text-slate-400">{fmtDistance(p.distanceMeters)}</td>
                      <td className="space-x-1 whitespace-nowrap"><SourceBadge source={p.source} simulated={p.isSimulated} /><ConfidenceBadge confidence={p.confidence} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Recent alerts" icon={Bell} actions={<Link to="/alerts" className="text-xs text-sky-300 hover:underline">All alerts</Link>}>
          {alerts.length === 0 ? <Empty>No alerts yet.</Empty> : (
            <ul className="space-y-2">
              {alerts.slice(0, 6).map((a) => (
                <li key={a._id} className="rounded-lg bg-slate-900/50 p-2">
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-200">{a.title}</span><span className="shrink-0 text-slate-500">{ago(a.createdAt, now)}</span></div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Crossing status summary" icon={Activity} bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-slate-500"><tr className="border-b border-white/5"><th className="px-4 py-2">Phatak</th><th>Predicted state</th><th>Since</th><th>Reason</th></tr></thead>
            <tbody>
              {crossings.map((c) => (
                <tr key={c.number} className="border-b border-white/5"><td className="px-4 py-2">{c.number} · {c.name}</td><td><StatusBadge state={c.state} size="sm" /></td><td className="text-slate-400">{fmtTime(c.stateSince)}</td><td className="text-xs text-slate-400">{c.reason}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
