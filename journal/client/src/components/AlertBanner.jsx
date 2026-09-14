import React from 'react';
import { AlertTriangle, ShieldAlert, Bell, CheckCircle2, X } from 'lucide-react';

export const AlertBanner = ({ alert, onDismiss }) => {
  if (!alert) return null;

  const severityConfigs = {
    CRITICAL: {
      bg: 'bg-rose-950/80 border-rose-500/60 text-rose-200',
      iconBg: 'bg-rose-500/20 text-rose-400',
      Icon: ShieldAlert
    },
    WARNING: {
      bg: 'bg-amber-950/80 border-amber-500/60 text-amber-200',
      iconBg: 'bg-amber-500/20 text-amber-400',
      Icon: AlertTriangle
    },
    INFO: {
      bg: 'bg-sky-950/80 border-sky-500/60 text-sky-200',
      iconBg: 'bg-sky-500/20 text-sky-400',
      Icon: Bell
    },
    SUCCESS: {
      bg: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
      Icon: CheckCircle2
    }
  };

  const config = severityConfigs[alert.severity] || severityConfigs.INFO;
  const { Icon } = config;

  return (
    <div
      className={`rounded-xl border p-4 shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-300 flex items-start justify-between gap-3 ${config.bg}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${config.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-black/30">
              {alert.severity} ALERT
            </span>
            <span className="text-xs opacity-75 font-mono">
              {new Date(alert.timestamp || alert.createdAt || Date.now()).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm font-semibold mt-1 leading-snug">{alert.message}</p>
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-black/20 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default AlertBanner;
