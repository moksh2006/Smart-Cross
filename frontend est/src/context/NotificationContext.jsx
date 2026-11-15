import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveData } from './LiveDataContext';
import { api } from '../lib/api';
import { load, save } from '../lib/storage';

const KEY = 'smartcross_notification_prefs';
const randomId = () => (crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36));

const DEFAULTS = {
  clientId: null,
  watched: [19, 20, 23, 24],
  warningMinutes: 10,
  sound: true,
  muted: false,
  volume: 0.7,
  browser: false,
  severities: { CRITICAL: true, WARNING: true, INFO: false, SUCCESS: false }
};

const NotificationContext = createContext(null);

/**
 * In-app toasts, audio and browser notifications.
 *  - Server alerts are already de-duplicated by the backend; the client also
 *    de-duplicates by alert id and by (crossing, train, kind).
 *  - Client-side "advance warning" fires once per train/crossing when the
 *    predicted ETA drops below the user's warning threshold.
 */
export function NotificationProvider({ children }) {
  const { onAlert, crossings, mode } = useLiveData();
  const [prefs, setPrefs] = useState(() => {
    const p = load(KEY, DEFAULTS);
    return p.clientId ? p : { ...p, clientId: randomId() };
  });
  const [toasts, setToasts] = useState([]);
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const audioCtx = useRef(null);
  const fired = useRef(new Set());
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    save(KEY, prefs);
    const t = setTimeout(() => {
      api.subscribe({ clientId: prefs.clientId, phatakNumbers: prefs.watched, warningMinutes: prefs.warningMinutes, channels: { browser: prefs.browser, audio: prefs.sound } }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [prefs]);

  const update = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);

  const playSound = useCallback((kind = 'warning', force = false) => {
    const p = prefsRef.current;
    if (!force && (!p.sound || p.muted)) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx.current) audioCtx.current = new Ctx();
      const ctx = audioCtx.current;
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, t0);
      master.gain.linearRampToValueAtTime(0.35 * p.volume, t0 + 0.06);
      const dur = kind === 'critical' ? 1.4 : kind === 'info' ? 0.4 : 0.9;
      master.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      master.connect(ctx.destination);
      const freqs = kind === 'info' ? [523.25, 659.25] : [311.13, 369.99, 466.16];
      freqs.forEach((f) => {
        const o = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        o.type = kind === 'info' ? 'sine' : 'sawtooth';
        o.frequency.setValueAtTime(f, t0);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, t0);
        o.connect(filter); filter.connect(master);
        o.start(t0); o.stop(t0 + dur);
      });
    } catch { /* audio unavailable */ }
  }, []);

  const pushToast = useCallback((t) => {
    const id = randomId();
    setToasts((prev) => [{ id, ...t }, ...prev].slice(0, 3));
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.severity === 'CRITICAL' ? 12000 : 8000);
  }, []);

  const notify = useCallback(({ key, title, message, severity, simulated }) => {
    if (key && fired.current.has(key)) return;
    if (key) fired.current.add(key);
    if (fired.current.size > 500) fired.current.clear();
    const p = prefsRef.current;
    pushToast({ title, message, severity, simulated });
    playSound(severity === 'CRITICAL' ? 'critical' : severity === 'WARNING' ? 'warning' : 'info');
    if (p.browser && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try { new Notification(`${simulated ? '[SIMULATION] ' : ''}${title}`, { body: message, tag: key || undefined }); } catch { /* ignore */ }
    }
  }, [playSound, pushToast]);

  // Server-generated alerts
  useEffect(() => onAlert((a) => {
    const p = prefsRef.current;
    if (!p.severities[a.severity]) return;
    if (a.phatakNumbers && a.phatakNumbers.length && !a.phatakNumbers.some((n) => p.watched.includes(n))) return;
    notify({ key: `alert:${a._id}`, title: a.title, message: a.message, severity: a.severity, simulated: a.mode === 'SIMULATION' });
  }), [onAlert, notify]);

  // Client-side advance warnings at the user's own threshold: one per train, for the
  // first watched crossing it will reach.
  useEffect(() => {
    const next = new Map();
    for (const c of crossings) {
      if (!prefs.watched.includes(c.number)) continue;
      for (const pr of c.predictions || []) {
        if (pr.status !== 'APPROACHING' || pr.etaSeconds === null) continue;
        const cur = next.get(pr.trainNumber);
        if (!cur || pr.etaSeconds < cur.pr.etaSeconds) next.set(pr.trainNumber, { c, pr });
      }
    }
    for (const { c, pr } of next.values()) {
      if (pr.etaSeconds <= prefs.warningMinutes * 60 && pr.etaSeconds > 30) {
        notify({
          key: `adv:${mode}:${pr.trainNumber}:${prefs.warningMinutes}`,
          title: `Phatak ${c.number}: train in ~${Math.max(1, Math.round(pr.etaSeconds / 60))} min`,
          message: `Train ${pr.trainNumber} predicted at ${new Date(pr.predictedArrival).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })} (${pr.confidence.toLowerCase()} confidence, ${pr.source.replace(/_/g, ' ').toLowerCase()}).`,
          severity: 'WARNING',
          simulated: mode === 'SIMULATION'
        });
      }
    }
  }, [crossings, prefs.watched, prefs.warningMinutes, mode, notify]);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const r = await Notification.requestPermission();
    setPermission(r);
    if (r === 'granted') update({ browser: true });
    return r;
  }, [update]);

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const value = useMemo(() => ({ prefs, update, toasts, dismiss, playSound, permission, requestBrowserPermission }), [prefs, update, toasts, dismiss, playSound, permission, requestBrowserPermission]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
