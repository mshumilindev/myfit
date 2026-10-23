import { act, cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kitCss, stylesCss, glassCss } from './readCss';
import {
  msToNextMinute,
  NowDivider,
  NowLine,
  NowStatus,
  nowOffset,
  useMinuteClock,
  useScrollToNow,
} from './NowLine';

const at = (h: number, m: number, s = 0) => Date.UTC(2026, 9, 7, h, m, s);

let hidden = false;
const setHidden = (v: boolean) => {
  hidden = v;
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  vi.useFakeTimers();
  vi.setSystemTime(at(9, 5, 30));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('nowOffset / msToNextMinute', () => {
  it('is the fraction of the visible range, null outside it', () => {
    expect(nowOffset(9 * 60 + 5, 7 * 60, 21 * 60)).toBeCloseTo(125 / 840, 6);
    expect(nowOffset(7 * 60, 7 * 60, 21 * 60)).toBe(0);
    expect(nowOffset(21 * 60, 7 * 60, 21 * 60)).toBe(1);
    expect(nowOffset(6 * 60 + 59, 7 * 60, 21 * 60)).toBeNull();
    expect(nowOffset(21 * 60 + 1, 7 * 60, 21 * 60)).toBeNull();
    expect(nowOffset(100, 200, 200)).toBeNull();
  });
  it('waits for the next minute boundary of the clock', () => {
    expect(msToNextMinute(at(9, 5, 30))).toBe(30_000);
    expect(msToNextMinute(at(9, 6, 0))).toBe(60_000);
    expect(msToNextMinute(at(9, 5, 59) + 999)).toBe(1);
  });
});

describe('NowLine', () => {
  it('sits at the minute inside the range, hidden from assistive tech and pointer events', () => {
    const { container } = render(<NowLine minutes={9 * 60 + 5} from={7 * 60} to={21 * 60} />);
    const el = container.querySelector<HTMLElement>('.uinow');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(parseFloat(el?.style.top ?? '')).toBeCloseTo((125 / 840) * 100, 4);
    expect(container.querySelector('.uinow-chip')).toBeNull();
  });
  it('draws the time chip in the day view', () => {
    const { container } = render(<NowLine minutes={600} from={420} to={1260} label="10:00" />);
    expect(container.querySelector('.uinow-chip')?.textContent).toBe('10:00');
  });
  it('draws nothing outside the visible hour range', () => {
    const { container } = render(<NowLine minutes={5 * 60} from={7 * 60} to={21 * 60} />);
    expect(container.firstChild).toBeNull();
  });
});

function Clock({ get }: { get: () => number }) {
  const now = useMinuteClock(get);
  return <output>{new Date(now).toISOString().slice(11, 19)}</output>;
}

describe('useMinuteClock', () => {
  it('ticks on the minute boundary of the clock, not every second', () => {
    render(<Clock get={() => Date.now()} />);
    expect(screen.getByRole('status').textContent).toBe('09:05:30');
    act(() => void vi.advanceTimersByTime(29_000));
    expect(screen.getByRole('status').textContent).toBe('09:05:30');
    act(() => void vi.advanceTimersByTime(1_000));
    expect(screen.getByRole('status').textContent).toBe('09:06:00');
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('status').textContent).toBe('09:07:00');
  });
  it('follows an injected fixture clock, not the real one', () => {
    let fixture = at(14, 59, 50);
    render(<Clock get={() => fixture} />);
    expect(screen.getByRole('status').textContent).toBe('14:59:50');
    fixture = at(15, 0, 0);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.getByRole('status').textContent).toBe('15:00:00');
  });
  it('pauses while the tab is hidden and re-syncs when it is visible again', () => {
    render(<Clock get={() => Date.now()} />);
    act(() => setHidden(true));
    expect(vi.getTimerCount()).toBe(0);
    act(() => void vi.advanceTimersByTime(5 * 60_000));
    expect(screen.getByRole('status').textContent).toBe('09:05:30');
    act(() => setHidden(false));
    expect(screen.getByRole('status').textContent).toBe('09:10:30');
    expect(vi.getTimerCount()).toBe(1);
    act(() => void vi.advanceTimersByTime(30_000));
    expect(screen.getByRole('status').textContent).toBe('09:11:00');
  });
  it('cleans up its timer and listener on unmount', () => {
    const { unmount } = render(<Clock get={() => Date.now()} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => setHidden(false)); // no listener left to throw
  });
});

