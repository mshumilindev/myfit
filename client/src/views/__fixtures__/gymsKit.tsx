/** Shared scaffolding for the GymsView behaviour tests: a geolocation stub and a store-bound renderer. */
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { useStore } from '../../store';
import { GymsView } from '../GymsView';
import { makeShell } from './viewKit';

export function setGeo(
  fix: { lat: number; lng: number; accuracy: number } | 'denied' | 'none',
): void {
  if (fix === 'none') {
    delete (navigator as unknown as Record<string, unknown>).geolocation;
    return;
  }
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback, bad: PositionErrorCallback) =>
        fix === 'denied'
          ? bad({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError)
          : ok({
              coords: { latitude: fix.lat, longitude: fix.lng, accuracy: fix.accuracy },
            } as GeolocationPosition),
    },
  });
}

function Bound({ shell }: { shell: ReturnType<typeof makeShell> }) {
  return <GymsView shell={shell} store={useStore()} />;
}

export function openGyms() {
  const shell = makeShell();
  const out = render(<Bound shell={shell} />);
  return { ...out, shell };
}

export const sink = { ac: vi.fn() };
