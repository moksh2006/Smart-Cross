# SMARTCROSS — Patiala Railway Phatak Real-Time Prediction System

SmartCross is a full-stack real-time GIS prediction and gate monitoring platform built specifically for **Patiala (PTA) — Dhablan (DBN)** railway section in Punjab, India, and its four critical railway level crossings: **Phatak 19, Phatak 20, Phatak 23, and Phatak 24**.

---

## 1. Problem Statement

Urban traffic congestion in Patiala is heavily affected by unpredictable railway gate closures along the Northern Railway line. Commuters, emergency vehicles, and public transport regularly get trapped in bottlenecks at Phataks 19, 20, 23, and 24 without prior knowledge of train movements, gate closure times, or expected waiting durations.

SmartCross solves this problem by connecting real-time railway telemetry, authoritative GIS track geometry, dynamic direction detection, and a 5-tier fallback prediction engine to provide:
- Advance warnings before gates physically close (`CLOSING_SOON`).
- Authoritative along-track ETA and road waiting times.
- Real-time gate state machine transitions (`OPEN`, `CLOSING_SOON`, `CLOSED`, `OPENING_SOON`, `UNKNOWN`).
- Locomotive horn audio warnings compliant with browser autoplay restrictions.
- Grouped closure advisories for closely spaced phataks (19 & 20, 23 & 24).
- Interactive Leaflet maps showing live train movements along the railway track.

---

## 2. Architecture & Data Flow

```
RailRadar API
        ↓
Train Data Ingestion (liveTrainService / trainScheduleService)
        ↓
Railway Track Geometry Processing (routeGeometryProcessor / Turf.js)
        ↓
Train → Phatak Mapping Engine (mappingEngine / Corridor Threshold 100m)
        ↓
ETA at Each Phatak (etaCalculator / fallbackPredictor)
        ↓
Gate State Machine (gateStateMachine)
        ↓
MongoDB Persistence (15 Collections / 2dsphere Indexes)
        ↓
Socket.IO Real-Time Streaming
        ↓
Frontend Dashboard & Interactive Leaflet Map (React + Tailwind)
        ↓
Locomotive Dual-Horn Audio Warning
```

---

## 3. The Four Phataks & Authoritative Coordinates

Converted automatically from the project owner's supplied DMS coordinates into decimal degrees and stored as GeoJSON Points `{ type: "Point", coordinates: [longitude, latitude] }`:

| Phatak # | Cross Street / Location | Supplied DMS Latitude | Supplied DMS Longitude | Decimal Latitude | Decimal Longitude | GeoJSON `[lon, lat]` |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| **24** | Dhablan Approach | `30°20'23.9"N` | `76°21'24.4"E` | `30.339972° N` | `76.356778° E` | `[76.356778, 30.339972]` |
| **23** | Model Town Extension | `30°20'24.8"N` | `76°21'59.7"E` | `30.340222° N` | `76.366583° E` | `[76.366583, 30.340222]` |
| **20** | Sirhind Road | `30°20'22.8"N` | `76°23'33.3"E` | `30.339667° N` | `76.392583° E` | `[76.392583, 30.339667]` |
| **19** | Station Approach | `30°20'22.5"N` | `76°23'54.3"E` | `30.339583° N` | `76.398417° E` | `[76.398417, 30.339583]` |

### Inter-Phatak Geodetic Distances
- **Distance 19 ↔ 20**: **559.9 meters** *(Owner initial estimate: ~700m)*
- **Distance 20 ↔ 23**: **2,495.9 meters** *(Owner initial estimate: ~3,000m)*
- **Distance 23 ↔ 24**: **941.4 meters** *(Owner initial estimate: ~700m)*
- **Total Corridor Span (19 ↔ 24)**: **3,996.2 meters (~4.00 km)**

---

## 4. Railway Stations & Direction Detection

The corridor is bounded by:
- **Patiala Junction (PTA)**: `[76.4102, 30.3385]` (East)
- **Dhablan (DBN)**: `[76.3045, 30.3380]` (West)

### Dynamic Phatak Sequence
- **Patiala → Dhablan (`PATIALA_TO_DHABLAN` / Westbound)**:
  `PTA → Phatak 19 → Phatak 20 → Phatak 23 → Phatak 24 → DBN`
- **Dhablan → Patiala (`DHABLAN_TO_PATIALA` / Eastbound)**:
  `DBN → Phatak 24 → Phatak 23 → Phatak 20 → Phatak 19 → PTA`

---

## 5. Monitored Trains (15 Initial Trains)

`14508`, `14815`, `54552`, `11058`, `14735`, `14526`, `14510`, `14736`, `11057`, `54551`, `14507`, `54553`, `14816`, `26461`, `26462`.

Stored in MongoDB and fully configurable in `SystemSettings` without code changes.

---

## 6. RailRadar API Integration & Smart Polling

Endpoints integrated:
- **Live Status**: `https://api.railradar.in/v1/trains/{number}/live`
- **Timetable**: `https://api.railradar.in/v1/trains/{number}`
- **Route Geometry**: `https://api.railradar.in/v1/trains/{number}/route`
- **Live Map Snapshot Legacy**: `https://api.railradar.in/v1/legacy/trains/live-map`

Features:
- Never exposes API keys in frontend.
- Exponential backoff with HTTP 429 rate limit cooldown.
- Schedule-based polling window: activates `PRE_POLL_MINUTES` (20m) before train scheduled departure and stops `POST_CLEAR_POLL_MINUTES` (10m) after passing.
- Distance-based adaptive polling (>20km: 120s, 10–20km: 60s, 3–10km: 30s, <3km: 15s).

