import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has no AnimationEvent, so React would listen for a vendor-prefixed name; declare it
// before react-dom loads so `animationend` is wired like in a real browser.
vi.hoisted(() => {
  (globalThis as { AnimationEvent?: unknown }).AnimationEvent ??= class extends Event {};
});

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { NudgeStack, type Nudge } from './NudgeStack';

let observers: Array<{
  cb: (e: Array<{ isIntersecting: boolean }>) => void;
  disconnect: () => void;
}> = [];

beforeEach(() => {
  setLocale('en');
  observers = [];
  vi.useFakeTimers();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      cb: (e: Array<{ isIntersecting: boolean }>) => void;
      disconnect = vi.fn();
      constructor(cb: (e: Array<{ isIntersecting: boolean }>) => void) {
        this.cb = cb;
        observers.push(this);
      }
      observe() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const nudge = (id: string, priority: number, over: Partial<Nudge> = {}): Nudge => ({
  id,
  tone: 'plan',
  priority,
  icon: 'barbell',
  kicker: `K-${id}`,
  title: `Title ${id}`,
  body: `Body ${id}`,
  ...over,
});

describe('NudgeStack', () => {
  it('renders nothing without nudges', () => {
    const { container } = render(<NudgeStack nudges={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('puts the most urgent nudge on top and labels the deck with its title', () => {
    render(<NudgeStack nudges={[nudge('low', 1), nudge('high', 9), nudge('mid', 5)]} />);
    expect(screen.getByRole('button', { name: 'Title high' })).toBeTruthy();
    expect(document.querySelector('.nudge-mini .nudge-kicker')!.textContent).toBe('K-high');
  });

  it('draws at most three cards in the deck and one rail segment per nudge', () => {
    render(<NudgeStack nudges={[1, 2, 3, 4, 5].map((n) => nudge(`n${n}`, n))} />);
    expect(document.querySelectorAll('.nudge-deck > .nudge-mini')).toHaveLength(3);
    expect(document.querySelectorAll('.nudge-seg')).toHaveLength(5);
    expect(document.querySelectorAll('.nudge-seg.on')).toHaveLength(1);
  });

  it('has no rail for a single nudge', () => {
    render(<NudgeStack nudges={[nudge('a', 1)]} />);
    expect(document.querySelector('.nudge-rail')).toBeNull();
  });

  it('falls back to the kicker for the aria-label when the title is not a string', () => {
    render(<NudgeStack nudges={[nudge('a', 1, { title: <b>Rich</b> })]} />);
    expect(screen.getByRole('button', { name: 'K-a' })).toBeTruthy();
  });

  it('opens the overlay with every card in priority order, and locks screen scrolling', () => {
    const screenEl = document.createElement('div');
    screenEl.className = 'screen';
    screenEl.style.overflow = 'auto';
    document.body.appendChild(screenEl);
    render(<NudgeStack nudges={[nudge('b', 2), nudge('a', 8)]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Title a' }));
    const dlg = screen.getByRole('dialog');
    expect([...dlg.querySelectorAll('.nudge-card-title')].map((e) => e.textContent)).toEqual([
      'Title a',
      'Title b',
    ]);
    expect(screenEl.style.overflow).toBe('hidden');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Close' }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screenEl.style.overflow).toBe('auto');
    screenEl.remove();
  });

  it('opens from the keyboard with Enter and Space but not other keys', () => {
    render(<NudgeStack nudges={[nudge('a', 1)]} />);
    const deck = screen.getByRole('button', { name: 'Title a' });
    fireEvent.keyDown(deck, { key: 'a' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(deck, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    cleanup();
    render(<NudgeStack nudges={[nudge('a', 1)]} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Title a' }), { key: ' ' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes via the scrim, with the closing class during the exit animation', () => {
    render(<NudgeStack nudges={[nudge('a', 1)]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Title a' }));
    fireEvent.click(document.querySelector('.nudge-scrim')!);
    expect(document.querySelector('.nudge-overlay.closing')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(document.querySelector('.nudge-overlay')).toBeNull();
  });

  it('renders the body and action slots, passing close() to actions; omits an empty body', () => {
    render(
      <NudgeStack
        nudges={[
          nudge('a', 2, {
            actions: (close) => <button onClick={close}>Do it</button>,
          }),
          nudge('b', 1, { body: null }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Title a' }));
    expect(screen.getByText('Body a')).toBeTruthy();
    expect(document.querySelectorAll('.nudge-card-body')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }));
    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('advances the deck when the progress fill finishes, flying the old front card', () => {
    render(<NudgeStack nudges={[nudge('a', 9), nudge('b', 5), nudge('c', 1)]} />);
    const fill = document.querySelector('.nudge-seg-fill') as HTMLElement;
    expect(fill.style.animationDuration).toBe('15000ms');
    expect(fill.style.animationPlayState).toBe('running');
    fireEvent.animationEnd(fill);
    expect(screen.getByRole('button', { name: 'Title b' })).toBeTruthy();
    const flyer = document.querySelector('.nudge-mini.fly')!;
    expect(flyer.textContent).toContain('K-a');
    // the segment fill moved to the new front card
    expect(document.querySelector('.nudge-seg.on')).toBe(
      document.querySelectorAll('.nudge-seg')[1],
    );
    fireEvent.animationEnd(flyer);
    expect(document.querySelector('.nudge-mini.fly')).toBeNull();
  });

  it('wraps around after the last card', () => {
    render(<NudgeStack nudges={[nudge('a', 2), nudge('b', 1)]} />);
    fireEvent.animationEnd(document.querySelector('.nudge-seg-fill')!);
    fireEvent.animationEnd(document.querySelector('.nudge-seg-fill')!);
    expect(screen.getByRole('button', { name: 'Title a' })).toBeTruthy();
  });

  it('pauses the progress fill while the overlay is open or the deck is off screen', () => {
    render(<NudgeStack nudges={[nudge('a', 2), nudge('b', 1)]} />);
    act(() => observers[0].cb([{ isIntersecting: false }]));
    expect(
      (document.querySelector('.nudge-seg-fill') as HTMLElement).style.animationPlayState,
    ).toBe('paused');
    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(
      (document.querySelector('.nudge-seg-fill') as HTMLElement).style.animationPlayState,
    ).toBe('running');
    fireEvent.click(screen.getByRole('button', { name: 'Title a' }));
    expect(
      (document.querySelector('.nudge-seg-fill') as HTMLElement).style.animationPlayState,
    ).toBe('paused');
  });

  it('works without IntersectionObserver and disconnects on unmount', () => {
    const { unmount } = render(<NudgeStack nudges={[nudge('a', 1)]} />);
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalled();
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(() => render(<NudgeStack nudges={[nudge('a', 1)]} />)).not.toThrow();
  });
});
