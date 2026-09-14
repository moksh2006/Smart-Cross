# SMARTCROSS — Architecture & System Design

```
RailRadar API (Live + Route + Schedule)
        ↓
Train Data Ingestion & Normalizer (liveTrainService / trainScheduleService)
        ↓
Railway Track Geometry Processing (routeGeometryProcessor / Turf.js)
        ↓
Train → Phatak Mapping Engine (mappingEngine / Corridor Threshold 100m)
        ↓
Route-Based ETA Calculation (etaCalculator / fallbackPredictor)
        ↓
Gate State Machine (gateStateMachine: OPEN → CLOSING_SOON → CLOSED → OPENING_SOON → OPEN)
        ↓
MongoDB Persistence (15 Collections: Phatak, Train, GateEvent, Alert, etc.)
        ↓
Real-Time Socket.IO Broadcasting (Rooms: phatak:<id>, train:<number>, admin)
        ↓
Frontend Dashboard & Interactive Leaflet Map (React + Vite + Tailwind + Leaflet)
        ↓
Honking Alert Audio (HTML5 Audio + Web Audio Dual-Tone Synthesizer)
```

---

## 1. 5-Tier Fallback Hierarchy

| Level | Data Source | Confidence | Method Enum |
|:---:|:---|:---:|:---|
| **1** | Real-time RailRadar GPS position & speed | `HIGH` | `LIVE_POSITION` |
| **2** | Latest stored live snapshot (dead reckoning within 15 min) | `MEDIUM` | `LATEST_OBSERVATION` |
| **3** | Timetable schedule + known delay offset | `MEDIUM` | `TIMETABLE_WITH_DELAY` |
| **4** | Historical average travel time (requires $\ge$ 5 samples) | `MEDIUM` | `HISTORICAL_AVERAGE` |
| **5** | Scheduled timetable baseline estimate | `LOW` | `TIMETABLE_ESTIMATE` |
| **--** | Insufficient data / train disappeared | `LOW` | `UNKNOWN` |

---

## 2. Gate State Machine

```
              ┌────────────────────────────────────────────────────────┐
              │                                                        ▼
         ┌─────────┐   ETA <= 10 min    ┌──────────────┐   dist <= 1.2km   ┌────────┐
   ────► │  OPEN   │ ─────────────────► │ CLOSING_SOON │ ────────────────► │ CLOSED │
         └─────────┘                    └──────────────┘                   └────────┘
              ▲                                                                 │
              │                                                                 │ train crosses
              │   dist > 300m past phatak       ┌──────────────┐                │ phatak (< -100m)
              └──────────────────────────────── │ OPENING_SOON │ ◄──────────────┘
                                                └──────────────┘
```

---

## 3. Rate-Limit & Smart Polling

1. **Schedule-Based Polling Windows**: Ingests timetable; only polls live status between `PRE_POLL_MINUTES` (20 min) before departure and `POST_CLEAR_POLL_MINUTES` (10 min) after corridor clearance.
2. **Adaptive Distance Frequency**:
   - Train > 20 km away: 120s polling interval
   - Train 10–20 km away: 60s polling interval
   - Train 3–10 km away: 30s polling interval
   - Train < 3 km away: 15s high-frequency polling
   - Train cleared corridor: 300s polling interval
3. **HTTP 429 Cooldown**: Exponential backoff multiplier prevents repeating failed requests when API rate limits are encountered.
