import React from 'react';
import { Gauge } from 'lucide-react';

export const PredictionConfidenceBadge = ({ confidence = 'MEDIUM', method = '' }) => {
  const c = (confidence || 'MEDIUM').toUpperCase();

  const configs = {
    HIGH: { label: 'High Confidence', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
    MEDIUM: { label: 'Medium Confidence', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
    LOW: { label: 'Low Confidence', color: 'text-slate-400 border-slate-600/30 bg-slate-800/40' }
  };

  const current = configs[c] || configs.MEDIUM;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${current.color}`}>
      <Gauge className="w-3.5 h-3.5" />
      <span>{current.label}</span>
      {method && <span className="opacity-60 text-[10px] hidden sm:inline">({method})</span>}
    </div>
  );
};

export default PredictionConfidenceBadge;
