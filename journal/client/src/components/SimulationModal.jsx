import React, { useState, useEffect } from 'react';
import { Play, Square, RotateCcw, FastForward, Gauge, X, Compass, Train, ShieldAlert } from 'lucide-react';
import { simulationApi } from '../services/api';

export const SimulationModal = ({ isOpen, onClose }) => {
  const [direction, setDirection] = useState('PATIALA_TO_DHABLAN');
  const [speedMultiplier, setSpeedMultiplier] = useState(2);
  const [trainNumber, setTrainNumber] = useState('14507');
  const [status, setStatus] = useState({ isRunning: false, currentStep: 0, totalSteps: 60 });
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await simulationApi.getStatus();
      if (res.success && res.data) {
        setStatus(res.data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const id = setInterval(fetchStatus, 1500);
      return () => clearInterval(id);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = async () => {
    setLoading(true);
    try {
      await simulationApi.start({ direction, trainNumber, speedMultiplier });
      await fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await simulationApi.stop();
      await fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await simulationApi.reset();
      await fetchStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = Math.round((status.currentStep / (status.totalSteps || 60)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 overflow-hidden">
        {/* Banner */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/30">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Interactive Simulation</span>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  DEMO MODE
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Simulate Patiala corridor train movement & automatic gate triggers
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="my-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-slate-400 font-medium">Corridor Progress</span>
            <span className="font-bold text-sky-400 font-mono">{progressPercent}% (Step {status.currentStep}/{status.totalSteps || 60})</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>{direction === 'PATIALA_TO_DHABLAN' ? 'Patiala (PTA)' : 'Dhablan (DBN)'}</span>
            <span>P-19 ↔ P-20 ↔ P-23 ↔ P-24</span>
            <span>{direction === 'PATIALA_TO_DHABLAN' ? 'Dhablan (DBN)' : 'Patiala (PTA)'}</span>
          </div>
        </div>

        {/* Configuration Options */}
        <div className="space-y-4 mb-6 text-xs">
          {/* Direction Selection */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Corridor Direction</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('PATIALA_TO_DHABLAN')}
                className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all ${
                  direction === 'PATIALA_TO_DHABLAN'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                Patiala → Dhablan (19 → 24)
              </button>
              <button
                type="button"
                onClick={() => setDirection('DHABLAN_TO_PATIALA')}
                className={`py-2 px-3 rounded-xl border font-bold text-xs transition-all ${
                  direction === 'DHABLAN_TO_PATIALA'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                Dhablan → Patiala (24 → 19)
              </button>
            </div>
          </div>

          {/* Speed Multiplier */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" />
              <span>Simulation Speed</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 4].map((mult) => (
                <button
                  key={mult}
                  type="button"
                  onClick={() => setSpeedMultiplier(mult)}
                  className={`py-1.5 px-3 rounded-xl border font-bold text-xs transition-all ${
                    speedMultiplier === mult
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {mult === 1 ? '1x Normal' : mult === 2 ? '2x Fast' : '4x Turbo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
          {!status.isRunning ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Simulation</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop Simulation</span>
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={loading}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
            title="Reset simulation progress"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimulationModal;