describe('NowStatus (no per-minute announcements)', () => {
  it('says "Now, HH:MM" on mount, stays quiet while the minutes pass, speaks again when the hour changes', () => {
    const { rerender } = render(<NowStatus text="Now, 09:05" hour={9} />);
    const live = () => document.querySelector('[data-now-status]')?.textContent;
    expect(live()).toBe('Now, 09:05');
    rerender(<NowStatus text="Now, 09:06" hour={9} />);
    rerender(<NowStatus text="Now, 09:59" hour={9} />);
    expect(live()).toBe('Now, 09:05');
    rerender(<NowStatus text="Now, 10:00" hour={10} />);
    expect(live()).toBe('Now, 10:00');
    expect(document.querySelector('[data-now-status]')?.getAttribute('role')).toBe('status');
  });
});

describe('NowDivider', () => {
  it('is a labelled separator between past and upcoming rows', () => {
    render(<NowDivider label="Now" time="09:05" />);
    expect(screen.getByRole('separator', { name: 'Now, 09:05' })).toBeTruthy();
  });
});

function Scroller({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollToNow(ref, active);
  return (
    <div data-testid="box" style={{ overflowY: 'auto' }}>
      <div ref={ref}>
        <div data-now-line="" />
      </div>
    </div>
  );
}

describe('useScrollToNow', () => {
  const layout = (scrollTop: number) => {
    const box = screen.getByTestId('box');
    const line = box.querySelector('[data-now-line]') as HTMLElement;
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 600 });
    box.scrollTop = scrollTop;
    box.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    line.getBoundingClientRect = () => ({ top: 100 + 900 - scrollTop }) as DOMRect;
    const scrollTo = vi.fn();
    box.scrollTo = scrollTo as never;
    return scrollTo;
  };
  it('puts now about a third from the top when the view has not been scrolled', () => {
    const { rerender } = render(<Scroller active={false} />);
    const scrollTo = layout(0);
    rerender(<Scroller active />);
    expect(scrollTo).toHaveBeenCalledWith({ top: 900 - 200, behavior: 'auto' });
  });
  it('leaves a view the user has already scrolled alone', () => {
    const { rerender } = render(<Scroller active={false} />);
    const scrollTo = layout(240);
    rerender(<Scroller active />);
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('does nothing while today is not visible', () => {
    const { rerender } = render(<Scroller active={false} />);
    const scrollTo = layout(0);
    rerender(<Scroller active={false} />);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe('NowLine colour (token, contrast)', () => {
  const css = stylesCss();
  const tokens = new Map<string, string>();
  for (const m of css
    .slice(0, css.indexOf('\n}\n', css.indexOf(':root {')))
    .matchAll(/(--[\w-]+):\s*([^;]+);/g))
    tokens.set(m[1], m[2].trim());
  const val = (n: string): string => {
    const v = tokens.get(n) ?? '';
    const ref = v.match(/^var\((--[\w-]+)\)$/);
    return ref ? val(ref[1]) : v;
  };
  type RGB = [number, number, number];
  const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a: RGB, b: RGB) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const over = (top: RGB, a: number, base: RGB): RGB =>
    top.map((v, i) => Math.round(v * a + base[i] * (1 - a))) as RGB;
  const bg = rgb(val('--color-bg'));
  // the Coach ambient glow peak (glass.css --lava-2 rgba(6,67,78,.7)) over the page: the lightest ground the grid sits on
  const glow = over([6, 67, 78], 0.7, bg);
  const grounds: [string, RGB][] = [
    ['page', bg],
    ['surface', rgb(val('--color-surface'))],
    ['surface-2', rgb(val('--color-surface-2'))],
    ['coach glow peak', glow],
  ];

  it.each(grounds)('the line / dot is >= 3:1 on %s', (_n, ground) => {
    expect(ratio(rgb(val('--color-now')), ground)).toBeGreaterThanOrEqual(3);
  });
  it('the chip text (white on --color-now-solid) is >= 4.5:1', () => {
    expect(
      ratio(rgb(val('--color-on-solid')), rgb(val('--color-now-solid'))),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['--color-text', '--color-ok-text', '--color-danger-text'])(
    'dimmed past sessions keep %s >= 4.5:1 on the coach glow (block text is primary / tone text)',
    (name) => {
      const a = Number(val('--op-past'));
      expect(a).toBeGreaterThan(0.5);
      expect(a).toBeLessThan(1);
      expect(ratio(over(rgb(val(name)), a, glow), glow)).toBeGreaterThanOrEqual(4.5);
    },
  );
  describe('accent text on dimmed past sessions (Coach re-points the accent ramp)', () => {
    const coach = (() => {
      const i = css.indexOf('.app-coach,');
      return css.slice(i, css.indexOf('\n}\n', i));
    })();
    const cv = (n: string): RGB =>
      rgb(coach.match(new RegExp(`${n}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] ?? '#000000');
    it.each([
      ['Coach glow peak', glow],
      ['accent tint (tinted block ground)', () => cv('--color-accent-tint')],
      ['page', bg],
    ] as [string, RGB | (() => RGB)][])(
      'Coach --color-accent-text at --op-past stays >= 4.5:1 on the %s',
      (_n, g) => {
        const ground = typeof g === 'function' ? g() : g;
        const a = Number(val('--op-past'));
        expect(ratio(over(cv('--color-accent-text'), a, ground), ground)).toBeGreaterThanOrEqual(
          4.5,
        );
      },
    );
    it('also over an accent-washed glass block (accent 18% over the glow)', () => {
      const ground = over(cv('--color-accent'), 0.18, glow);
      const a = Number(val('--op-past'));
      expect(ratio(over(cv('--color-accent-text'), a, ground), ground)).toBeGreaterThanOrEqual(4.5);
    });
    it('and the brass default accent text does too (Gym grid reuse)', () => {
      const a = Number(val('--op-past'));
      const t = rgb(val('--color-accent-text'));
      expect(ratio(over(t, a, glow), glow)).toBeGreaterThanOrEqual(4.5);
    });
  });
  it('is above session blocks (z-20), below popovers and sheets, and ignores the pointer', () => {
    const k = kitCss('NowLine');
    expect(k).toMatch(/pointer-events:\s*none/);
    expect(k).toMatch(/z-index:\s*var\(--z-20\)/);
    expect(Number(val('--z-20'))).toBeLessThan(Number(val('--z-40')));
    expect(Number(val('--z-60'))).toBeGreaterThan(Number(val('--z-20')));
  });
});

describe('NowLine and reduced motion', () => {
  it('has no animation or transition of its own, so there is nothing to switch off for prefers-reduced-motion', () => {
    expect(kitCss('NowLine')).not.toMatch(/animation|transition|@keyframes/);
    const glass = glassCss();
    const rules = glass.match(/[^{}]*\.uinow[^{}]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r).not.toMatch(/animation|transition/);
  });
  it('the scroll to "now" is an instant jump (behavior auto), never smooth', () => {
    const src = readFileSync(join(__dirname, 'NowLine.tsx'), 'utf8');
    expect(src).not.toMatch(/behavior:\s*'smooth'/);
  });
});
