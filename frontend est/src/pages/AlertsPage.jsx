import React, { useEffect, useState } from 'react';
import { Bell, Volume2, BellRing } from 'lucide-react';
import { useLiveData } from '../context/LiveDataContext';
import { useNotifications } from '../context/NotificationContext';
import { Panel, Empty, Button, inputCls, ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';

const SEV = { CRITICAL: 'border-rose-500/50 bg-rose-500/10', WARNING: 'border-amber-500/50 bg-amber-500/10', INFO: 'border-sky-500/50 bg-sky-500/10', SUCCESS: 'border-emerald-500/50 bg-emerald-500/10' };

export default function AlertsPage() {
  const { alerts: liveAlerts, mode } = useLiveData();
  const { prefs, update, playSound, permission, requestBrowserPermission } = useNotifications();
  const [filter, setFilter] = useState({ type: '', phatak: '' });
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = { limit: 200 };
    if (filter.type) params.type = filter.type;
    if (filter.phatak) params.phatak = filter.phatak;
    api.alerts(params).then(setHistory).catch((e) => setError(e.message));
  }, [filter, mode, liveAlerts.length]);

  const list = history || [];
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Alerts & notifications</h1><p className="text-sm text-slate-400">Alerts are generated only when a predicted state changes; identical alerts are suppressed. Showing {mode === 'SIMULATION' ? 'simulated' : 'live'} alerts.</p></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Notification controls" icon={BellRing}>
          <div className="space-y-3 text-sm">
            <label className="flex items-center justify-between">Audio alerts<input type="checkbox" checked={prefs.sound} onChange={(e) => update({ sound: e.target.checked })} /></label>
            <label className="flex items-center justify-between">Mute<input type="checkbox" checked={prefs.muted} onChange={(e) => update({ muted: e.target.checked })} /></label>
            <label className="block">Volume <span className="text-xs text-slate-500">{Math.round(prefs.volume * 100)}%</span>
              <input type="range" min="0" max="1" step="0.05" value={prefs.volume} onChange={(e) => update({ volume: Number(e.target.value) })} className="w-full" />
            </label>
            <Button onClick={() => playSound('critical', true)}><Volume2 className="w-4 h-4" />Test sound</Button>
            <div className="border-t border-white/5 pt-3">
              <div className="flex items-center justify-between">Browser notifications<input type="checkbox" checked={prefs.browser} disabled={permission !== 'granted'} onChange={(e) => update({ browser: e.target.checked })} /></div>
              {permission !== 'granted' && <Button className="mt-2" onClick={requestBrowserPermission} disabled={permission === 'unsupported' || permission === 'denied'}>{permission === 'denied' ? 'Blocked in browser settings' : permission === 'unsupported' ? 'Not supported' : 'Allow browser notifications'}</Button>}
              <p className="mt-1 text-xs text-slate-500">Browser notifications appear when this tab is in the background.</p>
            </div>
            <label className="block border-t border-white/5 pt-3">Advance warning (minutes before predicted arrival)
              <input type="number" min="1" max="60" className={`${inputCls} mt-1`} value={prefs.warningMinutes} onChange={(e) => update({ warningMinutes: Math.min(60, Math.max(1, Number(e.target.value) || 10)) })} />
            </label>
            <div>
              <div className="mb-1">Severities to notify</div>
              {Object.keys(prefs.severities).map((s) => (
                <label key={s} className="mr-3 inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={prefs.severities[s]} onChange={(e) => update({ severities: { ...prefs.severities, [s]: e.target.checked } })} />{s}</label>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title="Alert history" icon={Bell} className="lg:col-span-2" actions={
          <div className="flex gap-2">
            <select className={`${inputCls} w-auto`} value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} aria-label="Type filter">
              <option value="">All types</option><option value="GATE_STATUS_CHANGE">Gate state</option><option value="GROUPED_CLOSURE">Grouped</option><option value="SYSTEM_WARNING">System</option>
            </select>
            <select className={`${inputCls} w-auto`} value={filter.phatak} onChange={(e) => setFilter({ ...filter, phatak: e.target.value })} aria-label="Crossing filter">
              <option value="">All crossings</option>{[19, 20, 23, 24].map((n) => <option key={n} value={n}>Phatak {n}</option>)}
            </select>
          </div>
        }>
          <ErrorBox error={error} />
          {list.length === 0 ? <Empty>No alerts match.</Empty> : (
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
              {list.map((a) => (
                <li key={a._id} className={`rounded-lg border p-3 ${SEV[a.severity]}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-slate-100">{a.mode === 'SIMULATION' && <span className="mr-1 text-fuchsia-300">[SIM]</span>}{a.title}</span><span className="text-xs text-slate-400">{fmtDateTime(a.createdAt)}</span></div>
                  <p className="mt-1 text-sm text-slate-300">{a.message}</p>
                  <div className="mt-1 text-[11px] text-slate-500">{a.type.replace(/_/g, ' ').toLowerCase()} · {a.severity}{a.trainNumber ? ` · train ${a.trainNumber}` : ''}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
