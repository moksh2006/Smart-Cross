import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, TrainFront, ListOrdered, History } from 'lucide-react';
import { useLiveData } from '../context/LiveDataContext';
import { useAuth } from '../context/AuthContext';
import Countdown from '../components/Countdown';
import { Panel, ConfidenceBadge, SourceBadge, StatusBadge, Empty, Spinner, ErrorBox, Button } from '../components/ui';
import { api } from '../lib/api';
import { DIRECTION_META, CORRIDOR_STATUS } from '../lib/constants';
import { fmtTime, fmtDistance, fmtDuration, fmtDateTime, ago } from '../lib/format';

export default function TrainDetailPage() {
  const { number } = useParams();
  const { trains, now, mode } = useLiveData();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const live = trains.find((t) => t.trainNumber === number);

  const load = useCallback(() => api.train(number).then(setData).catch((e) => setError(e.message)), [number]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const refresh = async () => {
    setMsg(null);
    try { const r = await api.refreshTrain(number); setMsg(`Live fetch result: ${r.result}${r.ingest ? ` (${r.ingest})` : ''}`); load(); } catch (e) { setMsg(e.message); }
  };

  if (error && !data) return <div className="space-y-3"><Link to="/trains" className="text-sky-300">← Trains</Link><ErrorBox error={error} /></div>;
  if (!data) return <Spinner />;
  const t = live || data.train;

  return (
    <div className="space-y-5">
      <Link to="/trains" className="inline-flex items-center gap-1 text-sm text-sky-300 hover:underline"><ArrowLeft className="w-4 h-4" />Trains</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Train {number}</h1><p className="text-sm text-slate-400">{t ? t.trainName : data.schedule && data.schedule.trainName} · {DIRECTION_META[(t && t.direction) || (data.schedule && data.schedule.direction)]?.label}</p></div>
        {isAdmin && mode === 'LIVE' && !number.startsWith('SIM-') && <Button onClick={refresh}><RefreshCw className="w-4 h-4" />Fetch live now (uses 1 API call)</Button>}
      </div>
      {msg && <div className="rounded-lg bg-slate-800 p-2 text-sm">{msg}</div>}
      {t ? (
        <Panel title="Current state" icon={TrainFront}>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><div className="text-xs text-slate-500">Prediction basis</div><div className="mt-1 space-x-1"><SourceBadge source={t.source} simulated={t.isSimulated} /><ConfidenceBadge confidence={t.confidence} /></div><div className="mt-1 text-xs text-slate-400">{t.reason}</div></div>
            <div><div className="text-xs text-slate-500">Corridor status</div><div className="font-semibold">{CORRIDOR_STATUS[t.corridorStatus]}</div><div className="text-xs text-slate-400">Position {t.positionChainage !== null ? `${(t.positionChainage / 1000).toFixed(2)} km from PTA` : 'unavailable'}</div></div>
            <div><div className="text-xs text-slate-500">Speed / delay</div><div className="font-semibold">{t.measuredSpeedKmh ?? '—'} km/h · {t.delayMinutes ?? '—'} min late</div><div className="text-xs text-slate-400">Effective speed {t.effectiveSpeedKmh ?? '—'} km/h</div></div>
            <div><div className="text-xs text-slate-500">Last observation</div><div className={`font-semibold ${t.isStale ? 'text-amber-300' : ''}`}>{t.observedAt ? ago(t.observedAt, now) : 'none'}</div><div className="text-xs text-slate-400">{t.dataSource} · {t.positionMethod || '—'}</div></div>
          </div>
        </Panel>
      ) : <Empty>This train is not currently tracked (outside its timetable window).</Empty>}

      <Panel title="Predictions per crossing" icon={ListOrdered} bodyClass="p-0">
        {data.predictions.length === 0 ? <div className="p-4"><Empty>No active predictions.</Empty></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-slate-500"><tr className="border-b border-white/5"><th className="px-4 py-2">Phatak</th><th>Status</th><th>Impact</th><th>Arrival</th><th>In</th><th>Distance</th><th>Closure window</th><th>Basis</th></tr></thead>
              <tbody>
                {data.predictions.map((p) => (
                  <tr key={p.phatakNumber} className="border-b border-white/5">
                    <td className="px-4 py-2"><Link className="text-sky-300 hover:underline" to={`/crossings/${p.phatakNumber}`}>{p.phatakNumber}</Link></td>
                    <td className="text-xs">{p.status}</td>
                    <td>{p.impact ? <StatusBadge state={p.impact} size="sm" /> : '—'}</td>
                    <td>{fmtTime(p.predictedArrival)}</td>
                    <td>{p.status === 'APPROACHING' ? <Countdown to={p.predictedArrival} /> : '—'}</td>
                    <td>{fmtDistance(p.distanceMeters)}</td>
                    <td className="text-xs">{fmtTime(p.predictedClosureStart)}–{fmtTime(p.predictedReopen)} ({fmtDuration(p.closureDurationSeconds)})</td>
                    <td className="space-x-1 whitespace-nowrap"><SourceBadge source={p.source} simulated={p.isSimulated} /><ConfidenceBadge confidence={p.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Timetable" icon={ListOrdered} bodyClass="p-0">
          {!data.schedule ? <div className="p-4"><Empty>{number.startsWith('SIM-') ? 'Simulated trains use a synthetic schedule.' : 'No timetable available.'}</Empty></div> : (
            <>
              <div className="px-4 pt-3 text-xs">{data.schedule.source === 'RAILRADAR_API' ? <span className="text-emerald-300">Source: RailRadar API</span> : <span className="text-amber-300">Source: bundled timetable (not verified against an official source)</span>}</div>
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-xs text-slate-500"><tr className="border-b border-white/5"><th className="px-4 py-2">Station</th><th>Arr</th><th>Dep</th><th>Day</th><th>km</th></tr></thead>
                <tbody>
                  {data.schedule.stops.map((s) => (
                    <tr key={s.stationCode} className={`border-b border-white/5 ${['PTA', 'DBN'].includes(s.stationCode) ? 'bg-sky-500/5 font-semibold' : ''}`}><td className="px-4 py-1.5">{s.stationName} ({s.stationCode})</td><td>{s.arrivalTime || '—'}</td><td>{s.departureTime || '—'}</td><td>{(s.dayOffset || 0) + 1}</td><td>{s.distanceKm ?? '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Panel>
        <Panel title="Recent live observations" icon={History} bodyClass="p-0">
          {data.recentObservations.length === 0 ? <div className="p-4"><Empty>No live observations recorded for this train.</Empty></div> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr className="border-b border-white/5"><th className="px-4 py-2">Observed</th><th>km from PTA</th><th>Method</th><th>Speed</th><th>Delay</th></tr></thead>
              <tbody>
                {data.recentObservations.map((o) => (
                  <tr key={o.observedAt} className="border-b border-white/5"><td className="px-4 py-1.5">{fmtDateTime(o.observedAt)}</td><td>{o.chainageMeters !== null ? (o.chainageMeters / 1000).toFixed(2) : '—'}</td><td className="text-xs">{o.positionMethod}</td><td>{o.speedKmh ?? '—'}</td><td>{o.delayMinutes ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {data.pollingPlan && <div className="border-t border-white/5 p-3 text-xs text-slate-400">Polling window {fmtTime(data.pollingPlan.pollStart)}–{fmtTime(data.pollingPlan.pollEnd)} · interval {data.pollingPlan.intervalSeconds ? `${data.pollingPlan.intervalSeconds}s` : 'idle'} · last result {data.pollingPlan.lastResult || '—'}</div>}
        </Panel>
      </div>
    </div>
  );
}
