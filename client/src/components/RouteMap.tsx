/**
 * Inline map with a walking route from the user's location to the gym. With a stored `track` (the points of a
 * logged activity) it draws that polyline instead, offline: no Leaflet, no tiles, no network (R-KIT-06).
 * Leaflet is loaded once from CDN (no npm dep, offline-tolerant), tiles from
 * OSM, the route line from the keyless OSRM demo. Everything degrades: no route
 * → just the two markers; no Leaflet → nothing (the caller keeps a text link).
 * The live map (Leaflet from unpkg, tiles, the route) exists only with the gym-search consent (SPO-293): without it
 * nothing is loaded or sent and a "Maps are off" strip takes its place.
 */
import { useEffect, useRef, useState } from 'react';
import type { Coords } from '../data/gymProviders';
import { geoSignal, isGeoSearchOn } from '../data/geoSearchGate';
import { GeoOffNotice } from '../legal/GeoOff';
import { useGeoSearchOn } from '../legal/useGeoSearch';

/* eslint-disable @typescript-eslint/no-explicit-any */
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => resolve(w.L);
    js.onerror = () => {
      // Do not remember a failed load: the next call tries again (and drops the dead tags).
      leafletPromise = null;
      css.remove();
      js.remove();
      reject(new Error('leaflet failed to load'));
    };
    document.head.appendChild(js);
  });
  return leafletPromise;
}

export type RouteMapProps =
  | { from: Coords | null; to: Coords; track?: undefined; chip?: undefined; label?: undefined }
  | {
      /** Stored GPS points [lat, lng], in order. */
      track: readonly (readonly [number, number])[];
      /** Optional small chip over the map ("5.1 km"). */
      chip?: string;
      /** Spoken name of the trace. */
      label?: string;
      from?: undefined;
      to?: undefined;
    };

export function RouteMap(props: RouteMapProps) {
  return props.track ? (
    <TrackMap track={props.track} chip={props.chip} label={props.label} />
  ) : (
    <LiveRouteMap from={props.from} to={props.to} />
  );
}

