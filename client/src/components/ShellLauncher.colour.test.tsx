import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShellLauncher } from './ShellLauncher';
import { stylesCss, glassCss } from './ui/readCss';
import type { StoreState } from '../store';

vi.mock('../coach/useCoachAccess', () => ({ useCoachAccess: () => true }));
// SPO-141: the Users tile is admin-only; these contracts are about every tile, so they run as an admin.
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getRole: () => 'admin',
}));
afterEach(cleanup);

type Current = 'gym' | 'apex' | 'roster' | 'nutrition' | 'learn' | 'coach';
/** Current app -> the fixed family of its tile (Nutrition is the kcal / lazurite family). */
const APPS: Record<Current, string> = {
  gym: 'gym',
  apex: 'apex',
  nutrition: 'kcal',
  roster: 'people',
  coach: 'coach',
  learn: 'learn',
};

const noop = () => undefined;
function open(current: Current) {
  render(
    <ShellLauncher
      store={{ workouts: [], queue: [] } as unknown as StoreState}
      now={Date.now()}
      current={current}
      peopleLabel="Users"
      peopleDesc=""
      activeChallenges={0}
      notifUnread={0}
      onGym={noop}
      onApex={noop}
      onRoster={noop}
      onNutrition={noop}
      nutritionEnabled
      onLearn={noop}
      onClose={noop}
    />,
  );
}
const tiles = () => [...document.body.querySelectorAll<HTMLElement>('.shell-tile')];

describe('ShellLauncher: colour coding', () => {
  it('has no "One account · one training history" line', () => {
    open('gym');
    expect(document.body.querySelector('.shell-note')).toBeNull();
    expect(document.body.textContent).not.toMatch(/one account|одна історія|viena paskyra/i);
  });

  it('every tile wears its own app family on the tile itself (caret, outline, tint read --t-*)', () => {
    open('gym');
    const all = tiles();
    expect(all).toHaveLength(6);
    const fam = all.map(
      (t) => [...t.classList].find((c) => c.startsWith('uit--') && c !== 'uit--neutral') ?? '',
    );
    expect(fam).toEqual(
      ['gym', 'apex', 'kcal', 'people', 'coach', 'learn'].map((f) => `uit--${f}`),
    );
  });

  it.each(Object.keys(APPS) as Current[])(
    '%s current: one selected tile with outline class, aria-current and a check',
    (current) => {
      open(current);
      const sel = document.body.querySelectorAll('.shell-tile.current');
      expect(sel).toHaveLength(1);
      const tile = sel[0] as HTMLButtonElement;
      expect(tile.classList.contains(`uit--${APPS[current]}`)).toBe(true);
      expect(tile.getAttribute('aria-current')).toBe('true');
      expect(tile.disabled).toBe(true);
      expect(tile.querySelector('.shell-current svg')).not.toBeNull();
      // Others keep a caret, no check.
      for (const t of tiles().filter((x) => x !== tile)) {
        expect(t.querySelector('.shell-go')).not.toBeNull();
        expect(t.querySelector('.shell-current')).toBeNull();
      }
    },
  );

  it('Coach has its own icon, different from People', () => {
    open('gym');
    const svgOf = (name: string) =>
      screen.getByText(name).closest('button')?.querySelector('.uitile svg')?.innerHTML ?? '';
    const coach = svgOf('Coach');
    const people = svgOf('Users');
    expect(coach).not.toBe('');
    expect(people).not.toBe('');
    expect(coach).not.toBe(people);
  });
});

