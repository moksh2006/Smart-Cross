import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Bell, HelpCircle, Loader2, FlaskConical, Radio } from 'lucide-react';
import { STATE_META, SOURCE_META, CONFIDENCE_META } from '../lib/constants';

const STATE_ICON = { OPEN: CheckCircle2, CLOSING_SOON: AlertTriangle, CLOSED: ShieldAlert, OPENING_SOON: Bell, UNKNOWN: HelpCircle };

export function StatusBadge({ state = 'UNKNOWN', size = 'md', pending }) {
  const m = STATE_META[state] || STATE_META.UNKNOWN;
  const Icon = STATE_ICON[state] || HelpCircle;
  const pulse = state === 'CLOSED' ? 'pulse-danger' : state === 'CLOSING_SOON' ? 'pulse-warn' : '';
  const sz = size === 'lg' ? 'text-base px-4 py-2 gap-2' : size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${m.bg} ${m.border} ${m.text} ${sz} ${pulse}`} title={m.long}>
      <Icon className={size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
      {m.label}
      {pending && pending !== state && <span className="normal-case font-normal opacity-70">(→ {STATE_META[pending]?.label})</span>}
    </span>
  );
}

export function ConfidenceBadge({ confidence = 'NONE' }) {
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${CONFIDENCE_META[confidence] || CONFIDENCE_META.NONE}`}>{confidence === 'NONE' ? 'NO DATA' : `${confidence} CONF.`}</span>;
}

export function SourceBadge({ source = 'UNKNOWN', simulated }) {
  const m = SOURCE_META[source] || SOURCE_META.UNKNOWN;
  const live = m.level <= 2;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${live ? 'border-sky-500/40 text-sky-300 bg-sky-500/10' : 'border-slate-500/40 text-slate-300 bg-slate-600/20'}`} title={m.label}>
      {simulated ? <FlaskConical className="w-3 h-3" /> : live ? <Radio className="w-3 h-3" /> : null}
      {simulated && live ? `${m.short} (sim)` : m.short}
    </span>
  );
}

export function ModeBadge({ mode }) {
  if (!mode) return null;
  return mode === 'SIMULATION'
    ? <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/50 bg-fuchsia-500/15 px-2.5 py-0.5 text-xs font-bold text-fuchsia-300"><FlaskConical className="w-3.5 h-3.5" />SIMULATION</span>
    : <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300"><Radio className="w-3.5 h-3.5" />LIVE</span>;
}

export function DataKindBadge({ kind }) {
  const map = {
    RECORDED: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
    PREDICTED: 'border-sky-500/40 text-sky-300 bg-sky-500/10',
    ESTIMATED: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    API_LOG: 'border-slate-500/40 text-slate-300 bg-slate-600/20'
  };
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${map[kind] || map.API_LOG}`}>{kind}</span>;
}

export function Panel({ title, icon: Icon, actions, children, className = '', bodyClass = 'p-4' }) {
  return (
    <section className={`glass-panel rounded-2xl ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">{Icon && <Icon className="w-4 h-4 text-sky-400" />}{title}</h2>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'text-slate-100' }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between text-xs text-slate-400">{label}{Icon && <Icon className="w-4 h-4" />}</div>
      <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function Spinner({ label = 'Loading…' }) {
  return <div className="flex items-center justify-center gap-2 p-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" />{label}</div>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{String(error)}</div>;
}

export function Button({ children, variant = 'default', className = '', ...props }) {
  const v = {
    default: 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-100',
    primary: 'bg-sky-600 hover:bg-sky-500 border-sky-500 text-white',
    danger: 'bg-rose-600/80 hover:bg-rose-500 border-rose-500 text-white',
    ghost: 'bg-transparent hover:bg-white/5 border-transparent text-slate-300'
  }[variant];
  return <button type="button" className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`} {...props}>{children}</button>;
}

export const inputCls = 'w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none';
