/**
 * Socket.IO broadcasting.
 *
 * Every payload carries `seq` (snapshot sequence) or a unique `_id`, so clients
 * can discard duplicates and out-of-order events. On connect, the client
 * receives the current snapshot immediately, which also covers reconnections.
 */
const { Server } = require('socket.io');
const { SOCKET_EVENTS } = require('../../config/constants');
const log = require('../../utils/logger')('socket');

class SocketManager {
  constructor() {
    this.io = null;
    this.snapshotProvider = null;
    this.lastSnapshotEmit = 0;
    this.pendingSnapshot = null;
    this.stats = { connections: 0, emitted: 0 };
  }

  init(httpServer, { origins, snapshotProvider }) {
    this.snapshotProvider = snapshotProvider;
    this.io = new Server(httpServer, {
      cors: { origin: origins, methods: ['GET', 'POST'] },
      pingInterval: 20000,
      pingTimeout: 20000
    });
    this.io.on('connection', (socket) => {
      this.stats.connections += 1;
      if (this.snapshotProvider) socket.emit(SOCKET_EVENTS.SNAPSHOT, this.snapshotProvider());
      socket.on('snapshot:request', () => {
        if (this.snapshotProvider) socket.emit(SOCKET_EVENTS.SNAPSHOT, this.snapshotProvider());
      });
    });
    log.info('Socket.IO initialised');
    return this.io;
  }

  clientCount() { return this.io ? this.io.engine.clientsCount : 0; }

  /** Generic emitter used by the engine and alert service. Snapshots are throttled to 2/s. */
  emit(event, payload) {
    if (!this.io) return;
    if (event === SOCKET_EVENTS.SNAPSHOT) {
      const now = Date.now();
      const wait = 500 - (now - this.lastSnapshotEmit);
      this.pendingSnapshot = payload;
      if (wait <= 0) return this.flushSnapshot();
      if (!this.snapshotTimer) this.snapshotTimer = setTimeout(() => this.flushSnapshot(), wait);
      return undefined;
    }
    this.stats.emitted += 1;
    this.io.emit(event, payload);
    return undefined;
  }

  flushSnapshot() {
    clearTimeout(this.snapshotTimer);
    this.snapshotTimer = null;
    if (!this.pendingSnapshot || !this.io) return;
    const snap = this.pendingSnapshot;
    this.pendingSnapshot = null;
    this.lastSnapshotEmit = Date.now();
    this.stats.emitted += 1;
    this.io.emit(SOCKET_EVENTS.SNAPSHOT, snap);
    // Derived fine-grained events for clients that only need part of the data.
    for (const t of snap.trains) this.io.emit(SOCKET_EVENTS.TRAIN_UPDATE, { seq: snap.seq, mode: snap.mode, ...t });
    for (const c of snap.crossings) this.io.emit(SOCKET_EVENTS.PHATAK_UPDATE, { seq: snap.seq, mode: snap.mode, ...c });
  }

  close() {
    clearTimeout(this.snapshotTimer);
    if (this.io) this.io.close();
    this.io = null;
  }
}

module.exports = new SocketManager();
