import React, { useState, useEffect } from 'react';
import { phatakApi, trainApi } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useLocation } from '../context/LocationContext';
import LiveMap from '../components/LiveMap';
import StatusBadge from '../components/StatusBadge';
import { MapPin, Navigation, Compass, Train } from 'lucide-react';

export const MapPage = () => {
  const [phataks, setPhataks] = useState([]);
  const [trains, setTrains] = useState([]);
  const [selectedPhatak, setSelectedPhatak] = useState(null);
  const { coords } = useLocation();
  const { socket } = useSocket();

  useEffect(() => {
    const fetchData = async () => {
      const [pRes, tRes] = await Promise.all([
        phatakApi.getAll(),
        trainApi.getAll()
      ]);
      if (pRes.success) setPhataks(pRes.data);
      if (tRes.success) setTrains(tRes.data);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handlePhatak = (p) => {
      setPhataks(prev => prev.map(item => item.number === (p.number || p.phatakNumber) ? { ...item, ...p } : item));
    };
    const handleTrain = (t) => {
      setTrains(prev => {
        const idx = prev.findIndex(item => item.trainNumber === t.trainNumber);
        if (idx !== -1) {
          const c = [...prev];
          c[idx] = { ...c[idx], ...t };
          return c;
        }
        return [t, ...prev];
      });
    };
    socket.on('phatak:update', handlePhatak);
    socket.on('train:update', handleTrain);
    return () => {
      socket.off('phatak:update', handlePhatak);
      socket.off('train:update', handleTrain);
    };
  }, [socket]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row relative overflow-hidden">
      {/* Sidebar List */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-800 bg-slate-950 p-4 space-y-4 overflow-y-auto shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-white">Corridor GIS Map</h2>
          <p className="text-xs text-slate-400">
            Patiala Junction (PTA) to Dhablan (DBN) Railway Alignment
          </p>
        </div>

        {/* 4 Phatak Quick Selector */}
        <div className="space-y-2.5">
          {phataks.map((p) => (
            <div
              key={p.number}
              onClick={() => setSelectedPhatak(p)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedPhatak?.number === p.number
                  ? 'bg-sky-500/15 border-sky-500/50 shadow-md shadow-sky-950/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-white text-base">Phatak {p.number}</span>
                <StatusBadge status={p.currentStatus} size="sm" />
              </div>
              <p className="text-xs text-slate-400 mt-1">{p.name}</p>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
                <span>ETA: <strong className="text-sky-300">{p.prediction?.etaMinutes !== undefined ? `${p.prediction.etaMinutes}m` : 'Clear'}</strong></span>
                <span>Train: <strong className="text-amber-300">{p.prediction?.trainNumber || 'None'}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* Active Trains on Map */}
        <div className="pt-3 border-t border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Train className="w-3.5 h-3.5 text-sky-400" />
            <span>Active Trains in Punjab Corridor</span>
          </h3>
          <div className="space-y-2">
            {trains.slice(0, 5).map((t) => (
              <div key={t.trainNumber} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-xs">
                <div className="flex justify-between font-mono font-bold text-white">
                  <span>{t.trainNumber}</span>
                  <span className="text-sky-400">{t.speed || 0} km/h</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{t.trainName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Map View */}
      <div className="flex-1 h-full min-h-[400px]">
        <LiveMap phataks={phataks} trains={trains} userLocation={coords} />
      </div>
    </div>
  );
};

export default MapPage;
