import React, { useState, useEffect } from 'react';
import { alertApi } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useSound } from '../context/SoundContext';
import { Bell, ShieldAlert, AlertTriangle, CheckCircle2, Volume2, Radio } from 'lucide-react';

export const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [pushStatus, setPushStatus] = useState('DEFAULT'); // DEFAULT, GRANTED, DENIED
  const { socket } = useSocket();
  const { playTrainHorn, soundEnabled, enableSound } = useSound();

  const fetchAlerts = async () => {
    try {
      const res = await alertApi.getRecent(100);
      if (res.success && res.data) {
        setAlerts(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAlerts();
    if ('Notification' in window) {
      setPushStatus(Notification.permission.toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewAlert = (newAlert) => {
      setAlerts((prev) => [newAlert, ...prev]);
    };
    socket.on('alert:new', handleNewAlert);
    return () => socket.off('alert:new', handleNewAlert);
  }, [socket]);

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications');
      return;
    }
    const permission = await Notification.requestPermission();
    setPushStatus(permission.toUpperCase());
    if (permission === 'granted') {
      new Notification('SMARTCROSS Alerts Enabled', {
        body: 'You will receive real-time warnings when Patiala phataks are closing.',
        icon: '/favicon.ico'
      });
      // Save subscription endpoint to backend
      await alertApi.subscribePush({
        endpoint: 'browser_notification_' + Math.random().toString(36).substring(7),
        phatakNumbers: [19, 20, 23, 24]
      });
    }
  };

  const filtered = alerts.filter(a => filterSeverity === 'ALL' || a.severity === filterSeverity);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-amber-400" />
            <span>Phatak Alerts & Notifications</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time status transitions and railway closure warning logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pushStatus !== 'GRANTED' ? (
            <button
              onClick={requestPushPermission}
              className="px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold transition-all"
            >
              Enable Browser Push
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
              ✓ Browser Push Active
            </span>
          )}

          <button
            onClick={() => {
              if (!soundEnabled) enableSound();
              playTrainHorn();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all"
          >
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Horn Sound</span>
          </button>
        </div>
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
        {['ALL', 'CRITICAL', 'WARNING', 'INFO', 'SUCCESS'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              filterSeverity === sev
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 glass-panel rounded-2xl">
            No alerts found matching this filter.
          </div>
        ) : (
          filtered.map((alert) => {
            const isCrit = alert.severity === 'CRITICAL';
            const isWarn = alert.severity === 'WARNING';
            const isSucc = alert.severity === 'SUCCESS';

            return (
              <div
                key={alert._id || Math.random()}
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  isCrit
                    ? 'bg-rose-950/40 border-rose-500/40 shadow-sm shadow-rose-950'
                    : isWarn
                    ? 'bg-amber-950/40 border-amber-500/40 shadow-sm shadow-amber-950'
                    : isSucc
                    ? 'bg-emerald-950/40 border-emerald-500/40 shadow-sm shadow-emerald-950'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    isCrit ? 'bg-rose-500/20 text-rose-400' :
                    isWarn ? 'bg-amber-500/20 text-amber-400' :
                    isSucc ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-sky-500/20 text-sky-400'
                  }`}>
                    {isCrit ? <ShieldAlert className="w-5 h-5" /> :
                     isWarn ? <AlertTriangle className="w-5 h-5" /> :
                     isSucc ? <CheckCircle2 className="w-5 h-5" /> :
                     <Bell className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs tracking-wider px-2 py-0.5 rounded bg-black/40 font-mono">
                        PHATAK {alert.phatakNumber}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isCrit ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-slate-300'
                      }`}>
                        {alert.severity}
                      </span>
                      {alert.trainNumber && (
                        <span className="text-xs text-sky-400 font-mono">
                          Train {alert.trainNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 mt-1 font-medium leading-relaxed">{alert.message}</p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                  {new Date(alert.createdAt || Date.now()).toLocaleTimeString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
