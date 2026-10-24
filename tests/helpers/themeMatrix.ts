/**
 * Token resolver for the theme × mode × app-skin matrix (SPO-136, ADR 010).
 *
 * Reads the real CSS (tokens/primitives.css → styles.css → redesign.css → glass.css, the import order of main.tsx), keeps
 * the top-level rules that style the <html> element (`:root`, `html`, `html.theme-*`,
 * `:root[data-sleep='night']`, `.theme-*`), applies them in cascade order (specificity, then
 * source order) for a given <html> state, and resolves `var()`, hex, rgb(a) and srgb `color-mix`
 * to a colour. Used by the contrast guard; knows nothing about components.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';

const SRC = join(__dirname, '..', '..', 'client', 'src');
/** main.tsx import order: primitives → styles → redesign → every themes/*.css → glass.css. */
const THEME_FILES = readdirSync(join(SRC, 'themes'))
  .filter((f) => f.endsWith('.css') && !f.startsWith('_'))
  .sort()
  .map((f) => `themes/${f}`);
/** Per-theme raw colours: tokens/primitives.<id>.css. */
const THEME_PRIMITIVES = readdirSync(join(SRC, 'tokens'))
  .filter((f) => /^primitives\..+\.css$/.test(f))
  .sort()
  .map((f) => `tokens/${f}`);
const FILES = [
  'tokens/primitives.css',
  ...THEME_PRIMITIVES,
  'styles.css',
  'redesign.css',
  ...THEME_FILES,
  'glass.css',
  'glass-shape.css',
];

/** Theme ids found on disk (client/src/themes/<id>.css). */
export const THEME_IDS = THEME_FILES.map((f) => f.replace(/^themes\/|\.css$/g, ''));

export interface HtmlState {
  classes: string[];
  attrs: Record<string, string>;
}

interface Decl {
  prop: string;
  value: string;
  spec: number;
  order: number;
  selector: string;
}

type Rule = { selector: string; spec: number; classes: string[]; attrs: [string, string][] };

/** Parse one compound selector that can only match <html>; null when it cannot. */
function parseHtmlSelector(sel: string): Rule | null {
  const s = sel.trim();
  if (/[\s>+~]/.test(s.replace(/\[[^\]]*\]/g, ''))) return null; // combinators → not the root element
  let rest = s;
  let cls = 0;
  let tags = 0;
  const classes: string[] = [];
  const attrs: [string, string][] = [];
  let ok = true;
  rest = rest.replace(/^html/, () => {
    tags++;
    return '';
  });
  rest = rest.replace(/:root/g, () => {
    cls++;
    return '';
  });
  rest = rest.replace(/\[([\w-]+)=(?:'|")?([^'"\]]*)(?:'|")?\]/g, (_m, a: string, v: string) => {
    cls++;
    attrs.push([a, v]);
    return '';
  });
  rest = rest.replace(/\.([\w-]+)/g, (_m, c: string) => {
    cls++;
    classes.push(c);
    return '';
  });
  if (rest.trim() !== '') ok = false;
  if (!ok || (tags === 0 && cls === 0)) return null;
  return { selector: s, spec: cls * 100 + tags, classes, attrs };
}

let cache: Decl[] | null = null;
function allDecls(): (Decl & { rule: Rule })[] {
  if (cache) return cache as (Decl & { rule: Rule })[];
  const out: (Decl & { rule: Rule })[] = [];
  let order = 0;
  for (const f of FILES) {
    const root = postcss.parse(readFileSync(join(SRC, f), 'utf8'), { from: f });
    root.each((node) => {
      if (node.type !== 'rule') return; // skip @media / @supports / @keyframes blocks
      const rules = node.selector
        .split(',')
        .map(parseHtmlSelector)
        .filter((r): r is Rule => r !== null);
      if (!rules.length) return;
      node.each((d) => {
        if (d.type !== 'decl' || !d.prop.startsWith('--')) return;
        for (const rule of rules)
          out.push({
            prop: d.prop,
            value: d.value.trim(),
            spec: rule.spec,
            order: order++,
            selector: rule.selector,
            rule,
          });
      });
    });
  }
  cache = out;
  return out;
}

