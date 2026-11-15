import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Map, TrainFront, Bell, BarChart3, ShieldCheck, Settings, FlaskConical, Menu, X, Wifi, WifiOff, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { useLiveData } from '../context/LiveDataContext';
import { useNotifications } from '../context/NotificationContext';
import { ModeBadge } from './ui';
import { ago } from '../lib/format';
import { DISCLAIMER } from '../lib/constants';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/map', label: 'Live Map', icon: Map },
  { to: '/trains', label: 'Trains', icon: TrainFront },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/simulation', label: 'Simulation', icon: FlaskConical },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings }
];

function Toasts() {
  const { toasts, dismiss } = useNotifications();
  const tone = { CRITICAL: 'border-rose-500/60 bg-rose-950/90', WARNING: 'border-amber-500/60 bg-amber-950/90', INFO: 'border-sky-500/60 bg-sky-950/90', SUCCESS: 'border-emerald-500/60 bg-emerald-950/90' };
  return (
    <div className="fixed bottom-4 right-4 z-[2000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-xl border p-3 shadow-xl backdrop-blur ${tone[t.severity] || tone.INFO}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-slate-100">{t.simulated && <span className="mr-1 text-fuchsia-300">[SIM]</span>}{t.title}</div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-white" aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
          <p className="mt-1 text-xs text-slate-300">{t.message}</p>
        </div>
      ))}
    </div>
  );
}

export default function Layout({ children }) {
  const { mode, connected, isStale, lastMessageAt, now, system, error } = useLiveData();
  const { prefs, update } = useNotifications();
  const [open, setOpen] = useState(false);
  const feed = system && system.feed && system.feed.railRadar;
  const liveFeedProblem = mode === 'LIVE' && feed && (feed.authFailed || feed.remainingQuota === 0 || (feed.lastError && !feed.lastSuccessAt));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[1000] border-b border-white/5 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-100">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/20 text-sky-300"><TrainFront className="w-5 h-5" /></span>
            <span>Smart<span className="text-sky-400">Cross</span></span>
          </Link>
          <ModeBadge mode={mode} />
          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm ${isActive ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                <n.icon className="w-4 h-4" />{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => update({ muted: !prefs.muted })} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5" title={prefs.muted ? 'Unmute alerts' : 'Mute alerts'} aria-label="Toggle mute">
              {prefs.muted || !prefs.sound ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${connected && !isStale ? 'text-emerald-300' : 'text-amber-300'}`} title={`Last update ${ago(lastMessageAt, now)}`}>
              {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{connected ? (isStale ? 'Stale' : 'Live') : 'Reconnecting'}</span>
            </span>
            <button type="button" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
          </div>
        </div>
        {open && (
          <nav className="grid grid-cols-2 gap-1 border-t border-white/5 p-2 lg:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-sky-500/15 text-sky-300' : 'text-slate-300'}`}>
                <n.icon className="w-4 h-4" />{n.label}
              </NavLink>
            ))}
          </nav>
        )}
        {mode === 'SIMULATION' && (
          <div className="bg-fuchsia-600/20 px-4 py-1 text-center text-xs text-fuchsia-200">
            Simulation mode: every train, prediction and alert shown is <b>simulated</b>, not real.
            {system && system.liveAvailable ? ' Stop the simulation to return to live data.' : ' No RailRadar API key is configured, so live mode is unavailable.'}
          </div>
        )}
        {(!connected || isStale) && (
          <div className="flex items-center justify-center gap-1.5 bg-amber-500/15 px-4 py-1 text-center text-xs text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {connected ? 'Data may be stale: no update received recently.' : 'Real-time connection lost; retrying. Showing last received data.'} Last update {ago(lastMessageAt, now)}.
          </div>
        )}
        {liveFeedProblem && (
          <div className="bg-amber-500/15 px-4 py-1 text-center text-xs text-amber-200">
            Live train feed problem ({feed.authFailed ? 'authentication failed' : feed.remainingQuota === 0 ? 'quota exhausted' : feed.lastError}). Predictions are falling back to timetable estimates.
          </div>
        )}
        {error && !connected && <div className="bg-rose-500/15 px-4 py-1 text-center text-xs text-rose-200">Backend unreachable: {error}</div>}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">{children}</main>
      <footer className="border-t border-white/5 px-4 py-4 text-center text-xs text-slate-500">
        {DISCLAIMER} Coverage: monitored passenger trains only; unscheduled or freight trains are not predicted. Map data © OpenStreetMap contributors.
      </footer>
      <Toasts />
    </div>
  );
}
