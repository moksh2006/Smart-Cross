import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { phatakApi } from '../services/api';
import { useSocket } from '../context/SocketContext';
import StatusBadge from '../components/StatusBadge';
import PredictionConfidenceBadge from '../components/PredictionConfidenceBadge';
import LiveMap from '../components/LiveMap';
import { ArrowLeft, Clock, Train, ShieldCheck, Timer, Calendar, History, MapPin, Gauge } from 'lucide-react';

export const PhatakDetail = () => {
  const { id } = useParams();
  const [phatakData, setPhatakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const loadDetails = async () => {
    try {
      const res = await phatakApi.getById(id);
      if (res.success && res.data) {
        setPhatakData(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [id]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (data) => {
      if ((data.number || data.phatakNumber) === parseInt(id, 10)) {
        loadDetails();
      }
    };
    socket.on('phatak:update', handleUpdate);
    socket.on('gate:status-change', handleUpdate);
    return () => {
      socket.off('phatak:update', handleUpdate);
      socket.off('gate:status-change', handleUpdate);
    };
  }, [socket, id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 text-center text-slate-400">
        Loading Phatak {id} telemetry...
      </div>
    );
  }

  if (!phatakData) {
    return (
      <div className="max-w-7xl mx-auto p-6 text-center">
        <h2 className="text-xl font-bold text-white">Phatak {id} not found</h2>
        <Link to="/" className="text-sky-400 text-sm mt-2 inline-block">Return to Dashboard</Link>
      </div>
    );
  }

  const { number, name, location, dmsCoordinates, currentStatus, prediction, events, calculatedDistances } = phatakData;

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back button and title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-semibold mb-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white">Phatak {number}</h1>
            <StatusBadge status={currentStatus} size="lg" />
          </div>
          <p className="text-sm text-slate-400 mt-1">{name}</p>
        </div>

        {/* GPS Coordinates Header */}
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono space-y-1">
          <div>DMS: <span className="text-slate-200">{dmsCoordinates?.latitude}, {dmsCoordinates?.longitude}</span></div>
          <div>GeoJSON: <span className="text-sky-400">[{location?.coordinates[0]}, {location?.coordinates[1]}]</span></div>
        </div>
      </div>

      {/* Grid: Live Predictions + Mini Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Prediction Details */}
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Real-Time Gate Forecast</span>
            </h3>

            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex justify-between items-center">
                <span className="text-slate-400">Approaching Train:</span>
                <span className="font-extrabold text-white font-mono">{prediction?.trainNumber || 'None'}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex justify-between items-center">
                <span className="text-slate-400">Train ETA:</span>
                <span className="font-extrabold text-amber-300 font-mono">
                  {prediction?.etaMinutes !== undefined ? `${prediction.etaMinutes} min` : '--'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex justify-between items-center">
                <span className="text-slate-400">Predicted Closure:</span>
                <span className="font-bold text-rose-400 font-mono">
                  {formatTime(prediction?.predictedClosure)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex justify-between items-center">
                <span className="text-slate-400">Expected Opening:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {formatTime(prediction?.predictedOpening)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex justify-between items-center">
                <span className="text-slate-400">Road Waiting Time:</span>
                <span className="font-bold text-indigo-300 font-mono">
                  {prediction?.waitingTimeMinutes ? `~${prediction.waitingTimeMinutes} min` : '--'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-400">Prediction Method:</span>
              <PredictionConfidenceBadge confidence={prediction?.confidence || 'HIGH'} method={prediction?.method} />
            </div>
          </div>

          {/* Calculated Distances to other phataks */}
          {calculatedDistances && (
            <div className="glass-panel rounded-2xl p-5 border border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Authoritative Inter-Phatak Distances
              </h4>
              <div className="space-y-2 text-xs">
                {Object.entries(calculatedDistances).map(([pNum, dist]) => (
                  <div key={pNum} className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">Phatak {number} ↔ Phatak {pNum}:</span>
                    <span className="font-mono font-bold text-sky-400">{dist} meters</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Middle & Right: Map & Gate Event History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="h-[360px]">
            <LiveMap phataks={[phatakData]} />
          </div>

          {/* Gate Events Audit History */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Gate Transition History (Audit Log)</span>
            </h3>

            {(!events || events.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">No status transitions recorded yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {events.map((ev) => (
                  <div
                    key={ev._id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 font-bold font-mono">
                        <span className="text-slate-400">{ev.previousStatus}</span>
                        <span className="text-slate-600">→</span>
                        <span className={ev.newStatus === 'CLOSED' ? 'text-rose-400' : ev.newStatus === 'CLOSING_SOON' ? 'text-amber-400' : 'text-emerald-400'}>
                          {ev.newStatus}
                        </span>
                      </div>
                      <span className="text-slate-400 hidden sm:inline">{ev.reason}</span>
                    </div>

                    <div className="text-right text-slate-400 font-mono text-[11px]">
                      <div>{new Date(ev.timestamp).toLocaleTimeString()}</div>
                      {ev.trainNumber && <div className="text-sky-400">Train: {ev.trainNumber}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhatakDetail;
