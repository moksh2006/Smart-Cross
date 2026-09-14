import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom SVG Icons for distinct accessibility and visual WOW factor
const createPhatakIcon = (status, number) => {
  let iconHtml = '';
  let borderColor = '#10b981';
  let pulseClass = '';

  switch (status) {
    case 'CLOSED':
      borderColor = '#ef4444';
      pulseClass = 'animate-ping opacity-75';
      iconHtml = `
        <div class="relative flex items-center justify-center w-10 h-10 rounded-xl bg-rose-950 border-2 border-rose-500 shadow-xl shadow-rose-950">
          <div class="absolute inset-0 rounded-xl bg-rose-500 ${pulseClass}"></div>
          <svg class="w-5 h-5 text-rose-300 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span class="absolute -top-2 -right-2 bg-rose-600 text-white font-extrabold text-[10px] px-1 rounded-full border border-slate-900">${number}</span>
        </div>
      `;
      break;

    case 'CLOSING_SOON':
      borderColor = '#f59e0b';
      iconHtml = `
        <div class="relative flex items-center justify-center w-10 h-10 rounded-xl bg-amber-950 border-2 border-amber-500 shadow-xl shadow-amber-950">
          <svg class="w-5 h-5 text-amber-300 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="absolute -top-2 -right-2 bg-amber-600 text-white font-extrabold text-[10px] px-1 rounded-full border border-slate-900">${number}</span>
        </div>
      `;
      break;

    case 'OPENING_SOON':
      borderColor = '#38bdf8';
      iconHtml = `
        <div class="relative flex items-center justify-center w-10 h-10 rounded-xl bg-sky-950 border-2 border-sky-400 shadow-xl shadow-sky-950">
          <svg class="w-5 h-5 text-sky-300 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span class="absolute -top-2 -right-2 bg-sky-600 text-white font-extrabold text-[10px] px-1 rounded-full border border-slate-900">${number}</span>
        </div>
      `;
      break;

    case 'OPEN':
    default:
      borderColor = '#10b981';
      iconHtml = `
        <div class="relative flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-950 border-2 border-emerald-500 shadow-xl shadow-emerald-950">
          <svg class="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span class="absolute -top-2 -right-2 bg-emerald-600 text-white font-extrabold text-[10px] px-1 rounded-full border border-slate-900">${number}</span>
        </div>
      `;
  }

  return L.divIcon({
    className: 'custom-phatak-icon',
    html: iconHtml,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

const createStationIcon = (name, code) => {
  return L.divIcon({
    className: 'custom-station-icon',
    html: `
      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950 border-2 border-indigo-400 text-white shadow-xl shadow-indigo-950/80">
        <svg class="w-4 h-4 text-indigo-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V7h12v4z"/>
        </svg>
        <span class="text-xs font-black tracking-wider font-mono">${code}</span>
      </div>
    `,
    iconSize: [75, 30],
    iconAnchor: [37, 15],
    popupAnchor: [0, -15]
  });
};

const createTrainIcon = (trainNumber, speed) => {
  return L.divIcon({
    className: 'custom-train-icon',
    html: `
      <div class="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 border-2 border-white shadow-2xl shadow-sky-500/80 animate-pulse">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span class="absolute -bottom-2 font-mono font-black text-[9px] bg-black/90 text-sky-300 px-1.5 py-0.5 rounded-full border border-sky-400">
          ${trainNumber}
        </span>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
  });
};

export const LiveMap = ({ phataks = [], trains = [], trackGeometry = [], userLocation = null, selectedPhatakId = null }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    trackLine: null,
    phatakMarkers: new Map(),
    stationMarkers: [],
    trainMarkers: new Map(),
    userMarker: null
  });

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center map on Patiala corridor (between PTA and DBN)
    const map = L.map(mapContainerRef.current, {
      center: [30.3395, 76.3850],
      zoom: 13,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: true
    });

    // Watermark-free, high-performance Dark GIS Canvas (Esri World Dark Gray)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    // Dark crisp labels overlay
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxZoom: 18,
      opacity: 0.85
    }).addTo(map);

    mapInstanceRef.current = map;

    // Add Patiala (PTA) and Dhablan (DBN) station markers
    const ptaMarker = L.marker([30.3385, 76.4102], {
      icon: createStationIcon('Patiala Junction', 'PTA')
    }).bindPopup('<div class="font-bold text-sm">Patiala Jn (PTA)</div><div class="text-xs text-slate-400">Northern Railway Station</div>').addTo(map);

    const dbnMarker = L.marker([30.3380, 76.3045], {
      icon: createStationIcon('Dhablan Station', 'DBN')
    }).bindPopup('<div class="font-bold text-sm">Dhablan (DBN)</div><div class="text-xs text-slate-400">Northern Railway Station</div>').addTo(map);

    layersRef.current.stationMarkers = [ptaMarker, dbnMarker];

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Authoritative Track Line Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing track polyline
    if (layersRef.current.trackLine) {
      map.removeLayer(layersRef.current.trackLine);
    }

    // Coordinates in GeoJSON are [lon, lat]; Leaflet polyline expects [lat, lon]
    const defaultTrack = [
      [30.3385, 76.4102], // PTA
      [30.3390, 76.4050],
      [30.339583, 76.398417], // 19
      [30.339667, 76.392583], // 20
      [30.3398, 76.3850],
      [30.3400, 76.3750],
      [30.340222, 76.366583], // 23
      [30.339972, 76.356778], // 24
      [30.3392, 76.3350],
      [30.3385, 76.3150],
      [30.3380, 76.3045]  // DBN
    ];

    const polylineCoords = (trackGeometry && trackGeometry.length > 0)
      ? trackGeometry.map(pt => [pt[1], pt[0]])
      : defaultTrack;

    // Glowing track outline
    L.polyline(polylineCoords, {
      color: '#38bdf8',
      weight: 8,
      opacity: 0.3,
      smoothFactor: 1
    }).addTo(map);

    // Core railway track
    const line = L.polyline(polylineCoords, {
      color: '#0284c7',
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.9,
      smoothFactor: 1
    }).addTo(map);

    layersRef.current.trackLine = line;
  }, [trackGeometry]);

  // 3. Render / Update Phatak Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !phataks) return;

    const existingMarkers = layersRef.current.phatakMarkers;

    phataks.forEach((phatak) => {
      const [lon, lat] = phatak.location.coordinates;
      const status = phatak.currentStatus || 'OPEN';
      const icon = createPhatakIcon(status, phatak.number);

      const pred = phatak.prediction;
      const nextTrain = pred?.trainNumber || phatak.activeTrainNumber || 'None';
      const distKm = pred?.distanceToPhatakMeters !== undefined
        ? (pred.distanceToPhatakMeters > 0 ? `${(pred.distanceToPhatakMeters / 1000).toFixed(1)} km` : 'At Crossing')
        : '--';
      const etaFormatted = pred?.etaMinutes !== undefined
        ? (pred.etaMinutes > 0 ? `${Math.floor(pred.etaMinutes)} min ${Math.round((pred.etaMinutes % 1) * 60)} sec` : '0 min')
        : '--';
      const trainObj = (trains || []).find(t => t.trainNumber === nextTrain);
      const trainSpeed = pred?.speedKmh || trainObj?.speed || 0;
      const trainDir = trainObj?.direction === 'PATIALA_TO_DHABLAN' ? 'Patiala → Dhablan' : trainObj?.direction === 'DHABLAN_TO_PATIALA' ? 'Dhablan → Patiala' : (trainObj?.direction || 'In Corridor');
      const dataSource = (pred?.dataSource === 'LIVE_API' || trainObj?.dataSource === 'LIVE_API') ? 'LIVE' : 'PREDICTED';
      const updatedTime = phatak.statusUpdatedAt ? new Date(phatak.statusUpdatedAt).toLocaleTimeString() : new Date().toLocaleTimeString();

      const popupContent = `
        <div class="p-2 min-w-[200px] font-sans text-slate-100 bg-slate-950/95 rounded-xl">
          <div class="font-black text-lg text-white border-b border-slate-800 pb-1 mb-2">Phatak ${phatak.number}</div>
          
          <div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Current State:</div>
          <div class="text-sm font-black mb-2 ${
            status === 'CLOSED' ? 'text-rose-400' :
            status === 'CLOSING_SOON' ? 'text-amber-400' :
            status === 'OPENING_SOON' ? 'text-sky-400' :
            'text-emerald-400'
          }">${status}</div>

          <div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Next Train:</div>
          <div class="text-sm font-mono font-bold text-sky-300 mb-2">${nextTrain}</div>

          <div class="grid grid-cols-2 gap-2 text-xs mb-2">
            <div>
              <div class="text-[10px] text-slate-400 uppercase">Distance:</div>
              <div class="font-bold text-white font-mono">${distKm}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 uppercase">ETA:</div>
              <div class="font-bold text-amber-300 font-mono">${etaFormatted}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs mb-2">
            <div>
              <div class="text-[10px] text-slate-400 uppercase">Train Speed:</div>
              <div class="font-semibold text-slate-200 font-mono">${trainSpeed} km/h</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 uppercase">Data:</div>
              <div class="font-bold ${dataSource === 'LIVE' ? 'text-emerald-400' : 'text-amber-400'}">${dataSource}</div>
            </div>
          </div>

          <div class="text-[10px] text-slate-400 uppercase">Direction:</div>
          <div class="text-xs font-semibold text-slate-200 mb-2">${trainDir}</div>

          <div class="text-[10px] text-slate-500 border-t border-slate-800 pt-1">
            Last Updated: <span class="font-mono text-slate-400">${updatedTime}</span>
          </div>
        </div>
      `;

      if (existingMarkers.has(phatak.number)) {
        const marker = existingMarkers.get(phatak.number);
        marker.setLatLng([lat, lon]);
        marker.setIcon(icon);
        marker.setPopupContent(popupContent);
      } else {
        const marker = L.marker([lat, lon], { icon })
          .bindPopup(popupContent)
          .addTo(map);
        existingMarkers.set(phatak.number, marker);
      }
    });
  }, [phataks]);

  // 4. Render / Update Live Train Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const trainMarkers = layersRef.current.trainMarkers;

    // Filter active trains with strictly validated coordinates (only show active/approaching corridor trains)
    const activeTrains = (trains || []).filter(t => {
      if (!t || !t.currentLocation || !Array.isArray(t.currentLocation.coordinates) || t.currentLocation.coordinates.length < 2) {
        return false;
      }
      const lon = parseFloat(t.currentLocation.coordinates[0]);
      const lat = parseFloat(t.currentLocation.coordinates[1]);
      const isValid = (
        !isNaN(lon) && !isNaN(lat) &&
        lat >= -90 && lat <= 90 &&
        lon >= -180 && lon <= 180
      );
      if (!isValid) return false;

      // Only show trains that are in corridor, approaching, or actively moving
      return Boolean(
        t.inCorridor ||
        t.isApproaching ||
        t.status === 'IN_CORRIDOR' ||
        t.status === 'APPROACHING' ||
        t.status === 'ACTIVE' ||
        (t.speed || 0) > 0
      );
    });

    // Remove trains no longer active
    const activeTrainNumbers = new Set(activeTrains.map(t => t.trainNumber));
    for (const [tNo, marker] of trainMarkers.entries()) {
      if (!activeTrainNumbers.has(tNo)) {
        map.removeLayer(marker);
        trainMarkers.delete(tNo);
      }
    }

    activeTrains.forEach(train => {
      const lon = parseFloat(train.currentLocation.coordinates[0]);
      const lat = parseFloat(train.currentLocation.coordinates[1]);
      const icon = createTrainIcon(train.trainNumber, train.speed);

      const popupHtml = `
        <div class="p-1">
          <div class="font-extrabold text-sm text-white font-mono">Train ${train.trainNumber}</div>
          <div class="text-xs text-slate-300">${train.trainName || 'Express'}</div>
          <div class="text-xs text-sky-400 font-semibold mt-1">Speed: ${train.speed || 0} km/h</div>
          <div class="text-[11px] text-slate-400">Direction: ${train.direction || 'In Corridor'}</div>
        </div>
      `;

      if (trainMarkers.has(train.trainNumber)) {
        const marker = trainMarkers.get(train.trainNumber);
        marker.setLatLng([lat, lon]);
        marker.setIcon(icon);
        marker.setPopupContent(popupHtml);
      } else {
        const marker = L.marker([lat, lon], { icon })
          .bindPopup(popupHtml)
          .addTo(map);
        trainMarkers.set(train.trainNumber, marker);
      }
    });
  }, [trains]);

  // 5. Render User Location Pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    if (layersRef.current.userMarker) {
      map.removeLayer(layersRef.current.userMarker);
    }

    const userIcon = L.divIcon({
      className: 'user-pin-icon',
      html: `
        <div class="relative flex items-center justify-center w-6 h-6">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-500 border-2 border-white shadow-lg"></span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
      .bindPopup('<div class="text-xs font-bold text-slate-200">Your Location</div>')
      .addTo(map);

    layersRef.current.userMarker = marker;
  }, [userLocation]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};

export default LiveMap;