---

## 7. 5-Tier Fallback Hierarchy

1. **Level 1**: Live RailRadar GPS position + speed (`LIVE_POSITION`, HIGH confidence)
2. **Level 2**: Latest stored snapshot dead reckoning within 15m (`LATEST_OBSERVATION`, MEDIUM confidence)
3. **Level 3**: Timetable schedule + current known delay (`TIMETABLE_WITH_DELAY`, MEDIUM confidence)
4. **Level 4**: Historical average transit time with $\ge$ 5 samples (`HISTORICAL_AVERAGE`, MEDIUM confidence)
5. **Level 5**: Scheduled timetable estimate (`TIMETABLE_ESTIMATE`, LOW confidence)
Fallback: `UNKNOWN` if data is insufficient.

---

## 8. Gate State Machine

States: `OPEN` → `CLOSING_SOON` → `CLOSED` → `OPENING_SOON` → `OPEN`.
- `CLOSING_SOON`: Train ETA $\le$ `CLOSING_SOON_THRESHOLD_MINUTES` (default 10 min).
- `CLOSED`: Train within `CLOSURE_DISTANCE_METERS` (1200m) or ETA $\le$ 2.5 min.
- `OPENING_SOON`: Train crosses phatak ($<-100$m).
- `OPEN`: Train clears clearance buffer ($>300$m past phatak).
- Multi-Train Contention: Earliest approaching train controls the active gate state.
- Deduplication: Strictly suppresses duplicate alerts if the status has not changed.

---

## 9. Audio Alert System

- Preloaded audio asset at `/sounds/train-horn.mp3` (105 KB authentic dual-tone chime).
- Embedded Web Audio API synthesizer fallback (frequencies 311.13 Hz, 369.99 Hz, 466.16 Hz Nathan chime with harmonic distortion).
- Browser Autoplay Compliance: Provides an interactive **Enable Alert Sound** toggle, volume control, and master mute.
- Plays only on genuine status transitions (`OPEN` → `CLOSING_SOON`, `CLOSING_SOON` → `CLOSED`, `CLOSED` → `OPENING_SOON`, `OPENING_SOON` → `OPEN`).

---

## 10. Installation & Quickstart

### Prerequisites
- Node.js v18+ and npm
- MongoDB Atlas connection string (or uses built-in in-memory MongoDB automatically)

### Setup Environment
In `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/smartcross
RAILRADAR_API_KEY=your_railradar_api_key_here
CLIENT_URL=http://localhost:5173
POLL_INTERVAL_SECONDS=30
PRE_POLL_MINUTES=20
ACTIVE_POLL_INTERVAL_SECONDS=30
POST_CLEAR_POLL_MINUTES=10
CLOSING_SOON_THRESHOLD_MINUTES=10
OPENING_BUFFER_MINUTES=3
PHATAK_ROUTE_CORRIDOR_METERS=100
GROUPED_CLOSURE_TOLERANCE_SECONDS=120
MIN_HISTORICAL_SAMPLES=5
DEFAULT_ALERT_RADIUS_METERS=1500
STALE_DATA_THRESHOLD_SECONDS=120
NODE_ENV=development
```

### Install Dependencies
```bash
# From workspace root
npm --prefix server install
npm --prefix client install
```

### Verify Coordinates
```bash
node scripts/verifyCoordinates.js
```

### Seed Database
```bash
node scripts/seedDatabase.js
```

### Run Automated Test Suite (All 5 Scenarios)
```bash
npm --prefix server test
# Or run standalone scenario runner:
node scripts/runScenarios.js
```

### Start Server & Client
```bash
# Terminal 1: Backend Server (Port 5000)
npm --prefix server start

# Terminal 2: React Frontend (Port 5173)
npm --prefix client run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 11. Interactive Presentation Demo

1. Open `http://localhost:5173`.
2. Click **Enable Sound** in top navigation bar to unlock audio playback.
3. Click **Demo Simulation** in top navigation bar.
4. Select direction: **Patiala → Dhablan** (or Dhablan → Patiala) and speed (2x Fast).
5. Click **Start Simulation**:
   - The train marker appears at Patiala Station and travels west along the railway track.
   - Phatak 19 transitions to `CLOSING_SOON` $\rightarrow$ Warning alert banner displays $\rightarrow$ Train horn sounds.
   - Phatak 19 transitions to `CLOSED` $\rightarrow$ Critical red alert displays $\rightarrow$ Train horn sounds.
   - Train crosses Phatak 19 $\rightarrow$ Transitions to `OPENING_SOON` $\rightarrow$ `OPEN`.
   - Downstream Phataks 20, 23, 24 dynamically follow in sequence.
   - Navigate to `/analytics` and `/admin` to see live MAE metrics and API logs.

---

## 12. Docker Deployment

```bash
docker-compose up --build
```
Spins up MongoDB, Express API (`5000`), and Nginx React Client (`5173`).

---

## 13. Limitations & Future Work

1. **Cellular Signal Dead-Zones**: Trains crossing rural sections between PTA and DBN may experience intermittent GPS drops. Handled via Level 2 dead reckoning and Level 3 timetable fallback.
2. **Manual Gatekeeper Delays**: Operating conditions may cause human gatekeepers to close gates earlier than scheduled. The system provides real-time adjustment via the admin thresholds.
3. **Future Work**: IoT optical barrier sensors directly mounted at Phataks 19, 20, 23, and 24 to cross-validate physical barrier arm angle in addition to GPS track telemetry.
