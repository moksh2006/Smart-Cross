# SMARTCROSS — Patiala Railway Phatak Level Crossing Specifications

## 1. Phatak Locations & Authoritative Coordinates

All 4 level crossings are located along the Northern Railway Ambala–Bathinda line through Patiala city, Punjab, India.

| Phatak # | Location / Cross Street | Supplied DMS Latitude | Supplied DMS Longitude | Decimal Latitude | Decimal Longitude | GeoJSON `[lon, lat]` |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| **24** | Dhablan Approach | `30°20'23.9"N` | `76°21'24.4"E` | `30.339972° N` | `76.356778° E` | `[76.356778, 30.339972]` |
| **23** | Model Town Extension | `30°20'24.8"N` | `76°21'59.7"E` | `30.340222° N` | `76.366583° E` | `[76.366583, 30.340222]` |
| **20** | Sirhind Road Crossing | `30°20'22.8"N` | `76°23'33.3"E` | `30.339667° N` | `76.392583° E` | `[76.392583, 30.339667]` |
| **19** | Patiala Station Approach | `30°20'22.5"N` | `76°23'54.3"E` | `30.339583° N` | `76.398417° E` | `[76.398417, 30.339583]` |

---

## 2. Calculated Geodetic Inter-Phatak Distances

Computed using the Haversine great-circle formula and verified along the railway track geometry:

- **Distance 19 ↔ 20**: **559.9 meters** *(Owner initial estimate: ~700m)*
- **Distance 20 ↔ 23**: **2,495.9 meters** *(Owner initial estimate: ~3,000m)*
- **Distance 23 ↔ 24**: **941.4 meters** *(Owner initial estimate: ~700m)*
- **Total Corridor Span (19 ↔ 24)**: **3,996.2 meters (~4.00 km)**

---

## 3. Directional Sequence

The sequence in which trains encounter the phataks is computed dynamically using railway track geometry:

- **Patiala to Dhablan (`PATIALA_TO_DHABLAN` / Westbound)**:
  `PTA → Phatak 19 → Phatak 20 → Phatak 23 → Phatak 24 → DBN`

- **Dhablan to Patiala (`DHABLAN_TO_PATIALA` / Eastbound)**:
  `DBN → Phatak 24 → Phatak 23 → Phatak 20 → Phatak 19 → PTA`
