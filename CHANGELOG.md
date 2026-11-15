# SmartCross 2.0 — changes from the uploaded version

## Bugs fixed
1. **Backend could not start or be tested**: `backend/src/models/*` re-exported `../../../database/models`, which could not resolve `mongoose`. 5 of 9 test suites failed to load, and the backend Docker image (built from `./backend` only) did not contain `database/` at all. Models, seeds and data now live inside the backend.
2. **Committed secrets**: real RailRadar API keys were present in `backend/.env.example` and `server/.env.example`. Removed (rotate them).
3. **Docker networking**: nginx proxied to host `server`, but the compose service was `backend`. Compose had no health checks, and the frontend was built on a port nginx did not serve correctly.
4. **Silent data loss in production**: the DB layer fell back to an in-memory MongoDB even in production. It now fails fast in production.
5. **Wrong RailRadar parsing**: the normalizer guessed field names and snapped trains to station coordinates. The documented live response has no lat/lng; position is now derived from `currentLocation.distanceFromOriginKm` and route km posts.
6. **Fabricated values shown as facts**: `accuracyPercentage` 72–100, fixed `waitingTimeMinutes` 4.2/7.0, hard-coded per-crossing travel minutes. All removed; every value is computed and labelled with source and confidence.
7. **Forced simultaneous closures**: the grouped-closure code forced both crossings of a pair to CLOSED at the same time. Grouping is now advisory (sequence + per-crossing windows + overlap flag).
8. **Real-time misclassification**: `isRealTime = … || !isExplicitNonReal` treated almost any source as real-time.
9. **Predictions never expired**: a train that stopped reporting could keep a crossing closed forever. Data age now drives level 1 → 2 → 3/4/5 → UNKNOWN.
10. **Inconsistent train directions**: the seed metadata contradicted the timetable for 14815, 14735 and 14816. Direction now comes only from the timetable or route order.
11. **Hand-drawn corridor track**: replaced by stitched OpenStreetMap geometry. Projection now corrects longitude scale by cos(latitude).
12. **Admin endpoints unprotected**: settings, simulation and debug endpoints were open. Admin JWT is now required.
13. **Error handler leaked stack traces** outside production.
14. **Frontend**: three pages were unreachable (`Dashboard`, `AlertsPage`, `PhatakDetail`); there was no crossing-detail route, no Simulation page, and a Leaflet CSS dependency on unpkg. A socket connection-state race left the UI showing "Reconnecting" while connected.
15. **Duplicated code**: `scripts/`, `database/` and `backend/src/data` held diverging copies of the same files.
16. **Unused dependencies** removed (`@turf/turf`, `bcryptjs`, `node-cron`).

## Features added or completed
See README → Features. Highlights: OSM-based chainage, five-level fallback with confidence, smoothing and outlier rejection, gate state machine with hysteresis and back-to-back handling, grouped advisories, quota-aware adaptive polling using the `X-RateLimit-*` headers, multi-train simulation through a RailRadar-format mock, passage recording and prediction evaluation, analytics with data-kind labels, live/simulation separation, 9 connected frontend pages, Docker Compose with health checks, and 132 automated tests.

## Test results (final run)
```
Test Suites: 13 passed, 13 total
Tests:       132 passed, 132 total
```
Also verified manually: frontend production build; UI driven in headless Chrome (desktop and mobile, no JS errors); end-to-end live mode against a local fake RailRadar server; production start-up (refuses to start without MONGODB_URI, warns on default secrets); graceful shutdown.

Not verifiable in the build environment: real RailRadar responses (API host unreachable) and `docker compose up` (no Docker daemon; `docker compose config` validates).
