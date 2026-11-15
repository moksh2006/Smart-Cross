import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { socket } from '../lib/socket';

const LiveDataContext = createContext(null);
const STALE_AFTER_MS = 20000;
const MAX_ALERTS = 150;

/**
 * Single source of truth for real-time data:
 *  - REST snapshot (/api/state) on load and after every reconnect
 *  - Socket.IO 'corridor:snapshot' applied only if its seq is newer (drops duplicates/out-of-order)
 *  - 'alert:new' de-duplicated by _id
 */
export function LiveDataProvider({ children }) {
  const [snapshot, setSnapshot] = useState(null);
  const [corridor, setCorridor] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(socket.connected);
  const [lastMessageAt, setLastMessageAt] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const seqRef = useRef({ seq: -1, mode: null, generatedAt: 0 });
  const alertIds = useRef(new Set());
  const alertListeners = useRef(new Set());

  const applySnapshot = useCallback((snap) => {
    if (!snap || !Array.isArray(snap.crossings)) return;
    const cur = seqRef.current;
    const gen = new Date(snap.generatedAt).getTime() || 0;
    const newer = snap.mode !== cur.mode || snap.seq > cur.seq || (snap.seq < cur.seq && gen > cur.generatedAt + 1000); // server restart
    if (!newer) return;
    seqRef.current = { seq: snap.seq, mode: snap.mode, generatedAt: gen };
    setSnapshot(snap);
    setLastMessageAt(Date.now());
  }, []);

  const addAlerts = useCallback((list, { notify = false } = {}) => {
    const fresh = list.filter((a) => a && a._id && !alertIds.current.has(String(a._id)));
    if (!fresh.length) return;
    fresh.forEach((a) => alertIds.current.add(String(a._id)));
    setAlerts((prev) => [...fresh, ...prev].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, MAX_ALERTS));
    if (notify) fresh.forEach((a) => alertListeners.current.forEach((fn) => fn(a)));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [snap, recent] = await Promise.all([api.state(), api.alerts({ limit: 50 })]);
      applySnapshot(snap);
      addAlerts(recent);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [applySnapshot, addAlerts]);

  useEffect(() => {
    api.corridor().then(setCorridor).catch((e) => setError(e.message));
    refresh();
    const onConnect = () => { setConnected(true); refresh(); };
    const onDisconnect = () => setConnected(false);
    const onSnapshot = (s) => applySnapshot(s);
    const onAlert = (a) => addAlerts([a], { notify: true });
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);
    socket.on('corridor:snapshot', onSnapshot);
    socket.on('alert:new', onAlert);
    // The socket may have connected before this effect subscribed: sync now and on every tick.
    setConnected(socket.connected);
    const tick = setInterval(() => { setNow(Date.now()); setConnected(socket.connected); }, 1000);
    // Polling fallback when the socket is down
    const poll = setInterval(() => { if (!socket.connected) refresh(); }, 15000);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
      socket.off('corridor:snapshot', onSnapshot);
      socket.off('alert:new', onAlert);
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [applySnapshot, addAlerts, refresh]);

  // Clear alert list when the mode changes (live and simulated alerts never mix)
  const mode = snapshot ? snapshot.mode : null;
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current && mode && prevMode.current !== mode) {
      alertIds.current.clear();
      setAlerts([]);
      api.alerts({ limit: 50 }).then((r) => addAlerts(r)).catch(() => {});
    }
    prevMode.current = mode;
  }, [mode, addAlerts]);

  const onAlert = useCallback((fn) => {
    alertListeners.current.add(fn);
    return () => alertListeners.current.delete(fn);
  }, []);

  const isStale = !lastMessageAt || now - lastMessageAt > STALE_AFTER_MS ||
    (snapshot && snapshot.generatedAt && now - new Date(snapshot.generatedAt).getTime() > STALE_AFTER_MS * 3);

  const value = useMemo(() => ({
    snapshot, corridor, alerts, connected, lastMessageAt, isStale, error, now, refresh, onAlert,
    mode,
    crossings: snapshot ? snapshot.crossings : [],
    trains: snapshot ? snapshot.trains : [],
    groups: snapshot ? snapshot.groups : [],
    system: snapshot ? snapshot.system : null
  }), [snapshot, corridor, alerts, connected, lastMessageAt, isStale, error, now, refresh, onAlert, mode]);

  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>;
}

export function useLiveData() {
  const ctx = useContext(LiveDataContext);
  if (!ctx) throw new Error('useLiveData must be used inside LiveDataProvider');
  return ctx;
}
