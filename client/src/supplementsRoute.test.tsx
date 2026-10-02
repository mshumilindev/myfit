/**
 * The `#/health/supplements/...` routes: they parse, format and render, and Back from a deep
 * link climbs hub, then Health, then out. The Health row opens the quick start with no entries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { fromHash, overlayBack, toHash, type Overlay, type Shell } from './App';
import { HealthView } from './views/HealthView';
import { setLocale } from './i18n';
import { newSupplementEntry } from './supplements';
import { deleteSupplementData, saveSupplementEntry } from './store';

beforeEach(() => {
  setLocale('en');
  deleteSupplementData();
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

describe('#/health/supplements routes', () => {
  it('parse and format the hub, products and calc routes', () => {
    for (const sup of ['products', 'calc'] as const) {
      const { overlay } = fromHash(`#/health/supplements/${sup}`);
      expect(overlay).toEqual({ screen: 'health', sup });
      expect(hash(overlay)).toBe(`#/health/supplements/${sup}`);
    }
    const hub = fromHash('#/health/supplements').overlay;
    expect(hub).toEqual({ screen: 'health', sup: 'hub' });
    expect(hash(hub)).toBe('#/health/supplements');
    expect(fromHash('#/health/supplements/nonsense').overlay).toEqual({
      screen: 'health',
      sup: 'hub',
    });
  });

  it('each route renders its own screen', () => {
    const titles = { hub: 'Supplements', products: 'What I take', calc: 'Use in calculations' };
    for (const [sup, title] of Object.entries(titles)) {
      render(<HealthView shell={shellMock()} sup={sup as 'hub'} onClose={() => undefined} />);
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
      cleanup();
    }
  });
});

describe('Back from a supplements deep link', () => {
  it('products and calc go to the hub, then Health, then out', () => {
    for (const sup of ['products', 'calc'] as const)
      expect(overlayBack(state({ screen: 'health', sup })).cur).toEqual({
        screen: 'health',
        sup: 'hub',
      });
    const b = overlayBack(state({ screen: 'health', sup: 'hub' }));
    expect(b).toEqual({ cur: { screen: 'health' }, stack: [] });
    expect(overlayBack(b)).toEqual({ cur: null, stack: [] });
  });
});

describe('Health › Lifestyle › Supplements', () => {
  const row = () => screen.getByText('Supplements').closest('button') as HTMLElement;

  it('with no entries the row opens the quick start; Fine-tune opens the catalog', () => {
    const shell = shellMock();
    render(<HealthView shell={shell} onClose={() => undefined} />);
    fireEvent.click(row());
    expect(shell.openOverlay).not.toHaveBeenCalled();
    expect(screen.getByText('What do you take regularly?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Fine-tune and add more/ }));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'health', sup: 'products' });
    expect(screen.queryByText('What do you take regularly?')).toBeNull();
  });

  it('with entries the row opens the hub', () => {
    saveSupplementEntry(newSupplementEntry('creatine', 'sup-creatine'));
    const shell = shellMock();
    render(<HealthView shell={shell} onClose={() => undefined} />);
    expect(screen.getByText('Creatine · 1 item')).toBeTruthy();
    fireEvent.click(row());
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'health', sup: 'hub' });
  });
});
