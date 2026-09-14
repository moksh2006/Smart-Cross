import React, { useState, useEffect } from 'react';
import { adminApi, settingApi, systemApi, debugApi } from '../services/api';
import {
  Shield, Server, Activity, Settings, Play, RefreshCw, AlertTriangle,
  CheckCircle, Database, Radio, Wifi, Zap, ArrowRight, CheckCircle2, XCircle, Clock
} from 'lucide-react';

export const AdminDashboard = ({ onOpenSimulation }) => {
  const [metrics, setMetrics] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  // Diagnostic Test Train 14508 state
  const [testingTrain, setTestingTrain] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const loadAdminData = async () => {
    try {
      const [mRes, sRes, lRes, cfgRes] = await Promise.all([
        adminApi.getMetrics().catch(() => ({ success: false })),
        systemApi.getStatus().catch(() => ({ success: false })),
        adminApi.getApiLogs(20).catch(() => ({ success: false })),
        settingApi.getAll().catch(() => ({ success: false }))
      ]);

      if (mRes.success) setMetrics(mRes.data);
      if (sRes.success) setSystemStatus(sRes.data || sRes);
      if (lRes.success) setLogs(lRes.data);
      if (cfgRes.success) setSettings(cfgRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateSetting = async (key, val) => {
    setSavingKey(key);
    try {
      await settingApi.update(key, val);
      setSaveMessage(`Updated ${key} successfully`);
      setTimeout(() => setSaveMessage(''), 3000);
      loadAdminData();
    } catch (e) {
      alert('Error updating setting: ' + e.message);
    } finally {
      setSavingKey(null);
    }
  };

  const handleTestTrain14508 = async () => {
    setTestingTrain(true);
    setTestResult(null);
    try {
      const res = await debugApi.testTrain('14508');
      setTestResult(res);
      loadAdminData();
    } catch (e) {
      setTestResult({
        success: false,
        error: e.response?.data?.message || e.message || 'Diagnostic test failed'
      });
    } finally {
      setTestingTrain(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-400" />
            <span>Admin & System Diagnostics Console</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            System status (/admin/system), RailRadar API telemetry, end-to-end diagnostics, and corridor settings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSimulation}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-sky-500/25 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulation Engine</span>
          </button>

          <button
            onClick={loadAdminData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
            title="Refresh metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold animate-in fade-in">
          ✓ {saveMessage}
        </div>
      )}

      {/* SECTION 1: SYSTEM HEALTH (Step 10 / Step 34) */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-sky-400" />
              <span>Core System Status (/api/system/status)</span>
            </h2>
            <p className="text-xs text-slate-400">Authoritative backend service health & connectivity metrics</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              System Active
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* MongoDB */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">MongoDB</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {(systemStatus?.mongodb || 'connected').toUpperCase()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {systemStatus?.timetableRecords || 0} schedules • {systemStatus?.routeRecords || 0} routes
            </p>
          </div>

          {/* RailRadar API */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">RailRadar API</span>
              <Zap className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-sky-400 font-mono mt-1">
              {(systemStatus?.railradar || 'connected').toUpperCase()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              Last error: {systemStatus?.lastError ? systemStatus.lastError : 'None (Healthy)'}
            </p>
          </div>

          {/* Socket.IO */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Socket.IO Stream</span>
              <Radio className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-indigo-400 font-mono mt-1">
              {(systemStatus?.socket || 'running').toUpperCase()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {systemStatus?.connectedSocketClients || 1} connected client(s)
            </p>
          </div>
        </div>

        {/* Supplementary Telemetry Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-slate-400">Monitored Trains</div>
            <div className="text-lg font-black text-white font-mono mt-0.5">{systemStatus?.monitoredTrains || 15}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-slate-400">Active Predictions</div>
            <div className="text-lg font-black text-amber-400 font-mono mt-0.5">{systemStatus?.predictions || 0}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-slate-400">Recorded Alerts</div>
            <div className="text-lg font-black text-rose-400 font-mono mt-0.5">{systemStatus?.alerts || 0}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="text-slate-400">Last RailRadar Ping</div>
            <div className="text-xs font-semibold text-slate-300 font-mono mt-1 truncate">
              {systemStatus?.lastSuccessfulRailRadarRequest
                ? new Date(systemStatus.lastSuccessfulRailRadarRequest).toLocaleTimeString()
                : 'Active'}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: API SCHEDULER DASHBOARD (Section 23 Specification) */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-400" />
              <span>API Scheduler Dashboard</span>
            </h2>
            <p className="text-xs text-slate-400">
              Timetable-controlled polling trigger: Live API activates strictly at scheduled station departure (Asia/Kolkata IST)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
              Mode: {systemStatus?.schedulerMode || 'TIMETABLE_DRIVEN'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Train</th>
                <th className="py-2.5 px-3">Entry Station</th>
                <th className="py-2.5 px-3">Scheduled Time</th>
                <th className="py-2.5 px-3">Current Time (IST)</th>
                <th className="py-2.5 px-3">Polling Status</th>
                <th className="py-2.5 px-3">Last API Call</th>
                <th className="py-2.5 px-3">Last Success</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {(systemStatus?.schedulerTable || []).map((row) => {
                let badgeClass = 'bg-slate-800 text-slate-300';
                if (row.pollingStatus === 'LIVE' || row.pollingStatus === 'LIVE_POLLING_STARTED') {
                  badgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse';
                } else if (row.pollingStatus === 'WAITING_FOR_SCHEDULED_TIME') {
                  badgeClass = 'bg-amber-500/10 text-amber-300 border border-amber-500/30';
                } else if (row.pollingStatus === 'DELAYED') {
                  badgeClass = 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
                } else if (row.pollingStatus === 'COMPLETED') {
                  badgeClass = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
                } else if (row.pollingStatus === 'API_ERROR') {
                  badgeClass = 'bg-rose-950 text-rose-400 border border-rose-600';
                }

                return (
                  <tr key={row.trainNumber} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-white font-bold">
                      {row.trainNumber} <span className="font-normal text-slate-400 text-[11px] font-sans">({row.trainName})</span>
                    </td>
                    <td className="py-2.5 px-3 text-sky-300 font-bold">
                      {row.station} <span className="text-[10px] text-slate-400 font-normal">({row.stationName})</span>
                    </td>
                    <td className="py-2.5 px-3 text-amber-300 font-bold">{row.scheduledTime}</td>
                    <td className="py-2.5 px-3 text-slate-300">{row.currentTime}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>
                        {row.pollingStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{row.lastApiCall}</td>
                    <td className="py-2.5 px-3 text-emerald-400">{row.lastSuccess}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: END-TO-END DIAGNOSTIC TEST RUNNER (13 SPECIFIED STEPS) */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              <span>Diagnostic Runner: Test Train 14508</span>
            </h2>
            <p className="text-xs text-slate-400">
              Executes the complete pipeline end-to-end for Train 14508 across all 13 required verification stages
            </p>
          </div>

          <button
            onClick={handleTestTrain14508}
            disabled={testingTrain}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 active:scale-95 shrink-0"
          >
            <Play className={`w-4 h-4 fill-current ${testingTrain ? 'animate-spin' : ''}`} />
            <span>{testingTrain ? 'Executing 13-Step Pipeline Test...' : 'Test Train 14508'}</span>
          </button>
        </div>

        {/* Diagnostic Results Display with all 13 Checklist Steps */}
        {testResult && (
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
              <span className="font-bold text-white font-mono">
                Diagnostic Pipeline Result: Train {testResult.trainNumber || '14508'}
              </span>
              <span className="text-slate-400 font-mono">Duration: {testResult.durationMs || 0}ms</span>
            </div>

            {/* Checklist of 13 Required Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(testResult.checklist || [
                { step: 1, name: 'Timetable', passed: testResult.steps?.timetable },
                { step: 2, name: 'Patiala/Dhablan schedule', passed: testResult.steps?.corridorSchedule },
                { step: 3, name: 'Scheduled polling time', passed: testResult.steps?.scheduledPollingTime },
                { step: 4, name: 'Live API', passed: testResult.steps?.liveApi },
                { step: 5, name: 'Live coordinates', passed: testResult.steps?.liveCoordinates },
                { step: 6, name: 'Route geometry', passed: testResult.steps?.routeGeometry },
                { step: 7, name: 'Train mapped to route', passed: testResult.steps?.trainMappedToRoute },
                { step: 8, name: 'Phatak mapping', passed: testResult.steps?.phatakMapping },
                { step: 9, name: 'ETA calculation', passed: testResult.steps?.etaCalculation },
                { step: 10, name: 'MongoDB', passed: testResult.steps?.mongodb },
                { step: 11, name: 'Socket.IO', passed: testResult.steps?.socketIo },
                { step: 12, name: 'Frontend marker', passed: testResult.steps?.frontendMarker },
                { step: 13, name: 'Phatak prediction', passed: testResult.steps?.phatakPrediction }
              ]).map((item) => (
                <div
                  key={item.step}
                  className={`p-3 rounded-xl border flex flex-col justify-between text-xs font-semibold ${
                    item.passed
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-bold">[{item.step}] {item.name}</span>
                  </div>
                  {item.details && (
                    <div className="text-[11px] text-slate-400 font-mono mt-1.5 pl-6 break-words">
                      {item.details}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Live Data & Mappings summary */}
            {testResult.liveData && (
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1 font-mono">
                <div className="text-sky-300 font-bold">
                  Train: {testResult.liveData.trainNumber} — {testResult.liveData.trainName}
                </div>
                <div className="text-slate-300">
                  Coordinates: {testResult.liveData.coordinates ? `[${testResult.liveData.coordinates[0].toFixed(4)}, ${testResult.liveData.coordinates[1].toFixed(4)}]` : 'Live location unavailable (flagged cleanly)'} • Speed: {testResult.liveData.speedKmh || 0} km/h • Delay: +{testResult.liveData.delayMinutes || 0}m
                </div>
                <div className="text-slate-400">
                  Station: {testResult.liveData.currentStation || 'In Corridor'} • Mappings: {testResult.mappings?.length || 0} • Predictions: {testResult.predictions?.length || 0} • Gate Transitions: {testResult.gateTransitions?.length || 0}
                </div>
              </div>
            )}

            {testResult.error && (
              <div className="p-3 rounded-xl bg-rose-950 border border-rose-500/40 text-rose-300 text-xs">
                ❌ Error: {testResult.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: DYNAMIC SETTINGS EDITOR */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-sky-400" />
          <span>Operational Thresholds & Configuration (MongoDB SystemSettings)</span>
        </h3>
        <p className="text-xs text-slate-400">
          Adjust polling intervals, trigger thresholds, and corridor parameters dynamically.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {/* Closing soon threshold */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              CLOSING_SOON_THRESHOLD_MINUTES
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={settings.CLOSING_SOON_THRESHOLD_MINUTES || 10}
                id="cfg-closing-soon"
                className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm"
              />
              <button
                onClick={() => {
                  const val = parseFloat(document.getElementById('cfg-closing-soon').value);
                  handleUpdateSetting('CLOSING_SOON_THRESHOLD_MINUTES', val);
                }}
                disabled={savingKey === 'CLOSING_SOON_THRESHOLD_MINUTES'}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>

          {/* Closure distance meters */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              CLOSURE_DISTANCE_METERS
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={settings.CLOSURE_DISTANCE_METERS || 6000}
                id="cfg-closure-dist"
                className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm"
              />
              <button
                onClick={() => {
                  const val = parseFloat(document.getElementById('cfg-closure-dist').value);
                  handleUpdateSetting('CLOSURE_DISTANCE_METERS', val);
                }}
                disabled={savingKey === 'CLOSURE_DISTANCE_METERS'}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>

          {/* Active Poll Interval */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              ACTIVE_POLL_INTERVAL_SECONDS
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={settings.ACTIVE_POLL_INTERVAL_SECONDS || 30}
                id="cfg-poll-sec"
                className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm"
              />
              <button
                onClick={() => {
                  const val = parseFloat(document.getElementById('cfg-poll-sec').value);
                  handleUpdateSetting('ACTIVE_POLL_INTERVAL_SECONDS', val);
                }}
                disabled={savingKey === 'ACTIVE_POLL_INTERVAL_SECONDS'}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: RAILRADAR API AUDIT LOGS */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          <span>RailRadar API Audit Log & Latency Telemetry</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Endpoint</th>
                <th className="py-2.5 px-3">Train #</th>
                <th className="py-2.5 px-3">HTTP Status</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {logs.map((log, idx) => (
                <tr key={log._id || idx} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 text-slate-400">
                    {new Date(log.requestTime).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 text-sky-400">{log.endpoint}</td>
                  <td className="py-2.5 px-3 text-white font-bold">{log.trainNumber || '--'}</td>
                  <td className="py-2.5 px-3">
                    <span className={log.httpStatus === 200 ? 'text-emerald-400' : log.httpStatus === 429 ? 'text-amber-400' : 'text-rose-400'}>
                      {log.httpStatus}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">{log.latencyMs}ms</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${log.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      {log.success ? 'OK' : log.errorCode || 'FAIL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
