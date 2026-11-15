import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Play, Pause, RotateCcw, Square, Plus, Trash2, WifiOff, Wifi } from 'lucide-react';
import { useLiveData } from '../context/LiveDataContext';
import LoginGate from '../components/LoginGate';
import CorridorMap from '../components/CorridorMap';
import { Panel, Button, inputCls, ErrorBox, StatusBadge, Empty, ModeBadge } from '../components/ui';
import { api } from '../lib/api';
import { DIRECTION_META } from '../lib/constants';
import { fmtTime } from '../lib/format';

const START_TYPES = [
  { id: 'BEFORE_ENTRY', label: 'Distance before corridor entry station' },
  { id: 'ENTRY_STATION', label: 'At the entry station (PTA or DBN)' },
  { id: 'BEFORE_CROSSING', label: 'Distance before a crossing' },
  { id: 'CHAINAGE', label: 'Exact position (m from Patiala station)' }
];

function AddTrainForm({ catalog, onAdded }) {
  const [form, setForm] = useState({ trainNumber: '', direction: 'PATIALA_TO_DHABLAN', speedKmh: 60, startType: 'BEFORE_ENTRY', meters: 3000, phatakNumber: 19, delayMinutes: 0, holdMinutes: 0, signalLossAfterSeconds: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pickTrain = (n) => {
    const t = catalog.find((x) => x.trainNumber === n);
    setForm((f) => ({ ...f, trainNumber: n, direction: t && t.direction !== 'UNKNOWN' ? t.direction : f.direction }));
  };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const start = { type: form.startType };
      if (form.startType !== 'ENTRY_STATION') start.meters = Number(form.meters);
      if (form.startType === 'BEFORE_CROSSING') start.phatakNumber = Number(form.phatakNumber);
      await api.sim.addTrain({
        trainNumber: form.trainNumber || undefined, direction: form.direction, speedKmh: Number(form.speedKmh),
        delayMinutes: Number(form.delayMinutes), holdMinutes: Number(form.holdMinutes), start,
        signalLossAfterSeconds: form.signalLossAfterSeconds === '' ? null : Number(form.signalLossAfterSeconds)
      });
      onAdded();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="grid gap-3 text-sm sm:grid-cols-2">
      <label>Train
        <select className={`${inputCls} mt-1`} value={form.trainNumber} onChange={(e) => pickTrain(e.target.value)}>
          <option value="">Custom / auto number</option>
          {catalog.map((t) => <option key={t.trainNumber} value={t.trainNumber}>{t.trainNumber} {t.trainName}</option>)}
        </select>
      </label>
      <label>Direction
        <select className={`${inputCls} mt-1`} value={form.direction} onChange={(e) => set('direction', e.target.value)}>
          <option value="PATIALA_TO_DHABLAN">Patiala → Dhablan (19→20→23→24)</option>
          <option value="DHABLAN_TO_PATIALA">Dhablan → Patiala (24→23→20→19)</option>
        </select>
      </label>
      <label>Speed: <b>{form.speedKmh} km/h</b>
        <input type="range" min="0" max="130" step="5" className="mt-2 w-full" value={form.speedKmh} onChange={(e) => set('speedKmh', e.target.value)} />
      </label>
      <label>Start position
        <select className={`${inputCls} mt-1`} value={form.startType} onChange={(e) => set('startType', e.target.value)}>{START_TYPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      </label>
      {form.startType !== 'ENTRY_STATION' && (
        <label>{form.startType === 'CHAINAGE' ? 'Position (m from PTA; negative = east of PTA)' : 'Distance (m)'}
          <input type="number" className={`${inputCls} mt-1`} value={form.meters} onChange={(e) => set('meters', e.target.value)} />
        </label>
      )}
      {form.startType === 'BEFORE_CROSSING' && (
        <label>Crossing
          <select className={`${inputCls} mt-1`} value={form.phatakNumber} onChange={(e) => set('phatakNumber', e.target.value)}>{[19, 20, 23, 24].map((n) => <option key={n} value={n}>Phatak {n}</option>)}</select>
        </label>
      )}
      <label>Reported delay (min)
        <input type="number" min="-60" max="600" className={`${inputCls} mt-1`} value={form.delayMinutes} onChange={(e) => set('delayMinutes', e.target.value)} />
      </label>
      <label>Hold at start before departing (min)
        <input type="number" min="0" max="60" className={`${inputCls} mt-1`} value={form.holdMinutes} onChange={(e) => set('holdMinutes', e.target.value)} />
      </label>
      <label>Lose live position after (s, optional)
        <input type="number" min="0" max="3600" className={`${inputCls} mt-1`} placeholder="never" value={form.signalLossAfterSeconds} onChange={(e) => set('signalLossAfterSeconds', e.target.value)} />
      </label>
      <div className="flex items-end"><Button type="submit" variant="primary" disabled={busy} className="w-full"><Plus className="w-4 h-4" />Add simulated train</Button></div>
      <div className="sm:col-span-2"><ErrorBox error={error} /></div>
    </form>
  );
}

function SimulationInner() {
  const { mode, crossings, groups } = useLiveData();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api.sim.status().then(setStatus).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 1500); return () => clearInterval(t); }, [load]);
  const run = (fn) => async () => { setError(null); try { await fn(); load(); } catch (e) { setError(e.message); } };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold"><FlaskConical className="w-6 h-6 text-fuchsia-400" />Simulation mode</h1>
          <p className="text-sm text-slate-400">Simulated trains are fed to the same prediction engine and state machine as live data, through a RailRadar-format mock. Everything here is labelled simulated.</p></div>
        <div className="flex flex-wrap items-center gap-2"><ModeBadge mode={mode} />
          {status && status.trains.length > 0 && (status.running
            ? <Button onClick={run(api.sim.pause)}><Pause className="w-4 h-4" />Pause</Button>
            : <Button onClick={run(api.sim.resume)}><Play className="w-4 h-4" />Resume</Button>)}
          <Button onClick={run(api.sim.reset)}><RotateCcw className="w-4 h-4" />Reset</Button>
          <Button variant="danger" onClick={run(api.sim.stop)}><Square className="w-4 h-4" />Stop simulation</Button>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <CorridorMap height="420px" />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {crossings.map((c) => <div key={c.number} className="glass-panel flex items-center justify-between rounded-xl p-3 text-sm"><span>Phatak {c.number}</span><StatusBadge state={c.state} size="sm" /></div>)}
          </div>
          {groups.length > 0 && groups.map((g) => <div key={g.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100"><b>{g.groupName}</b>: {g.message}</div>)}
        </div>
        <Panel title="Scenarios">
          {!status ? <div className="text-sm text-slate-500">Loading…</div> : (
            <div className="grid gap-2">
              {status.scenarios.map((s) => <Button key={s.id} className="justify-start text-left" onClick={run(() => api.sim.scenario(s.id))}><Play className="w-4 h-4 shrink-0 text-fuchsia-300" />{s.label}</Button>)}
              <p className="text-xs text-slate-500">Starting a scenario replaces the current simulated trains.</p>
            </div>
          )}
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Add a train"><AddTrainForm catalog={status ? status.trainCatalog : []} onAdded={load} /></Panel>
        <Panel title={`Running trains (${status ? status.trains.length : 0}/${status ? status.maxTrains : 8})`} bodyClass="p-0">
          {!status || status.trains.length === 0 ? <div className="p-4"><Empty>No simulated trains. Pick a scenario or add a train.</Empty></div> : (
            <ul className="divide-y divide-white/5">
              {status.trains.map((t) => (
                <li key={t.id} className="space-y-2 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><b>{t.trainNumber}</b> <span className="text-xs text-slate-500">{t.trainName}</span><div className="text-xs text-slate-400">{DIRECTION_META[t.direction].label} · {(t.chainage / 1000).toFixed(2)} km from PTA · {t.speedKmh} km/h{t.holding ? ` · holding until ${fmtTime(t.holdUntil, true)}` : ''}{t.finished ? ' · finished' : ''}</div></div>
                    <div className="flex gap-1">
                      <Button className="px-2 py-1 text-xs" onClick={run(() => api.sim.updateTrain(t.id, { signalLost: !t.signalLost }))} title="Toggle live position loss">{t.signalLost ? <><Wifi className="w-3.5 h-3.5" />Restore signal</> : <><WifiOff className="w-3.5 h-3.5" />Lose signal</>}</Button>
                      <Button className="px-2 py-1 text-xs" variant="danger" onClick={run(() => api.sim.removeTrain(t.id))} aria-label="Remove train"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 text-xs">Target speed <b className="w-16">{t.targetSpeedKmh} km/h</b>
                    <input type="range" min="0" max="130" step="5" value={t.targetSpeedKmh} className="flex-1" onChange={(e) => api.sim.updateTrain(t.id, { speedKmh: Number(e.target.value) }).then(load).catch((er) => setError(er.message))} />
                  </label>
                  <label className="flex items-center gap-3 text-xs">Reported delay
                    <input type="number" min="-60" max="600" className={`${inputCls} w-24`} defaultValue={t.delayMinutes} onBlur={(e) => api.sim.updateTrain(t.id, { delayMinutes: Number(e.target.value) }).then(load).catch((er) => setError(er.message))} /> min
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function SimulationPage() {
  return <LoginGate title="Simulation control" description="Controlling the simulation changes the system-wide data mode, so it requires administrator access."><SimulationInner /></LoginGate>;
}
