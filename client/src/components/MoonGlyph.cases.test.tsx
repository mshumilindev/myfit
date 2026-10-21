import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MoonGlyph } from './MoonGlyph';

type Call = { fn: string; args: unknown[] };
let calls: Call[] = [];
let ctxAvailable = true;

function makeCtx() {
  const grad = { addColorStop: vi.fn() };
  return new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        calls.push({ fn: prop, args });
        return prop.startsWith('create') ? grad : undefined;
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
}

const FULL = Date.UTC(2000, 0, 21, 4, 40); // ~full moon
const NEW = Date.UTC(2000, 0, 6, 18, 14); // reference new moon
const count = (fn: string) => calls.filter((c) => c.fn === fn).length;

beforeEach(() => {
  calls = [];
  ctxAvailable = true;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    ctxAvailable ? makeCtx() : null) as never);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MoonGlyph', () => {
  it('renders an aria-hidden canvas sized by `size` and device pixel ratio (capped at 2)', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const { container } = render(<MoonGlyph size={80} date={FULL} />);
    const c = container.querySelector('canvas')!;
    expect(c.getAttribute('aria-hidden')).toBe('true');
    expect(c.className).toBe('moon-glyph');
    expect(c.width).toBe(160);
    expect(c.height).toBe(160);
    expect(c.style.width).toBe('80px');
    expect(c.style.height).toBe('80px');
  });

  it('uses the plain dpr below the cap and falls back to 1 when dpr is 0', () => {
    vi.stubGlobal('devicePixelRatio', 1.5);
    const a = render(<MoonGlyph size={100} date={FULL} />);
    expect(a.container.querySelector('canvas')!.width).toBe(150);
    a.unmount();
    vi.stubGlobal('devicePixelRatio', 0);
    const b = render(<MoonGlyph size={100} date={FULL} />);
    expect(b.container.querySelector('canvas')!.width).toBe(100);
  });

  it('draws a halo gradient only when halo is on, and the disc radius follows it', () => {
    render(<MoonGlyph size={100} date={FULL} halo />);
    expect(count('createRadialGradient')).toBe(3);
    const withHalo = calls.filter((c) => c.fn === 'arc').map((c) => c.args[2]);
    expect(withHalo).toContain(40 * 2.1);
    expect(withHalo).toContain(40);
    cleanup();
    calls = [];
    render(<MoonGlyph size={100} date={FULL} halo={false} />);
    expect(count('createRadialGradient')).toBe(2);
    const noHalo = calls.filter((c) => c.fn === 'arc').map((c) => c.args[2]);
    expect(noHalo).toContain(47);
    expect(noHalo).not.toContain(40 * 2.1);
  });

  it('clips, fills maria on the lit side, and restores the canvas state', () => {
    render(<MoonGlyph size={100} date={FULL} />);
    expect(count('save')).toBe(1);
    expect(count('restore')).toBe(1);
    expect(count('clip')).toBe(1);
    expect(count('ellipse')).toBe(2);
  });

  it('mirrors the lit limb with hemisphere (latitude sign)', () => {
    const quarter = Date.UTC(2000, 0, 14, 0, 0); // waxing, ~half lit
    render(<MoonGlyph size={100} date={quarter} lat={50} />);
    const north = calls.filter((c) => c.fn === 'ellipse')[0].args[7];
    cleanup();
    calls = [];
    render(<MoonGlyph size={100} date={quarter} lat={-50} />);
    const south = calls.filter((c) => c.fn === 'ellipse')[0].args[7];
    expect(north).not.toBe(south);
  });

  it('collapses the terminator to a line at the half-lit moon and widens it at full', () => {
    render(<MoonGlyph size={100} date={NEW} />);
    const newTerm = calls.filter((c) => c.fn === 'ellipse')[1].args[2] as number;
    cleanup();
    calls = [];
    render(<MoonGlyph size={100} date={FULL} />);
    const fullTerm = calls.filter((c) => c.fn === 'ellipse')[1].args[2] as number;
    // |k| = |illum-0.5|*2 is ~1 at both new and full, so the terminator radius is ~40 at size 100 and never wider
    for (const w of [newTerm, fullTerm]) {
      expect(w).toBeGreaterThan(38);
      expect(w).toBeLessThanOrEqual(41);
    }
    cleanup();
    calls = [];
    render(<MoonGlyph size={100} date={Date.UTC(2000, 0, 14, 0, 0)} />);
    expect(calls.filter((c) => c.fn === 'ellipse')[1].args[2] as number).toBeLessThan(12); // ~half lit: nearly a line
  });

  it('repaints when its inputs change and does not throw without a 2d context', () => {
    const { rerender } = render(<MoonGlyph size={100} date={FULL} />);
    const first = count('fill');
    rerender(<MoonGlyph size={100} date={FULL} />);
    expect(count('fill')).toBe(first); // same inputs: no repaint
    rerender(<MoonGlyph size={120} date={FULL} />);
    expect(count('fill')).toBeGreaterThan(first);
    ctxAvailable = false;
    expect(() => rerender(<MoonGlyph size={130} date={FULL} />)).not.toThrow();
  });

  it('defaults the date to now', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FULL);
    try {
      render(<MoonGlyph />);
      expect(count('arc')).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
