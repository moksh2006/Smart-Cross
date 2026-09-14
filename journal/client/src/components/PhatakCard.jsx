import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Train, ArrowRight, ShieldCheck, Timer, Compass, Navigation } from 'lucide-react';
import StatusBadge from './StatusBadge';
import PredictionConfidenceBadge from './PredictionConfidenceBadge';

export const PhatakCard = ({ phatak }) => {
  const {
    number,
    name,
    currentStatus,
    activeTrainNumber,
    prediction,
    calculatedDistances,
    statusUpdatedAt
  } = phatak;

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getRelativeTime = (dateStr) => {
    if (!dateStr) return 'Just now';
    const diffSec = Math.round((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  const isClosed = currentStatus === 'CLOSED';
  const isClosing = currentStatus === 'CLOSING_SOON';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 hover:translate-y-[-2px] ${
        isClosed
          ? 'bg-slate-900/90 border-rose-500/40 shadow-lg shadow-rose-950/30'
          : isClosing
          ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-950/20'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 shadow-md'
      }`}
    >
      {/* Top Accent Stripe */}
      <div
        className={`h-1.5 w-full ${
          isClosed ? 'bg-rose-500' : isClosing ? 'bg-amber-500' : currentStatus === 'OPENING_SOON' ? 'bg-sky-500' : 'bg-emerald-500'
        }`}
      />

      <div className="p-5">
        {/* Header: Name and Status */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black tracking-tight text-white">
                Phatak {number}
              </h3>
              <span className="text-xs text-slate-400 font-mono">#{number}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{name}</p>
          </div>
          <StatusBadge status={currentStatus} size="md" />
        </div>

        {/* Train & ETA Highlights */}
        <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Train className="w-3 h-3 text-sky-400" />
              <span>Approaching</span>
            </div>
            <div className="text-base font-bold text-white mt-0.5 truncate">
              {prediction?.trainNumber || activeTrainNumber || 'No Train Imminent'}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Train ETA</span>
            </div>
            <div className="text-base font-bold text-amber-300 mt-0.5">
              {prediction && !prediction.hasPassed
                ? `${prediction.etaMinutes} min`
                : currentStatus === 'OPEN' ? 'Clear' : 'At Phatak'}
            </div>
          </div>
        </div>

        {/* Timestamps: Closure, Opening, Waiting Time */}
        <div className="space-y-2 text-xs border-t border-slate-800/70 pt-3 mb-4">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Predicted Closure:
            </span>
            <span className="font-semibold font-mono text-slate-200">
              {prediction?.predictedClosure ? formatTime(prediction.predictedClosure) : '--:--'}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Expected Opening:
            </span>
            <span className="font-semibold font-mono text-slate-200">
              {prediction?.predictedOpening ? formatTime(prediction.predictedOpening) : '--:--'}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Timer className="w-3 h-3 text-indigo-400" />
              Road Waiting Time:
            </span>
            <span className="font-bold text-indigo-300 font-mono">
              {prediction?.waitingTimeMinutes ? `~${prediction.waitingTimeMinutes} min` : '--'}
            </span>
          </div>
        </div>

        {/* Footer: Confidence, Data Source, Relative time */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400">
          <PredictionConfidenceBadge
            confidence={prediction?.confidence || 'HIGH'}
            method={prediction?.method}
          />

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
              {prediction?.dataSource || 'Live'}
            </span>
            <span>{getRelativeTime(statusUpdatedAt || prediction?.calculatedAt)}</span>
          </div>
        </div>

        {/* Details Navigation Link */}
        <Link
          to={`/phatak/${number}`}
          className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-sky-500/20 text-slate-200 hover:text-sky-300 border border-slate-700/60 hover:border-sky-500/40 text-xs font-semibold transition-all group"
        >
          <span>View Live Track & History</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
};

export default PhatakCard;
