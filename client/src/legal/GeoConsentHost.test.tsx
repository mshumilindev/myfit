import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  state: { records: [], loading: false, confirmed: true, error: null } as {
    records: unknown[];
    loading: boolean;
    confirmed: boolean;
    error: Error | null;
  },
  grant: vi.fn(),
  getPos: vi.fn(),
}));
vi.mock('../api', () => ({
  currentUid: () => 'u1',
  onAuthChange: () => () => undefined,
  registerSignOutFlush: () => undefined, // signupConsents registers its queues with api.ts at import
}));
vi.mock('./consentApi', async () => {
  const real = await vi.importActual<typeof import('./consentApi')>('./consentApi');
  return { ...real, useConsentRecords: () => h.state, grantConsent: h.grant };
});
vi.mock('../store', () => ({
  getCurrentPositionOnce: h.getPos,
  upsertGym: vi.fn(),
  useStore: () => ({ workouts: [], gyms: [] }),
}));

import { GeoConsentHost } from './GeoConsentHost';
import { useAskGeoConsent } from './useGeoSearch';
import { GymPicker } from '../components/GymPicker';
import { GymThumb } from '../components/GymThumb';
import { RouteMap } from '../components/RouteMap';
import {
  GEO_ENGINES,
  isGeoSearchOn,
  openGeoPrompt,
  resetGeoGateForTests,
} from '../data/geoSearchGate';
import { LEGAL_VERSIONS, type ConsentRecord } from './consents';
import { markLocalOff, localOffKinds } from './localOff';
import type { Gym } from '../types';

const geoRec = (action: 'grant' | 'withdraw', at = 1, version = LEGAL_VERSIONS['geo-search']) =>
  ({ id: `${action}${at}`, kind: 'geo-search', action, version, at }) as ConsentRecord;
const setRecords = (records: ConsentRecord[]) =>
  (h.state = { records, loading: false, confirmed: true, error: null });

const PICK = 'Which gym?';
const TITLE = 'Search gyms with outside services?';
const prompt = () => screen.queryByRole('alertdialog', { name: TITLE });
const gym = { id: 'g1', name: 'Home Gym', lat: 50.45, lng: 30.52, radiusM: 100 } as Gym;

let fetchSpy: ReturnType<typeof vi.fn>;
let geoSpy: ReturnType<typeof vi.fn>;

function Surface() {
  useAskGeoConsent();
  return <div>search surface</div>;
}