describe('ShellLauncher: tokens and contrast', () => {
  const css = stylesCss();
  const rootStart = css.indexOf(':root {');
  const root = css.slice(rootStart, css.indexOf('\n}\n', rootStart));
  const tok = new Map<string, string>();
  for (const m of root.matchAll(/(--[\w-]+):\s*([^;]+);/g)) tok.set(m[1], m[2].trim());
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = (h: string) => {
    const [r, g, b] = rgb(h).map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const mix = (a: string, b: string, t: number) =>
    '#' +
    rgb(a)
      .map((v, i) =>
        Math.round(v * (1 - t) + rgb(b)[i] * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');

  it('the selected rule (Card.css, glass.css) and the caret read the family tokens, not a fixed colour', () => {
    for (const [file, sel] of [
      ['ui/Card.css', '.uicard--selected {'],
      ['../glass.css', 'html[data-theme] .uicard.uicard--selected {'],
    ]) {
      const src =
        file === '../glass.css' ? glassCss() : readFileSync(join(__dirname, file), 'utf8');
      const rule = src.slice(src.indexOf(sel));
      const body = rule.slice(0, rule.indexOf('}'));
      expect(body, file).toMatch(/var\(--t-base\)/);
      expect(body, file).toMatch(/var\(--t-tint\)/);
    }
    const go = css.slice(css.indexOf('.shell-go {'));
    expect(go.slice(0, go.indexOf('}'))).toMatch(/var\(--t-base/);
  });

  it.each(Object.values(APPS))('%s: text >= 4.5:1 on the selected tint, caret >= 3:1', (fam) => {
    const base = tok.get(`--color-${fam}`) as string;
    const tint = tok.get(`--color-${fam}-tint`) as string;
    const text = tok.get(`--color-${fam}-text`) as string;
    const bg = tok.get('--color-bg') as string;
    const selected = mix(tint, base, 0.14);
    expect(ratio(tok.get('--color-text') as string, selected)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(text, selected)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(base, bg)).toBeGreaterThanOrEqual(3);
  });

  // --- the sheet itself wears the CURRENT app's colour --------------------------------------
  const BLACK = '#000000';
  type Rgb = number[];
  const toRgb = (h: string): Rgb => rgb(h);
  const L = (c: Rgb) => {
    const [r, g, b] = c.map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const cr = (a: Rgb, b: Rgb) => {
    const [hi, lo] = [L(a), L(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => v * (1 - t) + b[i] * t);
  /** `color-mix(base p%, rgba(dark, a))` composited over `under` (premultiplied, like the browser). */
  const wash = (base: Rgb, p: number, dark: Rgb, a: number, under: Rgb): Rgb => {
    const alpha = p + (1 - p) * a;
    const col = base.map((v, i) => (p * v + (1 - p) * a * dark[i]) / alpha);
    return mixRgb(under, col, alpha);
  };
  const sheetOf = (fam: string, pct: number): Rgb => {
    const bg = toRgb(tok.get('--color-bg') as string);
    const plate = mixRgb(bg, toRgb(BLACK), 0.7); // --shell-sheet-base: bg 30% + black
    return mixRgb(plate, toRgb(tok.get(`--color-${fam}`) as string), pct);
  };

  it('the sheet recipe in CSS: current-app tone, accent 6-8% over a dark base, 1px accent-line edge', () => {
    const glass = glassCss();
    const at = glass.indexOf('html[data-theme] .sheet.sheet--toned.uimore {');
    expect(at).toBeGreaterThan(0);
    const rule = glass.slice(at, glass.indexOf('\n}\n', at));
    expect(rule).toMatch(/var\(--t-base\) calc\(8% \* var\(--plate-tint-k\)\)/);
    expect(rule).toMatch(/var\(--t-base\) calc\(6% \* var\(--plate-tint-k\)\)/);
    expect(rule).toMatch(/inset 0 0 0 1px var\(--t-line\)/);
    const own = css.slice(css.indexOf('.uimore.sheet--toned {'));
    expect(own.slice(0, own.indexOf('}'))).toMatch(/border: 1px solid var\(--t-line\)/);
    expect(css).toMatch(/--shell-sheet-base: color-mix\(in srgb, var\(--color-bg\) 30%, black\)/);
  });

  it.each(Object.entries(APPS) as [Current, string][])(
    '%s: the sheet carries the current app tone class',
    (current, fam) => {
      open(current);
      const sheet = document.body.querySelector('.shell-sheet') as HTMLElement;
      expect(sheet.classList.contains('sheet--toned')).toBe(true);
      expect(sheet.classList.contains(`uit--${fam}`)).toBe(true);
    },
  );

  it.each(Object.values(APPS))(
    '%s: tiles stand out from the sheet (luminance) and text stays >= 4.5:1',
    (fam) => {
      const base = toRgb(tok.get(`--color-${fam}`) as string);
      const text = toRgb(tok.get(`--color-${fam}-text`) as string);
      const line = toRgb(tok.get(`--color-${fam}-line`) as string);
      const ink = toRgb(tok.get('--color-text') as string);
      for (const pct of [0.08, 0.06]) {
        const sheet = sheetOf(fam, pct);
        // neutral glass tile (rgba(31,33,37,.72)), as separate from the sheet as it was from the page
        const neutral = mixRgb(sheet, [31, 33, 37], 0.72);
        expect(cr(neutral, sheet)).toBeGreaterThanOrEqual(1.075);
        // family washes (22% -> 6% of the tile's own colour): at least 1.04 even at the dark stop (their 32% rim carries the edge)
        expect(cr(wash(base, 0.22, [20, 18, 14], 0.4, sheet), sheet)).toBeGreaterThanOrEqual(1.25);
        expect(cr(wash(base, 0.06, [16, 15, 13], 0.6, sheet), sheet)).toBeGreaterThanOrEqual(1.04);
        // text on the plate itself (title, labels) and on the tile surface
        expect(cr(ink, sheet)).toBeGreaterThanOrEqual(4.5);
        expect(cr(text, sheet)).toBeGreaterThanOrEqual(4.5);
        expect(cr(ink, neutral)).toBeGreaterThanOrEqual(4.5);
        // the 1px accent-line edge is visible against the plate (>= 1.5) ...
        expect(cr(line, sheet)).toBeGreaterThanOrEqual(1.5);
      }
      // ... and the plate is subtle: much darker than the accent itself
      expect(cr(base, sheetOf(fam, 0.08))).toBeGreaterThanOrEqual(4.5);
    },
  );
});
