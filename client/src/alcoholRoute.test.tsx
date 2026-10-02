/**
 * The `#/health/alcohol/...` routes: they parse, format and render, and Back from a deep link
 * climbs hub, then Health, then out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { fromHash, overlayBack, toHash, type Overlay, type Shell } from './App';
import { HealthView } from './views/HealthView';
import { setLocale } from './i18n';

beforeEach(() => {
  setLocale('en');
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const shellMock = (): Shell =>
  ({ openOverlay: vi.fn(), replaceOverlay: vi.fn(), goTab: vi.fn(), snack: vi.fn() }) as never;
const state = (o: Overlay) => ({ cur: o, stack: [] as Overlay[] });
const hash = (o: Overlay) =>
  toHash('today', o, 'mine' as never, false, 'progress', 'total' as never, 'volume' as never);

describe('#/health/alcohol routes', () => {
  it('parse and format the hub, products, days and calc routes', () => {
    for (const alc of ['products', 'days', 'calc'] as const) {
      const { overlay } = fromHash(`#/health/alcohol/${alc}`);
      expect(overlay).toEqual({ screen: 'health', alc });
      expect(hash(overlay)).toBe(`#/health/alcohol/${alc}`);
    }
    const hub = fromHash('#/health/alcohol').overlay;
    expect(hub).toEqual({ screen: 'health', alc: 'hub' });
    expect(hash(hub)).toBe('#/health/alcohol');
    expect(fromHash('#/health/alcohol/nonsense').overlay).toEqual({ screen: 'health', alc: 'hub' });
  });

  it('each route renders its own screen', () => {
    const titles = {
      hub: 'Alcohol',
      products: 'What I drink',
      days: 'Usual days',
      calc: 'Use in calculations',
    };
    for (const [alc, title] of Object.entries(titles)) {
      render(<HealthView shell={shellMock()} alc={alc as 'hub'} onClose={() => undefined} />);
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
      cleanup();
    }
  });
});

describe('Back from an alcohol deep link', () => {
  it('products: hub, then Health, then out', () => {
    const a = overlayBack(state({ screen: 'health', alc: 'products' }));
    expect(a).toEqual({ cur: { screen: 'health', alc: 'hub' }, stack: [] });
    const b = overlayBack(a);
    expect(b).toEqual({ cur: { screen: 'health' }, stack: [] });
    expect(overlayBack(b)).toEqual({ cur: null, stack: [] });
  });
  it('days and calc go to the hub too', () => {
    for (const alc of ['days', 'calc'] as const)
      expect(overlayBack(state({ screen: 'health', alc })).cur).toEqual({
        screen: 'health',
        alc: 'hub',
      });
  });
});