/** Custom properties in effect on <html> for this state (cascade winner per property). */
export function cascade(state: HtmlState): Map<string, string> {
  const winners = new Map<string, Decl>();
  for (const d of allDecls()) {
    const { classes, attrs } = (d as Decl & { rule: Rule }).rule;
    const matches =
      classes.every((c) => state.classes.includes(c)) &&
      attrs.every(([a, v]) => state.attrs[a] === v);
    if (!matches) continue;
    const cur = winners.get(d.prop);
    if (!cur || d.spec > cur.spec || (d.spec === cur.spec && d.order > cur.order))
      winners.set(d.prop, d);
  }
  return new Map([...winners].map(([k, v]) => [k, v.value]));
}

export type RGBA = [number, number, number, number];

function parseHex(h: string): RGBA | null {
  const m = h.match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let x = m[1];
  if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join('');
  if (x.length !== 6 && x.length !== 8) return null;
  const n = (i: number) => parseInt(x.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), x.length === 8 ? n(6) / 255 : 1];
}

function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

/** Resolve a token to a colour, or null when it uses something this resolver does not model. */
export function resolve(props: Map<string, string>, value: string, depth = 0): RGBA | null {
  if (depth > 12) return null;
  const v = value.trim();
  const hex = parseHex(v);
  if (hex) return hex;
  const v1 = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (v1) {
    const next = props.get(v1[1]) ?? v1[2];
    return next === undefined ? null : resolve(props, next, depth + 1);
  }
  const rgb = v.match(/^rgba?\(([^)]*)\)$/);
  if (rgb) {
    const p = rgb[1].split(/[\s,/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const ch = p.slice(0, 3).map(Number);
    if (ch.some(Number.isNaN)) return null;
    const a = p[3] === undefined ? 1 : p[3].endsWith('%') ? parseFloat(p[3]) / 100 : Number(p[3]);
    return [ch[0], ch[1], ch[2], a];
  }
  const mix = v.match(/^color-mix\(\s*in srgb\s*,(.*)\)$/s);
  if (mix) {
    const parts = splitTop(mix[1]);
    if (parts.length !== 2) return null;
    const read = (p: string): { c: RGBA | null; w: number | null } => {
      const m = p.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?%|var\([^()]*\)))?$/s);
      const colour = m ? m[1].trim() : p;
      // The weight is a number, or a `var()` holding one (e.g. the app-skin strength token).
      let weight: string | undefined = m?.[2];
      for (let i = 0; weight?.startsWith('var(') && i < 4; i++) {
        const w = weight.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
        weight = w ? (props.get(w[1]) ?? w[2])?.trim() : undefined;
      }
      const wn = weight?.match(/^(\d+(?:\.\d+)?)%$/);
      return {
        c: colour === 'transparent' ? [0, 0, 0, 0] : resolve(props, colour, depth + 1),
        w: wn ? parseFloat(wn[1]) : null,
      };
    };
    const a = read(parts[0]);
    const b = read(parts[1]);
    if (!a.c || !b.c) return null;
    let wa = a.w ?? (b.w === null ? 50 : 100 - b.w);
    let wb = b.w ?? 100 - wa;
    const sum = wa + wb;
    wa /= sum;
    wb /= sum;
    const alpha = a.c[3] * wa + b.c[3] * wb;
    if (alpha === 0) return [0, 0, 0, 0];
    const chan = (i: number) => (a.c![i] * a.c![3] * wa + b.c![i] * b.c![3] * wb) / alpha;
    return [chan(0), chan(1), chan(2), alpha];
  }
  return null;
}

/** Composite a (possibly translucent) colour over an opaque backdrop. */
export function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1) as RGBA;
}

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (c: RGBA) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function contrast(a: RGBA, b: RGBA): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