/** A stored polyline on the static map background: start dot, accent line, end dot. Pure SVG, no network. */
function TrackMap({
  track,
  chip,
  label,
}: {
  track: readonly (readonly [number, number])[];
  chip?: string;
  label?: string;
}) {
  const w = 340;
  const h = 160;
  const pad = 14;
  const pts = track.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return null;
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const minLa = Math.min(...lats);
  const maxLa = Math.max(...lats);
  const minLn = Math.min(...lngs);
  const maxLn = Math.max(...lngs);
  // longitude degrees are shorter than latitude degrees away from the equator
  const cosLat = Math.cos((((minLa + maxLa) / 2) * Math.PI) / 180);
  const spanX = (maxLn - minLn) * cosLat || 1e-6;
  const spanY = maxLa - minLa || 1e-6;
  const k = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
  const ox = (w - spanX * k) / 2;
  const oy = (h - spanY * k) / 2;
  const xy = pts.map(([la, ln]) => [ox + (ln - minLn) * cosLat * k, h - oy - (la - minLa) * k]);
  const d = xy.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const a = xy[0];
  const z = xy[xy.length - 1];
  return (
    <div className="gym-map route-map" role="img" aria-label={label}>
      <div className="route-map-fallback">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path className="map-route" d={d} />
          <circle className="map-dot start" cx={a[0]} cy={a[1]} r="6" />
          <circle className="map-dot end" cx={z[0]} cy={z[1]} r="8" />
        </svg>
        {chip && (
          <div className="route-map-chip">
            <span className="map-dot-inline" />
            {chip}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveRouteMap({ from, to }: { from: Coords | null; to: Coords }) {
  const on = useGeoSearchOn();
  if (!on)
    return (
      <div className="gym-map route-map">
        <GeoOffNotice map />
      </div>
    );
  return <ConsentedRouteMap from={from} to={to} />;
}

function ConsentedRouteMap({ from, to }: { from: Coords | null; to: Coords }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const routeKey = `${from?.lat ?? 'none'}:${from?.lng ?? 'none'}:${to.lat}:${to.lng}`;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const ready = readyKey === routeKey;

  useEffect(() => {
    let cancelled = false;
    let map: any;
    // Cancels the route request when the map goes away (gym search turned off unmounts it) or the route changes.
    const abort = new AbortController();
    loadLeaflet()
      .then(async (L: any) => {
        if (cancelled || !ref.current) return;
        map = L.map(ref.current, { zoomControl: true }).setView([to.lat, to.lng], 15);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        }).addTo(map);
        L.circleMarker([to.lat, to.lng], {
          radius: 8,
          color: '#d9a24f',
          fillColor: '#d9a24f',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        if (!from) return;
        L.circleMarker([from.lat, from.lng], {
          radius: 6,
          color: '#4cbe8c',
          fillColor: '#4cbe8c',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        const fallbackBounds = () =>
          map.fitBounds(
            L.latLngBounds([
              [from.lat, from.lng],
              [to.lat, to.lng],
            ]).pad(0.3),
          );
        try {
          if (!isGeoSearchOn()) return;
          const r = await fetch(
            `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
            { signal: geoSignal(abort.signal) },
          );
          const j = await r.json();
          const coords = j.routes?.[0]?.geometry?.coordinates as number[][] | undefined;
          if (coords && coords.length && !cancelled) {
            const line = L.polyline(
              coords.map((c) => [c[1], c[0]]),
              { color: '#d9a24f', weight: 4, opacity: 0.9 },
            ).addTo(map);
            map.fitBounds(line.getBounds().pad(0.2));
          } else {
            fallbackBounds();
          }
        } catch {
          if (!cancelled) fallbackBounds();
        }
      })
      .then(() => {
        if (!cancelled) setReadyKey(routeKey);
      })
      .catch(() => {
        if (!cancelled) setReadyKey(null);
      });
    return () => {
      cancelled = true;
      abort.abort();
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.lat, from?.lng, routeKey, to.lat, to.lng]);

  return (
    <div className={`gym-map route-map${ready ? ' ready' : ''}`}>
      <StaticRouteMap from={from} to={to} />
      <div ref={ref} className="route-map-live" />
    </div>
  );
}

function StaticRouteMap({ from, to }: { from: Coords | null; to: Coords }) {
  const hasRoute = !!from;
  const latDelta = from ? to.lat - from.lat : 0.002;
  const lngDelta = from ? to.lng - from.lng : 0.004;
  const flipX = lngDelta < 0 ? -1 : 1;
  const flipY = latDelta > 0 ? -1 : 1;

  return (
    <div className="route-map-fallback" aria-hidden>
      <svg viewBox="0 0 340 160" preserveAspectRatio="none">
        <path className="map-road major" d="M-10 124 C64 100 108 96 172 70 S272 34 350 26" />
        <path className="map-road" d="M28 8 C74 40 118 54 174 48 S256 48 324 86" />
        <path className="map-road" d="M54 170 C92 132 118 104 138 60 S178 4 236 -12" />
        <path className="map-road thin" d="M-6 58 H356" />
        <path className="map-road thin" d="M204 -12 V172" />
        {hasRoute ? (
          <g transform={`translate(170 80) scale(${flipX} ${flipY}) translate(-170 -80)`}>
            <path
              className="map-route"
              d="M46 132 C68 124 78 116 92 104 C106 90 122 88 142 78 C164 66 176 48 202 44 C228 40 248 34 286 28"
            />
            <circle className="map-dot start" cx="46" cy="132" r="6" />
            <circle className="map-dot end" cx="286" cy="28" r="8" />
          </g>
        ) : (
          <circle className="map-dot end" cx="236" cy="66" r="8" />
        )}
      </svg>
      <div className="route-map-chip">
        <span className="map-dot-inline" />
        {hasRoute ? 'Route ready' : `${to.lat.toFixed(4)}, ${to.lng.toFixed(4)}`}
      </div>
    </div>
  );
}