beforeEach(() => {
  localStorage.clear();
  resetGeoGateForTests();
  setRecords([]);
  h.grant.mockReset();
  h.grant.mockResolvedValue({ id: 'x', at: 1 });
  h.getPos.mockReset();
  h.getPos.mockResolvedValue({ lat: 50.45, lng: 30.52, accuracy: 10 });
  fetchSpy = vi.fn(async () => new Response('{}'));
  geoSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition: geoSpy },
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('a withdrawal not yet recorded survives a reload', () => {
  it('cached records still say on, but the persisted local-off keeps gym search off', async () => {
    markLocalOff('u1', 'geo-search');
    setRecords([geoRec('grant')]);
    render(<GeoConsentHost />);
    await waitFor(() => expect(h.state.records.length).toBe(1));
    expect(isGeoSearchOn()).toBe(false);
  });
  it('without the flag the same records turn it on', async () => {
    setRecords([geoRec('grant')]);
    render(<GeoConsentHost />);
    await waitFor(() => expect(isGeoSearchOn()).toBe(true));
  });
  it('a newer grant accepted in the prompt clears the flag and turns it on', async () => {
    markLocalOff('u1', 'geo-search');
    render(<GeoConsentHost />);
    act(() => openGeoPrompt());
    fireEvent.click(await screen.findByRole('button', { name: 'Search with these services' }));
    await waitFor(() => expect(h.grant).toHaveBeenCalled());
    await waitFor(() => expect(localOffKinds('u1')).toEqual([]));
    expect(isGeoSearchOn()).toBe(true);
  });
});

describe('the consent prompt', () => {
  it('is shown the first time a search surface appears, before anything is sent', async () => {
    render(
      <>
        <GeoConsentHost />
        <Surface />
      </>,
    );
    await waitFor(() => expect(prompt()).not.toBeNull());
    expect(screen.getByText('Who receives it')).toBeTruthy();
    expect(screen.getByText(/Photon, Overpass, Nominatim, OSRM/)).toBeTruthy();
    expect(screen.getByText(/Google Places is asked through our server/)).toBeTruthy();
    expect(screen.queryByText(/Foursquare/)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(geoSpy).not.toHaveBeenCalled();
  });

  it('offers accept and "Not now" only (no add-by-hand)', async () => {
    render(
      <>
        <GeoConsentHost />
        <Surface />
      </>,
    );
    await waitFor(() => expect(prompt()).not.toBeNull());
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toContain('Search with these services');
    expect(buttons).toContain('Not now');
    expect(buttons.join('|')).not.toMatch(/by hand/i);
  });

  it('accept records a geo-search grant with the real engines and closes', async () => {
    render(
      <>
        <GeoConsentHost />
        <Surface />
      </>,
    );
    await waitFor(() => expect(prompt()).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Search with these services' }));
    await waitFor(() => expect(prompt()).toBeNull());
    expect(h.grant).toHaveBeenCalledTimes(1);
    expect(h.grant).toHaveBeenCalledWith({ kind: 'geo-search', engines: [...GEO_ENGINES] });
  });

  it('keeps the prompt and says so when saving fails', async () => {
    h.grant.mockRejectedValue(new Error('offline'));
    render(
      <>
        <GeoConsentHost />
        <Surface />
      </>,
    );
    await waitFor(() => expect(prompt()).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Search with these services' }));
    await screen.findByText('Could not save your choice. Please try again.');
    expect(prompt()).not.toBeNull();
  });

  it('"Not now" records nothing, closes, sends nothing and does not come back by itself', async () => {
    const { rerender } = render(
      <>
        <GeoConsentHost />
        <Surface />
      </>,
    );
    await waitFor(() => expect(prompt()).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(prompt()).toBeNull());
    expect(h.grant).not.toHaveBeenCalled();
    rerender(
      <>
        <GeoConsentHost />
        <Surface />
        <Surface />
      </>,
    );
    expect(prompt()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(geoSpy).not.toHaveBeenCalled();
  });

  it('does not open by itself after a withdrawal, or when already on', async () => {
    setRecords([geoRec('grant', 1), geoRec('withdraw', 2)]);
    const first = render(
      <>
        <GeoConsentHost />
        <Surface />
      </>,
    );
    await act(async () => undefined);
    expect(prompt()).toBeNull();
    first.unmount();
    resetGeoGateForTests();
    setRecords([geoRec('grant')]);
    render(
      <>
        <GeoConsentHost />
        <Surface />
      </>,
    );
    await act(async () => undefined);
    expect(prompt()).toBeNull();
  });

  it('is not shown while the records are still unknown', async () => {
    h.state = { records: [], loading: true, confirmed: false, error: null };
    render(
      <>
        <GeoConsentHost />
        <Surface />
      </>,
    );
    await act(async () => undefined);
    expect(prompt()).toBeNull();
  });
});

describe('gym picker without consent', () => {
  it('still shows the saved gyms, asks nothing of the location API and the network, and Turn on opens the prompt', async () => {
    render(
      <>
        <GeoConsentHost />
        <GymPicker gyms={[gym]} title={PICK} onPick={() => undefined} onClose={() => undefined} />
      </>,
    );
    await act(async () => undefined);
    expect(screen.getByText('Home Gym')).toBeTruthy();
    expect(screen.getByText('Gym search is off')).toBeTruthy();
    expect(h.getPos).not.toHaveBeenCalled();
    expect(geoSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelectorAll('img[src^="http"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(prompt()).not.toBeNull());
  });

  it('reads the position only once the consent is on, and withdrawing switches it off again', async () => {
    setRecords([geoRec('grant')]);
    const { rerender } = render(
      <>
        <GeoConsentHost />
        <GymPicker gyms={[gym]} title={PICK} onPick={() => undefined} onClose={() => undefined} />
      </>,
    );
    await waitFor(() => expect(h.getPos).toHaveBeenCalled());
    expect(screen.queryByText('Gym search is off')).toBeNull();
    setRecords([geoRec('grant', 1), geoRec('withdraw', 2)]);
    rerender(
      <>
        <GeoConsentHost />
        <GymPicker gyms={[gym]} title={PICK} onPick={() => undefined} onClose={() => undefined} />
      </>,
    );
    await screen.findByText('Gym search is off');
    expect(screen.getByText('Home Gym')).toBeTruthy();
  });
});

describe('thumbnails and maps', () => {
  it('a gym thumbnail without consent is the local graphic: no tile, no photo lookup', async () => {
    const { container } = render(<GymThumb name="Home Gym" lat={50.45} lng={30.52} />);
    await act(async () => undefined);
    expect(container.querySelector('img')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('with consent but no photo the thumbnail is still the local graphic: never an OpenStreetMap tile (SPO-340)', async () => {
    setRecords([geoRec('grant')]);
    const { container } = render(
      <>
        <GeoConsentHost />
        <GymThumb name="Tile Gym" lat={10.1} lng={20.2} />
      </>,
    );
    await act(async () => undefined);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.house-graphic')).not.toBeNull();
    expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes('tile.openstreetmap.org'))).toBe(
      false,
    );
  });

  it('a route map without consent loads no Leaflet, no tiles and no route', async () => {
    const { container } = render(
      <RouteMap from={{ lat: 1, lng: 2 }} to={{ lat: 1.001, lng: 2.001 }} />,
    );
    await act(async () => undefined);
    expect(screen.getByText('Maps are off. Turn on gym search to see the map.')).toBeTruthy();
    expect(document.head.querySelector('script[src*="unpkg"]')).toBeNull();
    expect(document.head.querySelector('link[href*="unpkg"]')).toBeNull();
    expect(container.querySelector('.route-map-live')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a stored track still draws offline without consent', () => {
    const { container } = render(
      <RouteMap
        track={[
          [1, 2],
          [1.1, 2.1],
        ]}
        label="trace"
      />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText(/Maps are off/)).toBeNull();
  });
});

describe('prompt opened from "Turn on"', () => {
  it('openGeoPrompt shows the prompt without any surface', async () => {
    render(<GeoConsentHost />);
    act(() => openGeoPrompt());
    expect(prompt()).not.toBeNull();
  });
});
