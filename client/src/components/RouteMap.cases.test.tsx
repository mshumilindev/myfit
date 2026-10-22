import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { resetGeoGateForTests, setGeoSearchState } from '../data/geoSearchGate';
import { RouteMap } from './RouteMap';

/** Maps are gated on the geo-search consent (SPO-293); these cases run with it granted. */
const grantGeo = () => setGeoSearchState({ on: true, ready: true, answered: true });

type AnyFn = (...a: unknown[]) => unknown;
const calls: Record<string, unknown[][]> = {};
const rec = (name: string, ret?: unknown) =>
  ((...a: unknown[]) => {
    (calls[name] ??= []).push(a);
    return ret;
  }) as AnyFn;

let removed = 0;
function fakeLeaflet() {
  const map = {
    setView: (...a: unknown[]) => {
      rec('setView')(...a);
      return map;
    },
    fitBounds: rec('fitBounds'),
    remove: () => {
      removed++;
    },
  };
  const layer = { addTo: () => layer, getBounds: () => ({ pad: () => 'bounds' }) };
  return {
    map: (...a: unknown[]) => {
      rec('map')(...a);
      return map;
    },
    tileLayer: (...a: unknown[]) => {
      rec('tileLayer')(...a);
      return layer;
    },
    circleMarker: (...a: unknown[]) => {
      rec('circleMarker')(...a);
      return layer;
    },
    polyline: (...a: unknown[]) => {
      rec('polyline')(...a);
      return layer;
    },
    latLngBounds: (...a: unknown[]) => {
      rec('latLngBounds')(...a);
      return { pad: () => 'padded' };
    },
  };
}

