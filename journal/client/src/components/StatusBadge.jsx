import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Bell, HelpCircle } from 'lucide-react';

export const StatusBadge = ({ status, size = 'md' }) => {
  const s = (status || 'UNKNOWN').toUpperCase();

  const configs = {
    OPEN: {
      label: 'OPEN',
      bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
      icon: CheckCircle2,
      pulse: false
    },
    CLOSING_SOON: {
      label: 'CLOSING SOON',
      bg: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
      icon: AlertTriangle,
      pulse: 'animate-pulse'
    },
    CLOSED: {
      label: 'CLOSED',
      bg: 'bg-rose-500/20 border-rose-500/60 text-rose-300',
      icon: ShieldAlert,
      pulse: 'pulse-danger'
    },
    OPENING_SOON: {
      label: 'OPENING SOON',
      bg: 'bg-sky-500/20 border-sky-500/50 text-sky-300',
      icon: Bell,
      pulse: 'animate-pulse'
    },
    UNKNOWN: {
      label: 'UNKNOWN',
      bg: 'bg-slate-700/40 border-slate-600/40 text-slate-400',
      icon: HelpCircle,
      pulse: false
    }
  };

  const current = configs[s] || configs.UNKNOWN;
  const Icon = current.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs md:text-sm px-3 py-1 gap-1.5 font-semibold',
    lg: 'text-sm md:text-base px-4 py-2 gap-2 font-bold tracking-wide'
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm transition-all duration-300 ${current.bg} ${sizeClasses[size] || sizeClasses.md} ${current.pulse || ''}`}
    >
      <Icon className={size === 'lg' ? 'w-5 h-5' : size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      <span>{current.label}</span>
    </span>
  );
};

export default StatusBadge;
