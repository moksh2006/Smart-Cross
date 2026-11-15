import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  timeout: 10000
});
