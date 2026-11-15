import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Gauge, CalendarClock, SlidersHorizontal, ScrollText, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLiveData } from '../context/LiveDataContext';
import LoginGate from '../components/LoginGate';
import { Panel, StatCard, Button, inputCls, ErrorBox, ModeBadge } from '../components/ui';
import { api } from '../lib/api';
import { fmtTime, fmtDateTime, ago } from '../lib/format';
import { DIRECTION_META } from '../lib/constants';

function ThresholdEditor({ onChanged }) {
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api.settings().then(setData), []);
  useEffect(() => { load(); }, [load]);
  const save = async (key) => {
    setMsg(null);
    try { setData(await api.updateSetting(key, Number(edits[key]))); setEdits((e) => { const n = { ...e }; delete n[key]; return n; }); setMsg(`${key} saved`); onChanged && onChanged(); } catch (e) { setMsg(e.message); }
  };
  const reset = async (key) => { try { setData(await api.resetSetting(key)); setMsg(`${key} reset to default`); } catch (e) { setMsg(e.message); } };
  if (!data) return <div className="text-sm text-slate-500">Loading…</div>;
  return (
    <div>
      <p className="mb-2 text-xs text-amber-200/80">{data.note}</p>
      {msg && <div className="mb-2 rounded bg-slate-800 p-2 text-xs">{msg}</div>}
      <div className="max-h-[480px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500"><tr><th>Setting</th><th>Value</th><th>Default</th><th /></tr></thead>
          <tbody>
            {data.thresholds.map((t) => (
              <tr key={t.key} className="border-t border-white/5">
                <td className="py-1.5 pr-2"><div className="font-mono text-slate-200">{t.key}</div><div className="text-slate-500">{t.description} [{t.min}–{t.max}]</div></td>
                <td><input type="number" step="any" min={t.min} max={t.max} className={`${inputCls} w-24`} value={edits[t.key] ?? t.value} onChange={(e) => setEdits({ ...edits, [t.key]: e.target.value })} aria-label={t.key} /></td>
                <td className="text-slate-500">{t.default}</td>
                <td className="whitespace-nowrap">
                  <Button className="px-2 py-1 text-xs" disabled={edits[t.key] === undefined} onClick={() => save(t.key)}>Save</Button>
                  {t.value !== t.default && <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => reset(t.key)}>Reset</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminInner() {
  const { logout } = useAuth();
  const { mode, system } = useLiveData();
  const [metrics, setMetrics] = useState(null);
  const [sched, setSched] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logCat, setLogCat] = useState('EXTERNAL_API');
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const [m, s, l] = await Promise.all([api.metrics(), api.scheduler(), api.apiLogs(logCat, 100)]);
      setMetrics(m); setSched(s); setLogs(l); setError(null);
    } catch (e) { setError(e.message); }
  }, [logCat]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const switchMode = async (m) => { setMsg(null); try { await api.setMode(m); setMsg(`Mode switched to ${m}`); load(); } catch (e) { setMsg(e.message); } };
  const recalc = async () => { try { await api.recalculate(); setMsg('Predictions recalculated'); } catch (e) { setMsg(e.message); } };
  const rr = metrics && metrics.railRadar;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Admin dashboard</h1><p className="text-sm text-slate-400">System health, API quota, polling plan and configuration.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={recalc}><RefreshCw className="w-4 h-4" />Recalculate now</Button>
          <Button variant="ghost" onClick={logout}><LogOut className="w-4 h-4" />Sign out</Button>
        </div>
      </div>
      <ErrorBox error={error} />
      {msg && <div className="rounded-lg bg-slate-800 p-2 text-sm">{msg}</div>}
      <Panel title="Data mode" icon={ShieldCheck}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          Current: <ModeBadge mode={mode} />
          <Button disabled={mode === 'LIVE' || !(system && system.liveAvailable)} onClick={() => switchMode('LIVE')}>Switch to LIVE</Button>
          <Button disabled={mode === 'SIMULATION'} onClick={() => switchMode('SIMULATION')}>Switch to SIMULATION</Button>
          {!(system && system.liveAvailable) && <span className="text-xs text-amber-300">LIVE needs RAILRADAR_API_KEY on the server.</span>}
        </div>
        <p className="mt-2 text-xs text-slate-500">Switching mode clears all tracked trains and resets crossing states. Live and simulated data are never mixed.</p>
      </Panel>
      {metrics && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <StatCard label="API calls (24 h)" value={metrics.last24h.apiCalls} sub={`${metrics.last24h.apiFailures} failed`} icon={Gauge} />
          <StatCard label="Quota remaining" value={rr.configured ? rr.remainingQuota : 'n/a'} sub={`of ${rr.monthlyQuota}/period${rr.headerLimitMonth ? ` (API says ${rr.headerLimitMonth})` : ''}`} />
          <StatCard label="Daily budget" value={rr.configured ? `${rr.callsToday}/${rr.dailyBudget}` : 'n/a'} sub="calls today / budget" />
          <StatCard label="Gate transitions (24 h)" value={metrics.last24h.gateEvents} sub={`${metrics.last24h.alerts} alerts`} />
          <StatCard label="Observed passages (24 h)" value={metrics.last24h.passages} sub={`${metrics.last24h.evaluations} evaluations`} />
          <StatCard label="Socket clients" value={metrics.sockets.clients} sub={`engine seq ${metrics.engine.seq}`} />
        </div>
      )}
      {rr && (
        <Panel title="RailRadar integration" icon={Gauge}>
          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>API key: <b className={rr.configured ? 'text-emerald-300' : 'text-amber-300'}>{rr.configured ? 'configured' : 'not configured (simulation only)'}</b></div>
            <div>Last success: <b>{rr.lastSuccessAt ? ago(rr.lastSuccessAt) : 'never'}</b></div>
            <div>Last error: <b>{rr.lastError || '—'}</b> {rr.lastStatus ? `(HTTP ${rr.lastStatus})` : ''}</div>
            <div>Cooldown: <b>{rr.cooldownUntil ? fmtTime(rr.cooldownUntil, true) : 'none'}</b> · auth {rr.authFailed ? <b className="text-rose-300">failed</b> : 'ok'}</div>
            <div>Calls this minute: <b>{rr.callsLastMinute}/{rr.perMinuteLimit}</b></div>
            <div>Billing period from: <b>{fmtDateTime(rr.billingPeriodStart)}</b></div>
          </div>
        </Panel>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Polling plan (live mode)" icon={CalendarClock} bodyClass="p-0">
          {!sched || sched.plans.length === 0 ? <div className="p-4 text-sm text-slate-500">{mode === 'LIVE' ? 'No plans yet.' : 'The scheduler only runs in LIVE mode.'}</div> : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="sticky top-0 bg-slate-900 text-left text-slate-500"><tr><th className="px-3 py-2">Train</th><th>Dir</th><th>Expected entry</th><th>Poll window</th><th>Interval</th><th>Last poll</th><th>Result</th><th /></tr></thead>
                <tbody>
                  {sched.plans.map((p) => (
                    <tr key={p.trainNumber} className="border-t border-white/5">
                      <td className="px-3 py-1.5">{p.trainNumber}{!p.scheduleVerified && <span className="ml-1 text-amber-300" title="Bundled timetable (unverified)">*</span>}</td>
                      <td>{DIRECTION_META[p.direction]?.short || '—'}</td>
                      <td>{fmtTime(p.expectedEntry)}</td>
                      <td>{fmtTime(p.pollStart)}–{fmtTime(p.pollEnd)}</td>
                      <td>{p.intervalSeconds ? `${p.intervalSeconds}s` : 'idle'}</td>
                      <td>{p.lastPolledAt ? ago(p.lastPolledAt) : '—'}</td>
                      <td>{p.lastResult || p.error || '—'}</td>
                      <td><Button className="px-2 py-0.5 text-[11px]" disabled={mode !== 'LIVE'} onClick={async () => { try { const r = await api.refreshTrain(p.trainNumber); setMsg(`${p.trainNumber}: ${r.result}`); load(); } catch (e) { setMsg(e.message); } }}>Poll</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-3 text-[11px] text-slate-500">* bundled timetable, not verified. Manual polls consume API quota.</p>
            </div>
          )}
        </Panel>
        <Panel title="Prediction thresholds" icon={SlidersHorizontal}><ThresholdEditor onChanged={load} /></Panel>
      </div>
      <Panel title="Logs" icon={ScrollText} bodyClass="p-0" actions={
        <select className={`${inputCls} w-auto`} value={logCat} onChange={(e) => setLogCat(e.target.value)} aria-label="Log category"><option value="EXTERNAL_API">External API calls</option><option value="ADMIN_ACTION">Admin actions</option></select>
      }>
        {logs.length === 0 ? <div className="p-4 text-sm text-slate-500">No log entries.</div> : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="sticky top-0 bg-slate-900 text-left text-slate-500"><tr><th className="px-3 py-2">Time</th><th>Action</th><th>Endpoint / details</th><th>Train</th><th>Status</th><th>Latency</th></tr></thead>
              <tbody>{logs.map((l) => (
                <tr key={l._id} className="border-t border-white/5"><td className="px-3 py-1">{fmtDateTime(l.createdAt)}</td><td>{l.action}</td><td className="font-mono">{l.endpoint || (l.details ? JSON.stringify(l.details) : '')}</td><td>{l.trainNumber || '—'}</td><td className={l.success ? 'text-emerald-300' : 'text-rose-300'}>{l.httpStatus || ''} {l.errorCode || (l.success ? 'OK' : '')}</td><td>{l.latencyMs != null ? `${l.latencyMs} ms` : ''}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default function AdminPage() {
  return <LoginGate title="Admin dashboard" description="Administrator access is required to change modes and thresholds and to see API usage."><AdminInner /></LoginGate>;
}
