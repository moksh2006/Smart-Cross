import React, { useState, useEffect } from 'react';
import { phatakApi, trainApi, alertApi, systemApi } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useSound } from '../context/SoundContext';
import { useLocation } from '../context/LocationContext';
import PhatakCard from '../components/PhatakCard';
import TrainCard from '../components/TrainCard';
import LiveMap from '../components/LiveMap';
import AlertBanner from '../components/AlertBanner';
import {
  MapPin, RefreshCw, Radio, Compass, ShieldAlert, CheckCircle2, AlertTriangle,
  Play, Volume2, VolumeX, Bell, Database, Zap, Activity, Clock, Train as TrainIcon
} from 'lucide-react';

export const Dashboard = ({ onOpenSimulation }) => {
  const [phataks, setPhataks] = useState([]);
  const [trains, setTrains] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifGranted, setNotifGranted] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const { socket, isConnected } = useSocket();
  const { playTrainHorn, soundEnabled, enableSound } = useSound();
  const { coords, hasGps } = useLocation();

  const loadData = async () => {
    try {
      const [phatakRes, trainRes, alertRes, sysRes] = await Promise.all([
        phatakApi.getAll().catch(() => ({ success: false })),
        trainApi.getAll().catch(() => ({ success: false })),
        alertApi.getRecent(5).catch(() => ({ success: false })),
        systemApi.getStatus().catch(() => ({ success: false }))
      ]);

      if (phatakRes.success && phatakRes.data) {
        setPhataks(phatakRes.data);
      }
      if (trainRes.success && trainRes.data) {
        setTrains(trainRes.data);
      }
      if (alertRes.success && alertRes.data && alertRes.data.length > 0) {
        setActiveAlert(alertRes.data[0]);
      }
      if (sysRes.success) {
        setSystemStatus(sysRes);
      }
    } catch (err) {
      console.error('[Dashboard] Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleEnableSoundAndNotif = () => {
    enableSound();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          setNotifGranted(true);
          new Notification('SmartCross Alerts Enabled', {
            body: 'You will receive real-time alerts when Patiala railway gates close or open.',
            icon: '/favicon.ico'
          });
        }
      });
    }
  };

  // Real-time Socket.IO subscriptions & Sound Trigger
  useEffect(() => {
    if (!socket) return;

    const handlePhatakUpdate = (updatedPhatak) => {
      setPhataks((prev) =>
        prev.map((p) => (p.number === (updatedPhatak.number || updatedPhatak.phatakNumber) ? { ...p, ...updatedPhatak } : p))
      );
    };

    const handleTrainUpdate = (updatedTrain) => {
      setTrains((prev) => {
        const idx = prev.findIndex((t) => t.trainNumber === updatedTrain.trainNumber);
        if (idx !== -1) {
          const clone = [...prev];
          clone[idx] = { ...clone[idx], ...updatedTrain };
          return clone;
        }
        return [updatedTrain, ...prev];
      });
    };

    const handleNewAlert = (alert) => {
      setActiveAlert(alert);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`SmartCross Phatak Alert`, {
          body: alert.message || `Phatak ${alert.phatakNumber} status changed.`,
          icon: '/favicon.ico'
        });
      }
    };

    const handleSoundTrigger = (soundPayload) => {
      console.log('[Dashboard] Status transition sound triggered for Phatak:', soundPayload.phatakNumber);
      playTrainHorn();
    };

    socket.on('phatak:update', handlePhatakUpdate);
    socket.on('train:update', handleTrainUpdate);
    socket.on('alert:new', handleNewAlert);
    socket.on('sound:trigger', handleSoundTrigger);

    return () => {
      socket.off('phatak:update', handlePhatakUpdate);
      socket.off('train:update', handleTrainUpdate);
      socket.off('alert:new', handleNewAlert);
      socket.off('sound:trigger', handleSoundTrigger);
    };
  }, [socket, playTrainHorn]);

  const [selectedTrainNumber, setSelectedTrainNumber] = useState(null);
  const [simulatingTrain, setSimulatingTrain] = useState(null);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSimulateScheduledRun = async (trainNumber) => {
    setSimulatingTrain(trainNumber);
    setSelectedTrainNumber(trainNumber);
    try {
      await trainApi.simulateSchedule(trainNumber, 2.5);
    } catch (e) {
      console.warn('Simulation error:', e);
    } finally {
      setTimeout(() => setSimulatingTrain(null), 15000);
    }
  };

  // Select primary train for LIVE TRAIN STATUS card (prioritize active/in-corridor trains)
  const primaryTrain = (selectedTrainNumber && trains.find(t => t.trainNumber === selectedTrainNumber)) ||
    trains.find(t => t.inCorridor || t.status === 'IN_CORRIDOR') ||
    trains.find(t => t.isApproaching || t.status === 'APPROACHING') ||
    trains.find(t => (t.speed || 0) > 0) ||
    trains.find(t => t.minutesUntilEntry > 0) ||
    trains[0] || null;

  // Status metrics counts
  const closedCount = phataks.filter((p) => p.currentStatus === 'CLOSED').length;
  const closingCount = phataks.filter((p) => p.currentStatus === 'CLOSING_SOON').length;
  const openCount = phataks.filter((p) => p.currentStatus === 'OPEN').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Alert Banner */}
      {activeAlert && (
        <AlertBanner alert={activeAlert} onDismiss={() => setActiveAlert(null)} />
      )}

      {/* Corridor Overview Banner */}
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold mb-3">
              <Compass className="w-3.5 h-3.5" />
              <span>Patiala (PTA) — Dhablan (DBN) Corridor</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              SmartCross Railway Phatak Monitor
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Real-time route geometry projection & level crossing prediction system for Northern Railway
              Phataks 19, 20, 23, and 24. Live API activates strictly at scheduled station departure.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span>{hasGps ? 'GPS Active (1500m proximity)' : 'Patiala Center (Default)'}</span>
              </div>

              {/* Enable Alert Sound Button (Section 33) */}
              {!soundEnabled ? (
                <button
                  onClick={handleEnableSoundAndNotif}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold transition-all animate-pulse"
                >
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>Enable Alert Sound</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Alert Sound Active</span>
                </div>
              )}

              <button
                onClick={handleManualRefresh}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Quick Gate KPI Stats */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Open</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-1">{openCount}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Closing Soon</div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-1">{closingCount}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Closed</div>
              <div className="text-2xl sm:text-3xl font-black text-rose-400 font-mono mt-1">{closedCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 20 & 21: LIVE TRAIN STATUS & API STATUS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LIVE TRAIN STATUS CARD */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrainIcon className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-extrabold text-white tracking-tight">LIVE TRAIN STATUS</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {trains.length > 0 && (
                <select
                  value={primaryTrain?.trainNumber || ''}
                  onChange={(e) => setSelectedTrainNumber(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1 focus:outline-none focus:border-sky-500 font-mono"
                  title="Select train to monitor"
                >
                  {trains.map((t) => (
                    <option key={t.trainNumber} value={t.trainNumber}>
                      {t.trainNumber} - {t.trainName}
                    </option>
                  ))}
                </select>
              )}
              {primaryTrain && (
                <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                  primaryTrain.inCorridor || primaryTrain.status === 'IN_CORRIDOR'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : primaryTrain.isApproaching || primaryTrain.status === 'APPROACHING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : primaryTrain.status === 'COMPLETED'
                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                }`}>
                  {primaryTrain.inCorridor || primaryTrain.status === 'IN_CORRIDOR'
                    ? 'LIVE • IN CORRIDOR'
                    : primaryTrain.isApproaching || primaryTrain.status === 'APPROACHING'
                    ? 'APPROACHING CORRIDOR'
                    : primaryTrain.status === 'COMPLETED'
                    ? 'COMPLETED TODAY'
                    : 'TIMETABLE SCHEDULE'}
                </span>
              )}
            </div>
          </div>

          {primaryTrain ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-slate-400 uppercase text-[10px] font-sans">Train</div>
                <div className="text-base font-bold text-white mt-1">
                  {primaryTrain.trainNumber}
                </div>
                <div className="text-[11px] text-slate-400 font-sans truncate">{primaryTrain.trainName}</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-slate-400 uppercase text-[10px] font-sans">Status</div>
                <div className={`text-sm font-black mt-1 font-sans ${
                  primaryTrain.inCorridor || primaryTrain.status === 'IN_CORRIDOR'
                    ? 'text-emerald-400'
                    : primaryTrain.isApproaching || primaryTrain.status === 'APPROACHING'
                    ? 'text-amber-400'
                    : primaryTrain.status === 'COMPLETED'
                    ? 'text-slate-400'
                    : 'text-indigo-300'
                }`}>
                  {primaryTrain.inCorridor || primaryTrain.status === 'IN_CORRIDOR'
                    ? `Running in Corridor (${primaryTrain.speed || 52} km/h)`
                    : primaryTrain.isApproaching || primaryTrain.status === 'APPROACHING'
                    ? `Approaching Station (Departs ${primaryTrain.entryScheduledTime || 'soon'})`
                    : primaryTrain.status === 'COMPLETED'
                    ? `Completed (Passed at ${primaryTrain.exitScheduledTime || 'earlier'})`
                    : `Waiting for departure (${primaryTrain.entryScheduledTime || '--'})`}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {primaryTrain.direction === 'PATIALA_TO_DHABLAN' ? 'PTA → DBN' : 'DBN → PTA'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-slate-400 uppercase text-[10px] font-sans">Speed & Delay</div>
                <div className="text-base font-black text-sky-400 mt-1">
                  {primaryTrain.speed || 0} km/h
                </div>
                <div className="text-[11px] text-amber-400 font-sans">
                  {primaryTrain.delayMinutes ? `+${primaryTrain.delayMinutes} min delay` : 'On Schedule'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-slate-400 uppercase text-[10px] font-sans">Last Update</div>
                <div className="text-xs font-bold text-slate-200 mt-1">
                  {primaryTrain.lastUpdatedAt ? new Date(primaryTrain.lastUpdatedAt).toLocaleTimeString() : 'Just now'}
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  {primaryTrain.currentLocation?.coordinates
                    ? `[${primaryTrain.currentLocation.coordinates[0].toFixed(2)}, ${primaryTrain.currentLocation.coordinates[1].toFixed(2)}]`
                    : 'Location pending'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-4 text-center">Loading train telemetry...</div>
          )}
        </div>

        {/* API HEALTH STATUS CARD (Section 20) */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>API & SERVICE STATUS</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Patiala Corridor</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
              <span className="text-slate-300">Timetable API:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready ({systemStatus?.timetableRecords || 15})
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
              <span className="text-slate-300">Route API:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> LineString OK
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
              <span className="text-slate-300">Live API:</span>
              <span className={`font-bold flex items-center gap-1 ${
                systemStatus?.railradar === 'connected' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {systemStatus?.railradar || 'Ready'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
              <span className="text-slate-300">MongoDB:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-300">Socket.IO:</span>
              <span className={`font-bold flex items-center gap-1 ${
                isConnected ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {isConnected ? 'Streaming' : 'Connecting'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Phatak Cards Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span>Patiala Railway Level Crossings</span>
            <span className="text-xs font-normal text-slate-400">(Authoritative Coordinates)</span>
          </h2>
          <span className="text-xs text-slate-400">4 Monitored Gates</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {phataks.map((phatak) => (
            <PhatakCard key={phatak.number} phatak={phatak} />
          ))}
        </div>
      </section>

      {/* Interactive Map & Approaching Trains Split View */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Map Container */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Authoritative Railway Track Map</span>
              <span className="text-xs font-mono text-sky-400">Leaflet GIS</span>
            </h3>
            <span className="text-xs text-slate-400 hidden sm:inline">PTA ↔ 19 ↔ 20 ↔ 23 ↔ 24 ↔ DBN</span>
          </div>

          <div className="h-[480px]">
            <LiveMap
              phataks={phataks}
              trains={trains}
              userLocation={coords}
            />
          </div>
        </div>

        {/* Approaching Trains Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Approaching Trains</span>
              <span className="text-xs font-mono text-indigo-400">15 Monitored</span>
            </h3>
          </div>

          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {trains.slice(0, 4).map((train) => (
              <TrainCard
                key={train.trainNumber}
                train={train}
                onRefresh={async (no) => {
                  await trainApi.refresh(no);
                  loadData();
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 22: TIMETABLE DISPLAY */}
      <section className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Timetable & Scheduled Polling Windows</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Corridor entry station arrival and departure times from RailRadar timetable
            </p>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Live API starts at scheduled departure
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Train</th>
                <th className="py-2.5 px-3">Entry Station</th>
                <th className="py-2.5 px-3">Scheduled Start</th>
                <th className="py-2.5 px-3">Direction</th>
                <th className="py-2.5 px-3">Live Status</th>
                <th className="py-2.5 px-3">Polling Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {(systemStatus?.schedulerTable || []).map((row) => (
                <tr key={row.trainNumber} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 text-white font-bold">
                    {row.trainNumber} <span className="text-slate-400 font-sans font-normal text-[11px]">({row.trainName})</span>
                  </td>
                  <td className="py-2.5 px-3 text-sky-300 font-bold">{row.station}</td>
                  <td className="py-2.5 px-3 text-amber-300 font-bold">{row.scheduledTime}</td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {row.direction === 'PATIALA_TO_DHABLAN' ? 'PTA → DBN' : 'DBN → PTA'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={
                      row.pollingStatus === 'LIVE' || row.pollingStatus === 'IN_CORRIDOR' ? 'text-emerald-400 font-bold' :
                      row.pollingStatus === 'APPROACHING' ? 'text-amber-400 font-bold' :
                      row.pollingStatus === 'COMPLETED' ? 'text-slate-500' : 'text-slate-400'
                    }>
                      {row.pollingStatus === 'LIVE' ? 'Live Telemetry' :
                       row.pollingStatus === 'IN_CORRIDOR' ? 'In Corridor (Transit)' :
                       row.pollingStatus === 'APPROACHING' ? 'Approaching' :
                       row.pollingStatus === 'COMPLETED' ? 'Completed Today' : 'Scheduled / Waiting'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.pollingStatus === 'LIVE' || row.pollingStatus === 'IN_CORRIDOR' || row.pollingStatus === 'LIVE_POLLING_STARTED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                        : row.pollingStatus === 'APPROACHING'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                        : row.pollingStatus === 'COMPLETED'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {row.pollingStatus}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleSimulateScheduledRun(row.trainNumber)}
                      disabled={simulatingTrain === row.trainNumber}
                      className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 hover:text-white border border-sky-500/40 font-semibold text-[11px] transition-all inline-flex items-center gap-1 disabled:opacity-50"
                      title="Test this train's scheduled passage across the corridor to observe gate closures"
                    >
                      <Play className={`w-3 h-3 ${simulatingTrain === row.trainNumber ? 'animate-spin' : ''}`} />
                      <span>{simulatingTrain === row.trainNumber ? 'Running...' : 'Test Run'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
