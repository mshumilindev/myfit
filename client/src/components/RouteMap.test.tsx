import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { RouteMap } from './RouteMap';
import { resetGeoGateForTests, setGeoOverride, setGeoSearchState } from '../data/geoSearchGate';

/** SPO-293: the live map cancels its route request when gym search goes off, and a failed Leaflet load can be retried. */

const fakeLeaflet = () => {
  const layer = { addTo: () => layer, getBounds: () => ({ pad: () => ({}) }) };
  return {
    map: () => ({ setView: () => ({ remove: () => undefined, fitBounds: () => undefined }) }),
    tileLayer: () => layer,
    circleMarker: () => layer,
    polyline: () => layer,
    latLngBounds: () => ({ pad: () => ({}) }),
  };
};

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetGeoGateForTests();
  document.head.querySelectorAll('script,link').forEach((n) => n.remove());
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  delete (window as unknown as { L?: unknown }).L;
  vi.unstubAllGlobals();
});

describe('RouteMap live', () => {
  it('aborts the OSRM request when gym search is withdrawn', async () => {
    (window as unknown as { L: unknown }).L = fakeLeaflet();
    let sig: AbortSignal | undefined;
    fetchSpy.mockImplementation(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_r, rej) => {
          sig = init?.signal ?? undefined;
          sig?.addEventListener('abort', () => rej(new DOMException('x', 'AbortError')));
        }),
    );
    setGeoSearchState({ on: true, ready: true, answered: true });
    render(<RouteMap from={{ lat: 1, lng: 2 }} to={{ lat: 1.001, lng: 2.001 }} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0][0])).toContain('router.project-osrm.org');
    expect(sig?.aborted).toBe(false);
    act(() => setGeoOverride(false));
    expect(sig?.aborted).toBe(true);
  });

  it('does not cache a failed Leaflet load: the next map tries again', async () => {
    setGeoSearchState({ on: true, ready: true, answered: true });
    const a = render(<RouteMap from={null} to={{ lat: 1, lng: 2 }} />);
    const first = document.head.querySelector('script[src*="unpkg"]') as HTMLScriptElement;
    expect(first).not.toBeNull();
    await act(async () => first.onerror?.(new Event('error')));
    expect(document.head.querySelector('script[src*="unpkg"]')).toBeNull();
    a.unmount();
    render(<RouteMap from={null} to={{ lat: 3, lng: 4 }} />);
    expect(document.head.querySelector('script[src*="unpkg"]')).not.toBeNull();
  });
});
