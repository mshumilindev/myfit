import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stylesCss, glassCss } from '../components/ui/readCss';

/**
 * The Coach identity colour (tourmaline) must stay distinct from every other app and status
 * colour, and readable: ink on the fill, accent-200 on the dark page, muted text on the ambient
 * glow. The numbers behind the choice are in dev1-shell2.md.
 */
const STYLES = stylesCss();
const GLASS = glassCss();

/**
 * A token may read `var(--skin-x, var(--c-aabbcc))` (a theme can skin it) or `var(--c-aabbcc)` (a raw primitive,
 * ADR 010): the colour the maths is about is the unskinned primitive's hex.
 */
function plain(v: string): string {
  const skin = v.match(/^var\(--skin-[\w-]+,\s*(.+)\)$/);
  if (skin) return plain(skin[1].trim());
  const prim = v.match(/^var\(--c-([0-9a-f]{6})\)$/);
  return prim ? `#${prim[1]}` : v;
}

const rootTokens = new Map<string, string>();
const rootBlock = STYLES.slice(
  STYLES.indexOf(':root {'),
  STYLES.indexOf('\n}\n', STYLES.indexOf(':root {')),
);
for (const m of rootBlock.matchAll(/(--[\w-]+):\s*([^;]+);/g))
  rootTokens.set(m[1], plain(m[2].trim()));

function blockOf(selector: string): Map<string, string> {
  const at = STYLES.indexOf(selector);
  expect(at, selector).toBeGreaterThan(-1);
  const body = STYLES.slice(STYLES.indexOf('{', at) + 1, STYLES.indexOf('}', at));
  return new Map(
    [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], plain(m[2].trim())]),
  );
}
const coach = blockOf('.app-coach,\n.theme-coach {');
const resolve = (name: string): string => {
  const v = rootTokens.get(name) ?? '';
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolve(ref[1]) : v;
};
const hex = (name: string) => coach.get(name) ?? rootTokens.get(name) ?? '';

