/**
 * The summary's "Open Use in calculations" link: the button calls its handler, the
 * `#/health/nicotine/calc` route parses, formats and renders the calculation screen, and
 * Back from a deep link climbs hub, then Health, then out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { fromHash, overlayBack, toHash, type Overlay, type Shell } from './App';
import { HealthView } from './views/HealthView';
import { NicotineHowSheet } from './views/sessionSummary/NicotineCard';
import { nicotineCardModel } from './views/sessionSummary/nicotineBaselines';
import { defaultNicotineSettings, newNicotineProduct } from './nicotine';
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

describe('#/health/nicotine routes', () => {
  it('parse and format the calc, products and hub routes', () => {
    for (const nic of ['calc', 'products'] as const) {
      const { overlay } = fromHash(`#/health/nicotine/${nic}`);
      expect(overlay).toEqual({ screen: 'health', nic });
      expect(
        toHash(
          'today',
          overlay,
          'mine' as never,
          false,
          'progress',
          'total' as never,
          'volume' as never,
        ),
      ).toBe(`#/health/nicotine/${nic}`);
    }
    expect(fromHash('#/health/nicotine').overlay).toEqual({ screen: 'health', nic: 'hub' });
  });

  it('#/health/privacy parses and formats; the old #/health/nicotine/privacy redirects to it', () => {
    const { overlay } = fromHash('#/health/privacy');
    expect(overlay).toEqual({ screen: 'health', priv: true });
    expect(
      toHash(
        'today',
        overlay,
        'mine' as never,
        false,
        'progress',
        'total' as never,
        'volume' as never,
      ),
    ).toBe('#/health/privacy');
    expect(fromHash('#/health/nicotine/privacy').overlay).toEqual({ screen: 'health', priv: true });
  });

  it('the calc route renders the "Use in calculations" screen', () => {
    render(<HealthView shell={shellMock()} nic="calc" onClose={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Use in calculations' })).toBeTruthy();
  });
});

describe('Back from a deep link', () => {
  it('products: hub, then Health, then out', () => {
    const a = overlayBack(state({ screen: 'health', nic: 'products' }));
    expect(a).toEqual({ cur: { screen: 'health', nic: 'hub' }, stack: [] });
    const b = overlayBack(a);
    expect(b).toEqual({ cur: { screen: 'health' }, stack: [] });
    expect(overlayBack(b)).toEqual({ cur: null, stack: [] });
  });
  it('calc goes to the hub too; the privacy page goes to the Health overview', () => {
    expect(overlayBack(state({ screen: 'health', nic: 'calc' })).cur).toEqual({
      screen: 'health',
      nic: 'hub',
    });
    expect(overlayBack(state({ screen: 'health', priv: true }))).toEqual({
      cur: { screen: 'health' },
      stack: [],
    });
  });
  it('opened from the session summary, Back returns to that summary', () => {
    const session: Overlay = { screen: 'session', workoutId: 'w' };
    const n = { cur: { screen: 'health', nic: 'calc' } as Overlay, stack: [session] };
    expect(overlayBack(n)).toEqual({ cur: session, stack: [] });
  });
});

describe('How is this estimated? › Open Use in calculations', () => {
  const nic = {
    products: [{ ...newNicotineProduct('cigarettes', 'c'), amount: 20 }],
    settings: defaultNicotineSettings(),
  };
  const model = nicotineCardModel(nic, {
    recoveryGapHours: 72,
    avgSleepMin: 420,
  })!;

  it('calls onOpenSettings once', () => {
    const open = vi.fn();
    render(
      <NicotineHowSheet
        model={model}
        products={nic.products}
        onClose={() => undefined}
        onOpenSettings={open}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open “Use in calculations”' }));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