beforeEach(() => {
  resetGeoGateForTests();
  grantGeo();
  for (const k of Object.keys(calls)) delete calls[k];
  removed = 0;
  delete (window as unknown as { L?: unknown }).L;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

describe('RouteMap · stored track', () => {
  const track = [
    [50.0, 14.0],
    [50.001, 14.002],
    [50.002, 14.001],
  ] as const;

  it('draws a pure-SVG polyline with start and end dots and no network', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { container } = render(<RouteMap track={track} chip="5.1 km" label="Morning run" />);
    const root = container.querySelector('.route-map') as HTMLElement;
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('Morning run');
    const d = container.querySelector('path.map-route')!.getAttribute('d')!;
    expect(d.match(/[ML]/g)).toEqual(['M', 'L', 'L']);
    expect(container.querySelector('.route-map-chip')!.textContent).toBe('5.1 km');
    expect(container.querySelector('circle.start')).toBeTruthy();
    expect(container.querySelector('circle.end')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('puts the first point at lower-left and north upward', () => {
    const { container } = render(<RouteMap track={track} />);
    const a = container.querySelector('circle.start')!;
    const z = container.querySelector('circle.end')!;
    const ay = Number(a.getAttribute('cy'));
    const zy = Number(z.getAttribute('cy'));
    // end (lat 50.002) is north of start (lat 50.0): smaller y
    expect(zy).toBeLessThan(ay);
    expect(Number(z.getAttribute('cx'))).toBeGreaterThan(Number(a.getAttribute('cx')));
    expect(container.querySelector('.route-map-chip')).toBeNull();
  });

  it('renders nothing for fewer than two usable points (NaN/Infinity filtered)', () => {
    const a = render(<RouteMap track={[[1, 2]]} />);
    expect(a.container.firstChild).toBeNull();
    const b = render(
      <RouteMap
        track={[
          [1, 2],
          [Number.NaN, 3],
          [Infinity, 4],
        ]}
      />,
    );
    expect(b.container.firstChild).toBeNull();
  });

  it('survives a degenerate track where every point is the same', () => {
    const { container } = render(
      <RouteMap
        track={[
          [10, 10],
          [10, 10],
        ]}
      />,
    );
    expect(container.innerHTML).not.toContain('NaN');
    expect(container.querySelector('path.map-route')).toBeTruthy();
  });
});

describe('RouteMap · live route', () => {
  const to = { lat: 50.08, lng: 14.43 };
  const from = { lat: 50.07, lng: 14.4 };

  it('renders the static fallback straight away, with the target coordinates when there is no origin', () => {
    const { container } = render(<RouteMap from={null} to={to} />);
    expect(container.querySelector('.route-map')!.classList.contains('ready')).toBe(false);
    expect(container.querySelector('.route-map-chip')!.textContent).toBe('50.0800, 14.4300');
    expect(container.querySelectorAll('circle.end')).toHaveLength(1);
    expect(container.querySelector('circle.start')).toBeNull();
  });

  it('says "Route ready" with an origin, and mirrors the route by direction', () => {
    const east = render(<RouteMap from={{ lat: 50.0, lng: 14.0 }} to={{ lat: 50.1, lng: 14.1 }} />);
    expect(east.container.querySelector('.route-map-chip')!.textContent).toBe('Route ready');
    const g1 = east.container.querySelector('g')!.getAttribute('transform');
    // going north-east: flipY applies (latDelta > 0 -> -1), flipX stays 1
    expect(g1).toContain('scale(1 -1)');
    east.unmount();
    const sw = render(<RouteMap from={{ lat: 50.1, lng: 14.1 }} to={{ lat: 50.0, lng: 14.0 }} />);
    expect(sw.container.querySelector('g')!.getAttribute('transform')).toContain('scale(-1 1)');
  });

  it('draws the OSRM route on the Leaflet map, then marks itself ready', async () => {
    (window as unknown as { L: unknown }).L = fakeLeaflet();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({
          routes: [
            {
              geometry: {
                coordinates: [
                  [14.4, 50.07],
                  [14.43, 50.08],
                ],
              },
            },
          ],
        }),
      })),
    );
    const { container, unmount } = render(<RouteMap from={from} to={to} />);
    await flush();
    expect(calls.setView[0]).toEqual([[50.08, 14.43], 15]);
    expect(calls.circleMarker).toHaveLength(2);
    expect(calls.polyline[0][0]).toEqual([
      [50.07, 14.4],
      [50.08, 14.43],
    ]);
    expect(calls.fitBounds[0]).toEqual(['bounds']);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      '14.4,50.07;14.43,50.08',
    );
    expect(container.querySelector('.route-map')!.classList.contains('ready')).toBe(true);
    unmount();
    expect(removed).toBe(1);
  });

  it('shows only the destination marker (and no request) without an origin', async () => {
    (window as unknown as { L: unknown }).L = fakeLeaflet();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<RouteMap from={null} to={to} />);
    await flush();
    expect(calls.circleMarker).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fits both points when OSRM returns no route', async () => {
    (window as unknown as { L: unknown }).L = fakeLeaflet();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ routes: [] }) })),
    );
    render(<RouteMap from={from} to={to} />);
    await flush();
    expect(calls.polyline).toBeUndefined();
    expect(calls.latLngBounds[0][0]).toEqual([
      [50.07, 14.4],
      [50.08, 14.43],
    ]);
    expect(calls.fitBounds[0]).toEqual(['padded']);
  });

  it('fits both points when the routing request fails', async () => {
    (window as unknown as { L: unknown }).L = fakeLeaflet();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    );
    const { container } = render(<RouteMap from={from} to={to} />);
    await flush();
    expect(calls.fitBounds[0]).toEqual(['padded']);
    expect(container.querySelector('.route-map')!.classList.contains('ready')).toBe(true);
  });

  it('stays on the static fallback when Leaflet cannot load', async () => {
    vi.resetModules();
    const freshGate = await import('../data/geoSearchGate');
    freshGate.setGeoSearchState({ on: true, ready: true, answered: true });
    const { RouteMap: Fresh } = await import('./RouteMap');
    const { container } = render(<Fresh from={from} to={to} />);
    const script = document.head.querySelector('script[src*="leaflet"]') as HTMLScriptElement;
    expect(script).toBeTruthy();
    expect(document.head.querySelector('link[href*="leaflet"]')).toBeTruthy();
    await act(async () => {
      script.onerror?.(new Event('error'));
    });
    expect(container.querySelector('.route-map')!.classList.contains('ready')).toBe(false);
    expect(container.querySelector('.route-map-fallback')).toBeTruthy();
  });

  it('loads Leaflet once from the CDN and reuses the pending promise', async () => {
    vi.resetModules();
    const freshGate = await import('../data/geoSearchGate');
    freshGate.setGeoSearchState({ on: true, ready: true, answered: true });
    const { RouteMap: Fresh } = await import('./RouteMap');
    const before = document.head.querySelectorAll('script[src*="leaflet"]').length;
    render(<Fresh from={null} to={to} />);
    render(<Fresh from={null} to={{ lat: 1, lng: 2 }} />);
    const scripts = document.head.querySelectorAll('script[src*="leaflet"]');
    expect(scripts.length - before).toBe(1);
    (window as unknown as { L: unknown }).L = fakeLeaflet();
    await act(async () => {
      (scripts[scripts.length - 1] as HTMLScriptElement).onload?.(new Event('load'));
    });
    expect(calls.map).toHaveLength(2);
  });
});

describe('RouteMap · without the geo-search consent (SPO-293)', () => {
  const from = { lat: 50.0, lng: 14.0 };
  const to = { lat: 50.01, lng: 14.01 };

  it('shows the "map off" notice, loads no Leaflet and makes no request', async () => {
    resetGeoGateForTests();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const before = document.head.querySelectorAll('script[src*="leaflet"]').length;
    const { container } = render(<RouteMap from={from} to={to} />);
    await flush();
    expect(container.querySelector('.route-map.ready')).toBeNull();
    expect(container.querySelector('.route-map-fallback')).toBeNull();
    expect(container.textContent).toContain('Maps are off');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.head.querySelectorAll('script[src*="leaflet"]').length).toBe(before);
  });
});
