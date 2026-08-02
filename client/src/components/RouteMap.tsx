/**
 * Inline map with a walking route from the user's location to the gym.
 * Leaflet is loaded once from CDN (no npm dep, offline-tolerant), tiles from
 * OSM, the route line from the keyless OSRM demo. Everything degrades: no route
 * → just the two markers; no Leaflet → nothing (the caller keeps a text link).
 */
import { useEffect, useRef } from 'react';
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
      .catch(() => {});
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.lat, from?.lng, to.lat, to.lng]);

  return <div ref={ref} className="gym-map" />;
}
