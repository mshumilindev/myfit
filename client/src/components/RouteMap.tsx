/**
 * Inline map with a walking route from the user's location to the gym.
 * Leaflet is loaded once from CDN (no npm dep, offline-tolerant), tiles from
 * OSM, the route line from the keyless OSRM demo. Everything degrades: no route
 * → just the two markers; no Leaflet → nothing (the caller keeps a text link).
 */
import { useEffect, useRef, useState } from 'react';
import type { Coords } from '../data/gymProviders';

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
    js.onerror = reject;
    document.head.appendChild(js);
  });
  return leafletPromise;
}

export function RouteMap({ from, to }: { from: Coords | null; to: Coords }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const routeKey = `${from?.lat ?? 'none'}:${from?.lng ?? 'none'}:${to.lat}:${to.lng}`;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const ready = readyKey === routeKey;

  useEffect(() => {
    let cancelled = false;
    let map: any;
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
          const r = await fetch(
            `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
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