type RGB = [number, number, number];
const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lum(h: string) {
  const [r, g, b] = rgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
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

function lab(h: string): RGB {
  const [r, g, b] = rgb(h).map(lin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
/** CIEDE2000. */
function dE(h1: string, h2: string): number {
  const [L1, a1, b1] = lab(h1);
  const [L2, a2, b2] = lab(h2);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hp = (a: number, b: number) => (((Math.atan2(b, a) / rad) % 360) + 360) % 360;
  const h1p = hp(a1p, b1);
  const h2p = hp(a2p, b2);
  const dL = L2 - L1;
  const dC = C2p - C1p;
  let dh = h2p - h1p;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * rad) / 2);
  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;
  let hbar = (h1p + h2p) / 2;
  if (Math.abs(h1p - h2p) > 180) hbar += h1p + h2p < 360 ? 180 : -180;
  const T =
    1 -
    0.17 * Math.cos((hbar - 30) * rad) +
    0.24 * Math.cos(2 * hbar * rad) +
    0.32 * Math.cos((3 * hbar + 6) * rad) -
    0.2 * Math.cos((4 * hbar - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lp - 50) ** 2) / Math.sqrt(20 + (Lp - 50) ** 2);
  const Sc = 1 + 0.045 * Cp;
  const Sh = 1 + 0.015 * Cp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

describe('coach accent ramp', () => {
  it('is defined for the wrapper and the document root with the full ramp and glow', () => {
    expect(STYLES).toContain('.app-coach,\n.theme-coach {');
    for (const n of [100, 200, 300, 400, 500, 600, 700, 800, 900])
      expect(coach.get(`--color-accent-${n}`), `accent-${n}`).toMatch(/^#[0-9a-f]{6}$/);
    expect(coach.get('--color-accent')).toBe(coach.get('--color-accent-500'));
    expect(coach.get('--coach-glow')).toBeTruthy();
    // tint/text/line are re-set so a wrapper (not only the root) stops showing brass borders
    for (const n of ['--color-accent-tint', '--color-accent-text', '--color-accent-line'])
      expect(coach.get(n), n).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('the fixed identity tokens equal the ramp (base 500, tint 900)', () => {
    expect(rootTokens.get('--color-coach')).toBe(coach.get('--color-accent-500'));
    expect(rootTokens.get('--color-coach-tint')).toBe(coach.get('--color-accent-900'));
  });

  it('page ink on the accent fill is >= 4.5:1 (primary buttons, selected pills)', () => {
    expect(contrast(hex('--color-bg'), hex('--color-accent'))).toBeGreaterThanOrEqual(4.5);
  });

  it('accent-200 text on the dark page and surface is >= 4.5:1', () => {
    expect(contrast(hex('--color-accent-200'), hex('--color-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex('--color-accent-200'), hex('--color-surface'))).toBeGreaterThanOrEqual(4.5);
  });

  it('accent text on the accent tint, and the tone text on tone tint, are >= 4.5:1', () => {
    expect(contrast(hex('--color-accent-text'), hex('--color-accent-tint'))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(hex('--color-coach-text'), hex('--color-coach-tint'))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('the accent as an icon / edge on the page is >= 3:1', () => {
    expect(contrast(hex('--color-accent'), hex('--color-bg'))).toBeGreaterThanOrEqual(3);
  });
});

describe('coach accent is distinct (CIEDE2000 of the base swatch)', () => {
  const accent = () => coach.get('--color-accent') as string;
  const others: Record<string, string> = {
    gym: '--color-gym',
    apex: '--color-apex',
    people: '--color-people',
    learn: '--color-learn',
    ok: '--color-ok',
    danger: '--color-danger',
    share: '--color-share',
    note: '--color-note',
    atlas: '--color-atlas',
    kcal: '--color-kcal',
    active: '--color-active',
    sport: '--color-sport',
  };
  it.each(Object.entries(others))('vs %s >= 15', (_n, tok) => {
    expect(dE(accent(), resolve(tok))).toBeGreaterThanOrEqual(15);
  });

  it('vs the nutrition lazurite accent >= 15', () => {
    const nut = blockOf('.app-nutrition,\n.theme-nutrition {').get('--color-accent') as string;
    expect(dE(accent(), nut)).toBeGreaterThanOrEqual(15);
  });
});

describe('ambient background stays readable', () => {
  const bg = rootTokens.get('--color-bg') as string;
  const muted = rootTokens.get('--color-neutral-500') as string;
  const lava = (name: string) => {
    const m = GLASS.match(
      new RegExp(
        `html\\[data-theme=glass\\]\\.theme-coach\\s*\\{[^}]*${name}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`,
      ),
    ) as RegExpMatchArray;
    expect(m, name).toBeTruthy();
    const hexv =
      '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
    return { hexv, alpha: Number(m[4]) };
  };

  it('the CSS glow is the shared sub-app chrome (accent-driven), not a Coach copy', () => {
    // The shell wears `apex-app` like every other sub-app; the glow/weave rules live once in styles.css.
    const css = readFileSync(join(__dirname, 'CoachApp.css'), 'utf8');
    expect(css).not.toMatch(/::before|::after/);
    expect(readFileSync(join(__dirname, 'CoachApp.tsx'), 'utf8')).toMatch(
      /className="app-coach co-shell apex-app"/,
    );
    const shared = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
    expect(shared).toMatch(/\.apex-app::before\s*\{[\s\S]*?var\(--color-accent\)/);
    expect(shared).toMatch(/\.apex-app::after\s*,?[\s\S]*?var\(--color-accent\)/);
  });

  it('muted text on the strongest CSS glow (13% + 3% accent over the page) is >= 4.5:1', () => {
    const glow = mix(bg, coach.get('--color-accent') as string, 0.16);
    expect(contrast(muted, glow)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(rootTokens.get('--color-text') as string, glow)).toBeGreaterThanOrEqual(7);
  });

  it.each(['--lava-2', '--lava-3'])(
    'muted text on %s at its peak, plus a 4%% accent residue, is >= 4.5:1',
    (name) => {
      const { hexv, alpha } = lava(name);
      const peak = mix(mix(bg, hexv, alpha), coach.get('--color-accent') as string, 0.04);
      expect(contrast(muted, peak)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('keeps the one universal violet spot: Coach does not override --lava-1', () => {
    const block = GLASS.match(
      /html\[data-theme=glass\]\.theme-coach\s*\{([^}]*)\}/,
    ) as RegExpMatchArray;
    expect(block).toBeTruthy();
    expect(block[1]).not.toMatch(/--lava-1/);
    // The shared violet (default block) at its peak is readable too.
    const m = GLASS.match(
      /html\[data-theme=glass\]\s*\{[^}]*--lava-1:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
    ) as RegExpMatchArray;
    const violet =
      '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
    expect(contrast(muted, mix(bg, violet, Number(m[4])))).toBeGreaterThanOrEqual(4.5);
  });

  it('same recipe as the other sub-apps: gem alpha .7 and shade alpha .9', () => {
    expect(lava('--lava-2').alpha).toBe(0.7);
    expect(lava('--lava-3').alpha).toBe(0.9);
    for (const app of ['apex', 'learn', 'roster', 'nutrition']) {
      const b = GLASS.match(
        new RegExp(`html\\[data-theme=glass\\]\\.theme-${app}\\s*\\{([^}]*)\\}`),
      ) as RegExpMatchArray;
      expect(b[1], app).toMatch(/--lava-2:\s*rgba\([^)]*,\s*0\.7\)/);
      expect(b[1], app).toMatch(/--lava-3:\s*rgba\([^)]*,\s*0\.9\)/);
    }
  });
});
