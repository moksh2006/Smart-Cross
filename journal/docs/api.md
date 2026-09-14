# SMARTCROSS — REST & WebSocket API Reference

## Base URL
`http://localhost:5000/api`

---

## REST Endpoints

### 1. Phataks
- `GET /api/phataks`: List all 4 phataks with current status, active train, distances, and active predictions.
- `GET /api/phataks/:id`: Single phatak details with recent gate event transition history.
- `GET /api/phataks/nearby?lat={lat}&lon={lon}&radius={meters}`: Find phataks sorted by distance from user coordinates.

### 2. Trains
- `GET /api/trains`: List all 15 monitored trains with current speed, delay, direction, and next phatak.
- `GET /api/trains/:number`: Details of a specific train with route polyline geometry and schedule stops.
- `POST /api/trains/:number/refresh`: Trigger on-demand live RailRadar telemetry fetch.

### 3. Predictions
- `GET /api/predictions`: Get active predictions across all phataks.
- `POST /api/predictions/recalculate`: Trigger on-demand prediction recalculation.

### 4. Alerts
- `GET /api/alerts?limit=50&phatak=19`: Get historical status transition alerts.
- `POST /api/alerts/subscribe`: Register client push notification subscription.

### 5. Administration
- `GET /api/admin/metrics`: Fetch KPI metrics, gate status counts, API latency, and MAE evaluations.
- `GET /api/admin/api-logs?limit=50`: Fetch RailRadar API audit trail and response latencies.

### 6. Simulation
- `POST /api/simulation/start`: Body: `{ direction: 'PATIALA_TO_DHABLAN', trainNumber: '14507', speedMultiplier: 2 }`
- `POST /api/simulation/stop`: Stop current simulation.
- `POST /api/simulation/reset`: Reset simulation back to start.
- `GET /api/simulation/status`: Current simulation progress.

### 7. System Settings
- `GET /api/settings`: Read dynamic system configuration values.
- `PUT /api/settings`: Update a setting key. Body: `{ key, value, description }`.

---

## Real-Time WebSocket Events (Socket.IO)

| Event Name | Direction | Payload |
|:---|:---:|:---|
| `phatak:update` | Server → Client | Updated phatak status, ETA, and active train |
| `train:update` | Server → Client | Live train coordinates, speed, and heading |
| `gate:status-change` | Server → Client | Genuine gate state transition (`GateEvent`) |
| `alert:new` | Server → Client | New severity-coded alert (`Alert`) |
| `sound:trigger` | Server → Client | Trigger signal for locomotive dual-horn alert |
| `api:status` | Server → Client | API latency and operational health |
| `subscribe:phatak` | Client → Server | Join room `phatak:<id>` |
| `subscribe:train` | Client → Server | Join room `train:<number>` |
