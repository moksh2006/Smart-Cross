import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, History, Layers, TrainFront, Bell } from 'lucide-react';
import { useLiveData } from '../context/LiveDataContext';
import CorridorMap from '../components/CorridorMap';
import Countdown from '../components/Countdown';
import { Panel, StatusBadge, ConfidenceBadge, SourceBadge, Empty, Spinner, ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { DIRECTION_META, STATE_META, DISCLAIMER } from '../lib/constants';
import { fmtTime, fmtDistance, fmtDuration, fmtDateTime, ago } from '../lib/format';

export default function CrossingDetailPage() {
  const number = Number(useParams().number);
  const { crossings, now, mode } = useLiveData();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const c = crossings.find((x) => x.number === number);

  useEffect(() => {
    let alive = true;
    const load = () => api.phatak(number).then((d) => alive && setDetail(d)).catch((e) => alive && setError(e.message));
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [number, mode, c && c.state]);

  if (error && !detail) return <div className="space-y-3"><Link to="/" className="text-sky-300">← Dashboard</Link><ErrorBox error={error} /></div>;
  if (!c || !detail) return <Spinner />;
  const m = STATE_META[c.state];

  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-sky-300 hover:underline"><ArrowLeft className="w-4 h-4" />Dashboard</Link>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl border-l-4 p-5 lg:col-span-2" style={{ borderLeftColor: m.color }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm text-slate-400">Phatak {c.number} · Group {c.group} · {(c.chainageMeters / 1000).toFixed(2)} km from Patiala station</div>
              <h1 className="text-3xl font-bold">{c.name}</h1>
              <div className="mt-1 text-xs text-slate-500">{detail.dms.lat} {detail.dms.lon} · {c.coordinates[1].toFixed(6)}, {c.coordinates[0].toFixed(6)}</div>
            </div>
            <StatusBadge state={c.state} size="lg" pending={c.pendingState} />
          </div>
          <p className="mt-3 text-sm text-slate-300">{c.reason}</p>
          <p className="mt-1 text-xs text-slate-500">State since {fmtTime(c.stateSince, true)} ({ago(c.stateSince, now)}). {DISCLAIMER}</p>
          {c.controlling && ['APPROACHING', 'AT_CROSSING', 'PASSED', 'DUE'].includes(c.controlling.status) && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Train', <Link key="t" to={`/trains/${encodeURIComponent(c.controlling.trainNumber)}`} className="text-sky-300 hover:underline">{c.controlling.trainNumber}</Link>, DIRECTION_META[c.controlling.direction]?.short],
                ['Arrival in', <Countdown key="a" to={c.controlling.predictedArrival} />, fmtTime(c.controlling.predictedArrival)],
                ['Est. closure', fmtDuration(c.controlling.closureDurationSeconds), `${fmtTime(c.controlling.predictedClosureStart)}–${fmtTime(c.controlling.predictedReopen)}`],
                ['Reopens in', <Countdown key="r" to={c.controlling.predictedReopen} />, fmtTime(c.controlling.predictedReopen)]
              ].map(([label, value, sub]) => (
                <div key={label} className="rounded-xl bg-slate-900/60 p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-semibold">{value}</div><div className="text-xs text-slate-500">{sub}</div></div>
              ))}
            </div>
          )}
        </div>
        <CorridorMap height="320px" focusCrossing={number} selected={{ type: 'crossing', id: number }} />
      </div>

      <Panel title="All approaching trains" icon={TrainFront} bodyClass="p-0">
        {c.predictions.length === 0 ? <div className="p-4"><Empty>No train is currently predicted at this crossing.</Empty></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-slate-500"><tr className="border-b border-white/5"><th className="px-4 py-2">Train</th><th>Direction</th><th>Status</th><th>Impact</th><th>Arrival</th><th>Distance</th><th>Closure window</th><th>Basis</th></tr></thead>
              <tbody>
                {c.predictions.map((p) => (
                  <tr key={p.trainNumber} className="border-b border-white/5">
                    <td className="px-4 py-2"><Link to={`/trains/${encodeURIComponent(p.trainNumber)}`} className="text-sky-300 hover:underline">{p.trainNumber}</Link></td>
                    <td>{DIRECTION_META[p.direction]?.short}</td>
                    <td className="text-xs">{p.status}</td>
                    <td><StatusBadge state={p.impact} size="sm" /></td>
                    <td>{fmtTime(p.predictedArrival)} {p.status === 'APPROACHING' && <span className="text-xs text-slate-500">(<Countdown to={p.predictedArrival} />)</span>}</td>
                    <td>{fmtDistance(p.distanceMeters)}</td>
                    <td className="text-xs">{fmtTime(p.predictedClosureStart)}–{fmtTime(p.predictedReopen)}</td>
                    <td className="space-x-1 whitespace-nowrap"><SourceBadge source={p.source} simulated={p.isSimulated} /><ConfidenceBadge confidence={p.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={detail.groupInfo ? detail.groupInfo.name : 'Nearby crossings'} icon={Layers}>
          <ul className="space-y-2 text-sm">
            {detail.neighbours.map((n) => { const nc = crossings.find((x) => x.number === n.number); return (
              <li key={n.number} className="flex items-center justify-between"><Link to={`/crossings/${n.number}`} className="text-sky-300 hover:underline">Phatak {n.number} {nc && nc.name}</Link><StatusBadge state={nc ? nc.state : n.state} size="sm" /></li>
            ); })}
          </ul>
          {detail.advisories.length > 0 ? detail.advisories.map((a) => (
            <div key={a.id} className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-100">{a.message}<div className="mt-1"><ConfidenceBadge confidence={a.confidence} /></div></div>
          )) : <p className="mt-3 text-xs text-slate-500">No combined closure expected for this group.</p>}
        </Panel>
        <Panel title="Predicted state history" icon={History} bodyClass="p-0" className="lg:col-span-1">
          {detail.recentGateEvents.length === 0 ? <div className="p-4"><Empty>No transitions recorded yet.</Empty></div> : (
            <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto">
              {detail.recentGateEvents.map((e) => (
                <li key={e._id} className="px-4 py-2 text-xs">
                  <div className="flex items-center gap-2"><StatusBadge state={e.previousStatus} size="sm" />→<StatusBadge state={e.newStatus} size="sm" /><span className="ml-auto text-slate-500">{fmtDateTime(e.timestamp)}</span></div>
                  <div className="mt-1 text-slate-400">{e.reason}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Alerts for this crossing" icon={Bell} bodyClass="p-0">
          {detail.recentAlerts.length === 0 ? <div className="p-4"><Empty>No alerts.</Empty></div> : (
            <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto">
              {detail.recentAlerts.map((a) => <li key={a._id} className="px-4 py-2 text-xs"><div className="font-semibold text-slate-200">{a.title}</div><div className="text-slate-400">{a.message}</div><div className="text-slate-600">{fmtDateTime(a.createdAt)}</div></li>)}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
