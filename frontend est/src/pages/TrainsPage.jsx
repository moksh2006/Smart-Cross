import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrainFront, CalendarClock } from 'lucide-react';
import { useLiveData } from '../context/LiveDataContext';
import Countdown from '../components/Countdown';
import { Panel, ConfidenceBadge, SourceBadge, Empty, ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { DIRECTION_META, CORRIDOR_STATUS } from '../lib/constants';
import { fmtTime, fmtDistance, ago } from '../lib/format';

export default function TrainsPage() {
  const { trains, mode, now } = useLiveData();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.trains().then((d) => alive && setList(d)).catch((e) => alive && setError(e.message));
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [mode]);

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Train monitoring</h1><p className="text-sm text-slate-400">Trains currently tracked by the prediction engine and, in live mode, today's monitored timetable.</p></div>
      <ErrorBox error={error} />
      <Panel title={`Tracked trains (${trains.length})`} icon={TrainFront} bodyClass="p-0">
        {trains.length === 0 ? <div className="p-4"><Empty>{mode === 'SIMULATION' ? 'No simulated trains. Start one from the Simulation page.' : 'No monitored train is within its tracking window right now.'}</Empty></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs text-slate-500"><tr className="border-b border-white/5"><th className="px-4 py-2">Train</th><th>Direction</th><th>Status</th><th>Speed</th><th>Delay</th><th>Next crossing</th><th>Data</th><th>Basis</th></tr></thead>
              <tbody>
                {trains.map((t) => (
                  <tr key={t.trainNumber} className="border-b border-white/5 align-top">
                    <td className="px-4 py-2"><Link to={`/trains/${encodeURIComponent(t.trainNumber)}`} className="font-semibold text-sky-300 hover:underline">{t.trainNumber}</Link><div className="text-xs text-slate-500">{t.trainName}</div></td>
                    <td>{DIRECTION_META[t.direction]?.short}</td>
                    <td className="text-xs">{CORRIDOR_STATUS[t.corridorStatus]}</td>
                    <td>{t.measuredSpeedKmh !== null ? `${t.measuredSpeedKmh} km/h` : '—'}{t.stopped && <div className="text-xs text-amber-300">stopped</div>}</td>
                    <td>{t.delayMinutes !== null ? `${t.delayMinutes} min` : '—'}</td>
                    <td>{t.nextCrossing ? <span>Phatak {t.nextCrossing.phatakNumber} · <Countdown to={t.nextCrossing.predictedArrival} /><div className="text-xs text-slate-500">{fmtDistance(t.nextCrossing.distanceMeters)}</div></span> : '—'}</td>
                    <td className="text-xs">{t.observedAt ? <span className={t.isStale ? 'text-amber-300' : 'text-slate-300'}>{ago(t.observedAt, now)}{t.isStale && ' (stale)'}</span> : <span className="text-slate-500">no live data</span>}</td>
                    <td className="space-x-1 whitespace-nowrap"><SourceBadge source={t.source} simulated={t.isSimulated} /><ConfidenceBadge confidence={t.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {mode === 'LIVE' && (
        <Panel title="Monitored timetable (nearest corridor passage)" icon={CalendarClock} bodyClass="p-0">
          {!list ? <div className="p-4 text-sm text-slate-500">Loading…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-slate-500"><tr className="border-b border-white/5"><th className="px-4 py-2">Train</th><th>Direction</th><th>Corridor entry</th><th>Exit</th><th>Timetable source</th><th>Tracked</th></tr></thead>
                <tbody>
                  {[...list.monitored].sort((a, b) => new Date(a.scheduledEntry) - new Date(b.scheduledEntry)).map((t) => (
                    <tr key={t.trainNumber} className="border-b border-white/5">
                      <td className="px-4 py-2"><Link to={`/trains/${t.trainNumber}`} className="text-sky-300 hover:underline">{t.trainNumber}</Link> <span className="text-xs text-slate-500">{t.trainName}</span></td>
                      <td>{DIRECTION_META[t.direction]?.short}</td>
                      <td>{fmtTime(t.scheduledEntry)}</td>
                      <td>{fmtTime(t.scheduledExit)}</td>
                      <td className="text-xs">{t.scheduleSource === 'RAILRADAR_API' ? 'RailRadar API' : <span className="text-amber-300">Bundled (unverified)</span>}</td>
                      <td>{t.tracked ? 'yes' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
