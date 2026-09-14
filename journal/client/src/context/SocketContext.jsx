import React, { createContext, useContext, useEffect, useState } from 'react';
import socket from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    // Sync initial connection state immediately (handles StrictMode remounts and pre-connected sockets)
    setIsConnected(socket.connected);

    function onConnect() {
      setIsConnected(true);
      console.log('[Socket] Connected to SmartCross real-time stream.');
    }

    function onDisconnect() {
      setIsConnected(false);
      console.log('[Socket] Disconnected from SmartCross stream.');
    }

    function onConnectError(err) {
      setIsConnected(false);
      console.warn('[Socket] Stream connection error:', err?.message || err);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io?.on?.('reconnect', onConnect);

    // Periodic heartbeat to guarantee React state never drifts from socket.connected
    const syncInterval = setInterval(() => {
      setIsConnected(curr => (socket.connected !== curr ? socket.connected : curr));
    }, 1500);

    return () => {
      clearInterval(syncInterval);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io?.off?.('reconnect', onConnect);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, lastEvent, setLastEvent }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
