import React from 'react';
import { Train, Gauge, AlertCircle, Compass, Clock, MapPin, RefreshCw } from 'lucide-react';

export const TrainCard = ({ train, onRefresh }) => {
  const {
    trainNumber,
    trainName,
    direction,
    speed,
    delayMinutes,
    status,
    nextPhatakNumber,
    distanceToNextPhatakMeters,
    etaToNextPhatakMinutes,
    dataSource,
    lastUpdatedAt
  } = train;

  const isPtaToDbn = direction === 'PATIALA_TO_DHABLAN';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 transition-all shadow-md">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Train className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white font-mono">{trainNumber}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isPtaToDbn
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {isPtaToDbn ? 'PTA → DBN' : 'DBN → PTA'}
              </span>
            </div>
            <h4 className="text-xs text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">
              {trainName || 'Indian Railways Train'}
            </h4>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={() => onRefresh(trainNumber)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Refresh live telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Speed & Delay Grid */}
      <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-3 text-center">
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
            <Gauge className="w-3 h-3 text-sky-400" />
            <span>Speed</span>
          </div>
          <div className="text-sm font-bold text-white font-mono mt-0.5">{speed || 0} km/h</div>
        </div>

        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span>Delay</span>
          </div>
          <div className={`text-sm font-bold font-mono mt-0.5 ${delayMinutes > 15 ? 'text-rose-400' : delayMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {delayMinutes > 0 ? `+${delayMinutes}m` : 'On-Time'}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
            <Compass className="w-3 h-3 text-indigo-400" />
            <span>Next</span>
          </div>
          <div className="text-sm font-bold text-indigo-300 font-mono mt-0.5 truncate">
            {status === 'IN_CORRIDOR' || train.inCorridor
              ? (nextPhatakNumber ? `P-${nextPhatakNumber}` : 'In Corridor')
              : status === 'APPROACHING' || train.isApproaching
              ? 'Departs Soon'
              : status === 'COMPLETED'
              ? 'Cleared'
              : 'At Station'}
          </div>
        </div>
      </div>

      {/* ETA to next phatak & Source */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
        <div className="flex items-center gap-1.5 truncate">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>ETA / Dep:</span>
          <span className="font-bold text-slate-200 truncate">
            {status === 'IN_CORRIDOR' || train.inCorridor
              ? (etaToNextPhatakMinutes ? `${etaToNextPhatakMinutes} min` : 'In transit')
              : status === 'APPROACHING' || train.isApproaching
              ? `Departs ${train.entryScheduledTime || 'soon'}`
              : status === 'COMPLETED'
              ? `Passed at ${train.exitScheduledTime || 'today'}`
              : `Departs at ${train.entryScheduledTime || '--'}`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            status === 'IN_CORRIDOR' || train.inCorridor
              ? 'bg-emerald-500/20 text-emerald-300'
              : status === 'APPROACHING' || train.isApproaching
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-slate-800 text-slate-300'
          }`}>
            {status === 'IN_CORRIDOR' || train.inCorridor
              ? 'LIVE'
              : status === 'APPROACHING'
              ? 'APPROACH'
              : status === 'COMPLETED'
              ? 'PASSED'
              : 'SCHED'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TrainCard;
