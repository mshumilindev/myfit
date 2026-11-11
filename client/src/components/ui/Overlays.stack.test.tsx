import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog, Sheet } from './Overlays';
import { openOverlayCount } from './overlays/overlayStack';
import { resetOverlayBackForTest } from './overlays/overlayBack';

/**
 * SPO-466 / SPO-467 — the drawer stack: one overlay on the page at a time, only the top drawer closes (scrim tap,
 * Escape, the closing slide), everything under it is inert, and the page under a drawer takes no click.
 */
const CLOSE_MS = 240;

function scrims(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.scrim'));
}
function sheets(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.sheet'));
}
function settle(): void {
  act(() => {
    vi.advanceTimersByTime(CLOSE_MS + 10);
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('one drawer', () => {
  it('has level 1 and an active scrim; a tap on the scrim closes it (after the slide-out) and nothing else', () => {
    const onClose = vi.fn();
    const underClick = vi.fn();
    render(
      <>
        <button onClick={underClick}>under</button>
        <Sheet onClose={onClose}>
          <p>one</p>
        </Sheet>
      </>,
    );
    const [scrim] = scrims();
    expect(scrim.dataset.level).toBe('1');
    expect(scrim.hasAttribute('data-covered')).toBe(false);
    fireEvent.click(scrim);
    settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(underClick).not.toHaveBeenCalled();
  });

  it('makes the page behind it inert, and gives it back on close', () => {
    const page = document.createElement('main');
    document.body.appendChild(page);
    const { unmount } = render(
      <Sheet onClose={() => undefined}>
        <p>one</p>
      </Sheet>,
    );
    expect(page.hasAttribute('inert')).toBe(true);
    unmount();
    expect(page.hasAttribute('inert')).toBe(false);
    page.remove();
  });

  it('two quick taps on the scrim close it once', () => {
    const onClose = vi.fn();
    render(
      <Sheet onClose={onClose}>
        <p>one</p>
      </Sheet>,
    );
    const [scrim] = scrims();
    fireEvent.click(scrim);
    fireEvent.click(scrim);
    settle();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from outside (closeRequested) with the same slide-out, then calls onClose', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet onClose={onClose}>
        <p>one</p>
      </Sheet>,
    );
    rerender(
      <Sheet onClose={onClose} closeRequested>
        <p>one</p>
      </Sheet>,
    );
    expect(sheets()[0].className).toContain('sheet-closing');
    expect(onClose).not.toHaveBeenCalled();
    settle();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('unregisters on unmount', () => {
    const { unmount } = render(
      <Sheet onClose={() => undefined}>
        <p>one</p>
      </Sheet>,
    );
    expect(openOverlayCount()).toBe(1);
    unmount();
    expect(openOverlayCount()).toBe(0);
  });
});

describe('a stack of drawers', () => {
  function Three(p: { a: () => void; b: () => void; c: () => void; n?: number }) {
    const n = p.n ?? 3;
    return (
      <>
        <Sheet onClose={p.a} label="a">
          <p>a</p>
        </Sheet>
        {n >= 2 && (
          <Sheet onClose={p.b} label="b">
            <p>b</p>
          </Sheet>
        )}
        {n >= 3 && (
          <Sheet onClose={p.c} label="c">
            <p>c</p>
          </Sheet>
        )}
      </>
    );
  }

  it('levels go up in opening order, and only the top scrim is drawn', () => {
    render(<Three a={vi.fn()} b={vi.fn()} c={vi.fn()} />);
    expect(scrims().map((s) => s.dataset.level)).toEqual(['1', '2', '3']);
    expect(sheets().map((s) => s.dataset.level)).toEqual(['1', '2', '3']);
    expect(scrims().map((s) => s.hasAttribute('data-covered'))).toEqual([true, true, false]);
    expect(openOverlayCount()).toBe(3);
  });

  it('the scrim of the top drawer closes only the top one; the next tap closes the next; and so on down', () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const { rerender } = render(<Three a={a} b={b} c={c} />);
    fireEvent.click(scrims()[2]);
    settle();
    expect([a, b, c].map((f) => f.mock.calls.length)).toEqual([0, 0, 1]);
    rerender(<Three a={a} b={b} c={c} n={2} />); // the parent unmounts the closed one
    expect(scrims()).toHaveLength(2);
    expect(scrims()[1].hasAttribute('data-covered')).toBe(false); // the one under it is the top now
    fireEvent.click(scrims()[1]);
    settle();
    expect([a, b, c].map((f) => f.mock.calls.length)).toEqual([0, 1, 1]);
    rerender(<Three a={a} b={b} c={c} n={1} />);
    fireEvent.click(scrims()[0]);
    settle();
    expect([a, b, c].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('Escape closes only the top drawer, one press = one drawer', () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    render(<Three a={a} b={b} c={c} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    settle();
    expect([a, b, c].map((f) => f.mock.calls.length)).toEqual([0, 0, 1]);
  });

  it('the drawers under the top one are inert; closing the top gives the next one back', () => {
    const { rerender } = render(<Three a={vi.fn()} b={vi.fn()} c={vi.fn()} />);
    const layers = sheets().map((s) => s.closest('.portal-layer') as HTMLElement);
    expect(layers.map((l) => l.hasAttribute('inert'))).toEqual([true, true, false]);
    rerender(<Three a={vi.fn()} b={vi.fn()} c={vi.fn()} n={2} />);
    const now = sheets().map((s) => s.closest('.portal-layer') as HTMLElement);
    expect(now.map((l) => l.hasAttribute('inert'))).toEqual([true, false]);
  });

  it('a drawer cannot be reached by a tap that lands on the lower sheet: the top scrim covers it (stacking order)', () => {
    render(<Three a={vi.fn()} b={vi.fn()} c={vi.fn()} />);
    const z = (el: HTMLElement) => el.dataset.level;
    // the scrim of level n is above the sheet of level n-1: its level is higher
    expect(Number(z(scrims()[2]))).toBeGreaterThan(Number(z(sheets()[1])));
  });
});

describe('a dialog over a drawer', () => {
  beforeEach(() => {
    // desktop: a centred dialog (a phone shows the same prompt as a bottom sheet)
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('min-width'),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());
  it('takes over the dimming: the drawer hides its own scrim; Escape is left to the dialog', () => {
    const onSheet = vi.fn();
    const onDialog = vi.fn();
    const { unmount } = render(
      <>
        <Sheet onClose={onSheet}>
          <p>sheet</p>
        </Sheet>
        <Dialog title="Sure?" actions={<button>ok</button>} onClose={onDialog}>
          body
        </Dialog>
      </>,
    );
    expect(scrims()[0].hasAttribute('data-covered')).toBe(true);
    expect(document.querySelector('.dialog-scrim')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    settle();
    expect(onSheet).not.toHaveBeenCalled();
    unmount();
  });

  it('gives the dimming back to the drawer when the dialog goes', () => {
    const { rerender } = render(
      <>
        <Sheet onClose={() => undefined}>
          <p>sheet</p>
        </Sheet>
        <Dialog title="Sure?" actions={<button>ok</button>} onClose={() => undefined}>
          body
        </Dialog>
      </>,
    );
    rerender(
      <Sheet onClose={() => undefined}>
        <p>sheet</p>
      </Sheet>,
    );
    expect(scrims()[0].hasAttribute('data-covered')).toBe(false);
    expect(screen.queryByText('Sure?')).toBeNull();
  });
});

describe('the Back button', () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetOverlayBackForTest();
  });

  async function back(): Promise<void> {
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 330));
    });
  }

  it('closes the top drawer only; the next press closes the next', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = render(
      <>
        <Sheet onClose={a}>
          <p>a</p>
        </Sheet>
        <Sheet onClose={b}>
          <p>b</p>
        </Sheet>
      </>,
    );
    await back();
    expect([a, b].map((f) => f.mock.calls.length)).toEqual([0, 1]);
    rerender(
      <Sheet onClose={a}>
        <p>a</p>
      </Sheet>,
    );
    await back();
    expect([a, b].map((f) => f.mock.calls.length)).toEqual([1, 1]);
  });

  it('a drawer closed another way gives its history entry back, and that does not close the one under it', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = render(
      <>
        <Sheet onClose={a}>
          <p>a</p>
        </Sheet>
        <Sheet onClose={b}>
          <p>b</p>
        </Sheet>
      </>,
    );
    rerender(
      <Sheet onClose={a}>
        <p>a</p>
      </Sheet>,
    ); // the parent unmounts b after its own slide-out (scrim, ×, swipe, Escape)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(a).not.toHaveBeenCalled();
    expect((window.history.state as { spotterOverlay?: number } | null)?.spotterOverlay).toBeTypeOf(
      'number',
    ); // a's entry is on top again
  });

  it('a drawer that closes because the app navigates does not pull the page back afterwards (Start -> session)', async () => {
    window.history.replaceState(null, '', '#/today');
    const { rerender } = render(
      <Sheet onClose={vi.fn()}>
        <p>a</p>
      </Sheet>,
    );
    rerender(<p>gone</p>); // the drawer unmounts ...
    window.history.replaceState(window.history.state, '', '#/session'); // ... and the app moves on in the same tick
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(window.location.hash).toBe('#/session');
  });
});
