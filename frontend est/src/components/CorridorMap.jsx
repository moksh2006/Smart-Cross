import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { STATE_META, DIRECTION_META } from '../lib/constants';
import { useLiveData } from '../context/LiveDataContext';

const toLatLng = (c) => [c[1], c[0]];

function trainIcon(train, selected) {
  const color = train.isSimulated ? '#e879f9' : train.isStale ? '#94a3b8' : '#38bdf8';
  const heading = Number.isFinite(train.heading) ? train.heading : 0;
  const size = selected ? 34 : 28;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;position:relative">
      <div style="position:absolute;inset:0;border-radius:9999px;background:${color}33;border:2px solid ${color};${selected ? 'box-shadow:0 0 0 4px #ffffff33;' : ''}"></div>
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" style="position:absolute;inset:0;transform:rotate(${heading}deg)">
        <path d="M12 3 L18 17 L12 13.5 L6 17 Z" fill="${color}" stroke="#0f172a" stroke-width="1"/>
      </svg></div>`
  });
}

function crossingIcon(c, selected) {
  const m = STATE_META[c.state] || STATE_META.UNKNOWN;
  const size = selected ? 34 : 28;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="${c.state === 'CLOSED' ? 'pulse-danger' : c.state === 'CLOSING_SOON' ? 'pulse-warn' : ''}" style="width:${size}px;height:${size}px;border-radius:8px;background:${m.color};border:2px solid #0f172a;display:grid;place-items:center;color:#0f172a;font-weight:800;font-size:12px;${selected ? 'outline:3px solid #fff;' : ''}">${c.number}</div>`
  });
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [30, 30] });
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, [map, bounds]);
  return null;
}

/**
 * @param {{ height?: string, selected?: {type: 'crossing'|'train', id: any}, onSelect?: Function, focusCrossing?: number }} props
 */
export default function CorridorMap({ height = '520px', selected, onSelect, focusCrossing, showTrains = true }) {
  const { corridor, crossings, trains } = useLiveData();

  const bounds = useMemo(() => {
    if (!corridor) return null;
    if (focusCrossing) {
      const c = corridor.crossings.find((x) => x.number === focusCrossing);
      if (c) { const [lat, lon] = toLatLng(c.coordinates); return [[lat - 0.006, lon - 0.012], [lat + 0.006, lon + 0.012]]; }
    }
    return L.latLngBounds(corridor.geometry.corridor.map(toLatLng)).pad(0.05);
  }, [corridor, focusCrossing]);

  if (!corridor) return <div className="grid place-items-center rounded-2xl bg-slate-900 text-slate-500" style={{ height }}>Loading map…</div>;

  const visibleTrains = showTrains ? trains.filter((t) => Array.isArray(t.coordinates)) : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10" style={{ height }}>
      <MapContainer bounds={bounds} scrollWheelZoom className="h-full w-full" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds bounds={bounds} />
        <Polyline positions={corridor.geometry.regional.map(toLatLng)} pathOptions={{ color: '#475569', weight: 3, dashArray: '6 8' }} />
        <Polyline positions={corridor.geometry.corridor.map(toLatLng)} pathOptions={{ color: '#38bdf8', weight: 5, opacity: 0.85 }}>
          <Tooltip sticky>Patiala – Dhablan corridor (OSM geometry)</Tooltip>
        </Polyline>
        {Object.values(corridor.stations).map((s) => (
          <CircleMarker key={s.code} center={toLatLng(s.coordinates)} radius={7} pathOptions={{ color: '#e2e8f0', fillColor: '#1e293b', fillOpacity: 1, weight: 2 }}>
            <Tooltip permanent direction="top" offset={[0, -8]}>{s.name} ({s.code})</Tooltip>
          </CircleMarker>
        ))}
        {crossings.map((c) => (
          <Marker key={`c${c.number}`} position={toLatLng(c.coordinates)} icon={crossingIcon(c, selected && selected.type === 'crossing' && selected.id === c.number)}
            eventHandlers={{ click: () => onSelect && onSelect({ type: 'crossing', id: c.number }) }}>
            <Tooltip direction="bottom" offset={[0, 14]}>Phatak {c.number} · {STATE_META[c.state]?.label}</Tooltip>
          </Marker>
        ))}
        {visibleTrains.map((t) => (
          <Marker key={`t${t.trainNumber}`} position={toLatLng(t.coordinates)} icon={trainIcon(t, selected && selected.type === 'train' && selected.id === t.trainNumber)} zIndexOffset={1000}
            eventHandlers={{ click: () => onSelect && onSelect({ type: 'train', id: t.trainNumber }) }}>
            <Tooltip direction="top" offset={[0, -14]}>{t.trainNumber} · {DIRECTION_META[t.direction]?.short} · {t.isStale ? 'stale' : t.source === 'LIVE_POSITION' ? 'live' : 'estimated'}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
