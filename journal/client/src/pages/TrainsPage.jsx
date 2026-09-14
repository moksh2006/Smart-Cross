import React, { useState, useEffect } from 'react';
import { trainApi } from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  Train, RefreshCw, Compass, Gauge, AlertCircle, Clock,
  Search, Calendar, MapPin, Activity, CheckCircle2, ChevronRight, X
} from 'lucide-react';

export const TrainsPage = () => {
  const [trains, setTrains] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshingTrain, setRefreshingTrain] = useState(null);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'timetable' | 'table'
  const [selectedTrainForTimetable, setSelectedTrainForTimetable] = useState(null);
  const [timetableDetails, setTimetableDetails] = useState(null);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  const { socket } = useSocket();

  const fetchTrains = async () => {
    try {
      const res = await trainApi.getAll();
      if (res.success && res.data) {
        setTrains(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrains();
  }, []);

  // Listen for real-time train updates
  useEffect(() => {
    if (!socket) return;
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

    socket.on('train:update', handleTrainUpdate);
    return () => {
      socket.off('train:update', handleTrainUpdate);
    };
  }, [socket]);

  const handleRefresh = async (number) => {
    setRefreshingTrain(number);
    try {
      await trainApi.refresh(number);
      await fetchTrains();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshingTrain(null);
    }
  };

  const handleOpenTimetable = async (train) => {
    setSelectedTrainForTimetable(train);
    setLoadingTimetable(true);
    try {
      const res = await trainApi.getByNumber(train.trainNumber);
      if (res.success && res.data) {
        setTimetableDetails(res.data);
      }
    } catch (e) {
      console.error('Error fetching timetable:', e);
    } finally {
      setLoadingTimetable(false);
    }
  };

  const filtered = trains.filter(t =>
    t.trainNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.trainName && t.trainName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Just now';
    const diffSec = Math.round((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Train className="w-8 h-8 text-sky-400" />
            <span>Patiala Railway Trains & Timetable</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Tracking 15 monitored trains crossing Patiala (PTA) — Dhablan (DBN) with real-time RailRadar telemetry
          </p>
        </div>

        {/* View Switcher Tabs & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'live' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Live Status Panel
            </button>
            <button
              onClick={() => setActiveTab('timetable')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'timetable' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Timetable & Schedule
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'table' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Table View
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search train..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: LIVE TRAIN STATUS PANEL */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Showing {filtered.length} Monitored Trains (Auto-updating via WebSocket)</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live RailRadar Telemetry Stream
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((train) => {
              const hasCoordinates = train.currentLocation && train.currentLocation.coordinates;
              const isInCorridor = train.status === 'IN_CORRIDOR' || Boolean(train.inCorridor);
              const isApproaching = train.status === 'APPROACHING' || Boolean(train.isApproaching);
              const isCompleted = train.status === 'COMPLETED';
              const isLiveApi = train.dataSource === 'LIVE_API' && (train.speed > 0 || train.status === 'ACTIVE');
              const isLive = isInCorridor || isLiveApi;
              const isPtaToDbn = train.direction === 'PATIALA_TO_DHABLAN';
              const isRefreshing = refreshingTrain === train.trainNumber;

              let statusBadge = (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-mono">
                  {train.entryScheduledTime && train.entryScheduledTime !== '--' ? `SCHEDULED (${train.entryScheduledTime})` : 'SCHEDULED'}
                </span>
              );

              if (isLive) {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse font-mono">
                    LIVE • IN CORRIDOR
                  </span>
                );
              } else if (isApproaching) {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse font-mono">
                    APPROACHING ({train.entryScheduledTime || 'Soon'})
                  </span>
                );
              } else if (isCompleted) {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-800 text-slate-400 border-slate-700 font-mono">
                    COMPLETED TODAY
                  </span>
                );
              }

              return (
                <div
                  key={train.trainNumber}
                  className="glass-panel rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Row: Train Number, Name, Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-black text-white">{train.trainNumber}</span>
                          {statusBadge}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-200 line-clamp-1 mt-0.5">
                          {train.trainName || 'Indian Railways Train'}
                        </h3>
                      </div>

                      <button
                        onClick={() => handleRefresh(train.trainNumber)}
                        disabled={isRefreshing}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50 shrink-0"
                        title="Poll latest live telemetry"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {/* Corridor Direction */}
                    <div className="flex items-center gap-2 text-xs">
                      <Compass className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-bold text-slate-300">
                        {isPtaToDbn ? 'Patiala (PTA) → Dhablan (DBN)' : 'Dhablan (DBN) → Patiala (PTA)'}
                      </span>
                    </div>

                    {/* Telemetry Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-sky-400" /> Speed
                        </div>
                        <div className="font-mono font-black text-sm text-white mt-0.5">
                          {train.speed || 0} km/h
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" /> Delay
                        </div>
                        <div className={`font-mono font-black text-sm mt-0.5 ${
                          (train.delayMinutes || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {(train.delayMinutes || 0) > 0 ? `+${train.delayMinutes}m` : 'On Time'}
                        </div>
                      </div>

                      <div className="col-span-2 pt-1 border-t border-slate-800/60">
                        <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-400" /> Current Location
                        </div>
                        <div className="text-xs text-slate-200 mt-0.5 truncate font-mono">
                          {isLive && hasCoordinates ? (
                            <span>{train.currentLocation.coordinates[1].toFixed(4)}°N, {train.currentLocation.coordinates[0].toFixed(4)}°E</span>
                          ) : isApproaching ? (
                            <span className="text-amber-300 font-sans font-semibold">At {train.entryStationCode || (isPtaToDbn ? 'PTA' : 'DBN')} (Departs {train.entryScheduledTime})</span>
                          ) : isCompleted ? (
                            <span className="text-slate-400 font-sans">Cleared Corridor (Passed at {train.exitScheduledTime || 'earlier'})</span>
                          ) : (
                            <span className="text-slate-400 font-sans">Scheduled Departure: {train.entryScheduledTime || '--'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Next Station & Phatak */}
                    <div className="text-xs space-y-1 text-slate-400">
                      {train.nextStation && (
                        <div className="flex justify-between">
                          <span>Next Station:</span>
                          <span className="font-semibold text-slate-200">{train.nextStation}</span>
                        </div>
                      )}
                      {train.nextPhatakNumber && (
                        <div className="flex justify-between">
                          <span>Upcoming Phatak:</span>
                          <span className="font-bold text-amber-300">Phatak {train.nextPhatakNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Meta: Updated Time & Timetable Button */}
                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <div>
                      <span>Updated: </span>
                      <span className="text-slate-300 font-mono">{formatTimeAgo(train.lastUpdatedAt)}</span>
                    </div>

                    <button
                      onClick={() => handleOpenTimetable(train)}
                      className="text-sky-400 hover:text-sky-300 font-bold flex items-center gap-0.5"
                    >
                      <span>Timetable</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: TIMETABLE & SCHEDULE */}
      {activeTab === 'timetable' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Official Northern Railway Scheduled Halts at Patiala (PTA) & Dhablan (DBN)</span>
            <span>Click any train to view complete itinerary</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((train) => {
              const isPtaToDbn = train.direction === 'PATIALA_TO_DHABLAN';

              return (
                <div
                  key={train.trainNumber}
                  onClick={() => handleOpenTimetable(train)}
                  className="glass-panel rounded-2xl p-5 border border-slate-800 hover:border-sky-500/50 cursor-pointer transition-all shadow-lg hover:shadow-sky-500/10"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-lg font-black text-white">{train.trainNumber}</span>
                      <h3 className="text-sm font-semibold text-slate-200 mt-0.5 line-clamp-1">{train.trainName}</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {isPtaToDbn ? 'PTA → DBN' : 'DBN → PTA'}
                    </span>
                  </div>

                  {/* Running Days */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Days: </span>
                    <span className="font-mono text-[11px] font-semibold text-slate-300">
                      {Array.isArray(train.runningDays) && train.runningDays.length > 0
                        ? train.runningDays.join(', ')
                        : 'Daily (All Days)'}
                    </span>
                  </div>

                  {/* Station Timing Breakdown */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Patiala (PTA):</span>
                      <span className="text-sky-300 font-bold">Scheduled Corridor Stop</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Dhablan (DBN):</span>
                      <span className="text-indigo-300 font-bold">Corridor Boundary</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                      <span className="text-slate-400 font-sans">Current Delay:</span>
                      <span className={`font-bold ${train.delayMinutes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {train.delayMinutes > 0 ? `+${train.delayMinutes} min` : 'On Time'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-right">
                    <span className="text-xs font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1">
                      View Full Stations List <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: TABLE VIEW */}
      {activeTab === 'table' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Train #</th>
                  <th className="py-3.5 px-4">Train Name</th>
                  <th className="py-3.5 px-4">Direction</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Speed</th>
                  <th className="py-3.5 px-4">Delay</th>
                  <th className="py-3.5 px-4">Current Station</th>
                  <th className="py-3.5 px-4">Next Station</th>
                  <th className="py-3.5 px-4">Data Source</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((train) => {
                  const isPtaToDbn = train.direction === 'PATIALA_TO_DHABLAN';
                  const isRefreshing = refreshingTrain === train.trainNumber;

                  return (
                    <tr key={train.trainNumber} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-extrabold text-white text-sm">
                        {train.trainNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {train.trainName || 'Express'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                          isPtaToDbn
                            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {isPtaToDbn ? 'PTA → DBN' : 'DBN → PTA'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          (train.status === 'IN_CORRIDOR' || train.inCorridor)
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                            : (train.status === 'APPROACHING' || train.isApproaching)
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                            : train.status === 'COMPLETED'
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}>
                          {train.status === 'IN_CORRIDOR' || train.inCorridor ? 'IN CORRIDOR' :
                           train.status === 'APPROACHING' || train.isApproaching ? 'APPROACHING' :
                           train.status === 'COMPLETED' ? 'COMPLETED' :
                           (train.entryScheduledTime && train.entryScheduledTime !== '--' ? `WAITING (${train.entryScheduledTime})` : 'SCHEDULED')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {train.speed || 0} km/h
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className={(train.delayMinutes || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          {(train.delayMinutes || 0) > 0 ? `+${train.delayMinutes}m` : '0m'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-300">
                        {train.currentStation || '--'}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-300">
                        {train.nextStation || '--'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                          {train.dataSource || 'TIMETABLE'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenTimetable(train)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white transition-all text-xs"
                            title="Inspect timetable"
                          >
                            Schedule
                          </button>
                          <button
                            onClick={() => handleRefresh(train.trainNumber)}
                            disabled={isRefreshing}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
                            title="Fetch latest live status"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FULL TIMETABLE MODAL */}
      {selectedTrainForTimetable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-2xl max-h-[85vh] rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl font-black text-white">{selectedTrainForTimetable.trainNumber}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-bold border border-sky-500/40">
                    Official Timetable
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-slate-300 mt-0.5">{selectedTrainForTimetable.trainName}</h2>
              </div>

              <button
                onClick={() => { setSelectedTrainForTimetable(null); setTimetableDetails(null); }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Stations list */}
            <div className="p-5 overflow-y-auto space-y-3">
              {loadingTimetable ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
                  <span>Loading official route & station schedule from RailRadar...</span>
                </div>
              ) : timetableDetails && timetableDetails.schedule && timetableDetails.schedule.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-semibold mb-2">
                    Station Itinerary ({timetableDetails.schedule.length} halts/waypoints)
                  </div>
                  <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
                    {timetableDetails.schedule.map((st, idx) => {
                      const isCorridor = st.stationCode === 'PTA' || st.stationCode === 'DBN';
                      return (
                        <div
                          key={idx}
                          className={`p-3 flex items-center justify-between text-xs ${
                            isCorridor ? 'bg-sky-950/40 border-l-4 border-l-sky-400 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-slate-500 w-6 text-right">{idx + 1}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-xs ${isCorridor ? 'text-sky-300 font-extrabold' : 'text-white'}`}>
                                  {st.stationCode}
                                </span>
                                {isCorridor && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                                    PATIALA CORRIDOR
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">{st.stationName}</div>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <div className="text-slate-200">
                              Arr: <span className="text-sky-400">{st.arrivalTime || '--'}</span> | Dep: <span className="text-indigo-400">{st.departureTime || '--'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{st.distanceKm || 0} km from origin</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Schedule details unavailable. Using cached corridor timetable for Patiala.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
              <button
                onClick={() => { setSelectedTrainForTimetable(null); setTimetableDetails(null); }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainsPage;
