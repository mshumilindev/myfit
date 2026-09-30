/**
 * Kit guard — features never draw their own buttons.
 * Every button in the app is a kit component (Button, IconButton, BackButton,
 * Chip, Segmented, ListRow, Card as="button", …) so a redesign is a kit-only
 * change. A raw `<button` outside `components/ui/` fails this test; if a case
 * is truly not covered, extend the kit instead of adding an exception.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'client', 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.(stories|test)\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).filter(
  (f) =>
    !relative(SRC, f).startsWith(join('components', 'ui')) &&
    !relative(SRC, f).startsWith('stories'),
);

/** Strip comments so prose mentioning `<button>` does not trip the check. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('kit guard', () => {
  it('has no raw <button> outside components/ui', () => {
    const offenders = files.filter((f) => /<button\b/.test(code(readFileSync(f, 'utf8'))));
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('has no legacy .btn class on JSX elements', () => {
    const offenders = files.filter((f) =>
      /className=(?:"|\{[`'"])[^"`']*(?<![\w-])btn(?![\w-])/.test(code(readFileSync(f, 'utf8'))),
    );
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('has no raw <select>/<textarea>, and <input> only when marked kit-ok', () => {
    const bad: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      if (/<(select|textarea)\b/.test(code(text))) bad.push(relative(SRC, f));
      const lines = text.split('\n');
      lines.forEach((l, i) => {
        if (/<input\b/.test(l) && !/^\s*(\/\/|\*)/.test(l)) {
          const near = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
          if (!/kit-ok/.test(near)) bad.push(`${relative(SRC, f)}:${i + 1}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it('has no static visual inline styles (colour, type, radius) outside components/ui', () => {
    const VISUAL =
      /^(color|background|backgroundColor|border|borderTop|borderBottom|borderLeft|borderRight|borderColor|borderRadius|fontSize|fontWeight|fontFamily|boxShadow|letterSpacing|textTransform|opacity)$/;
    const LITERAL = /^\s*('[^']*'|"[^"]*"|-?[\d.]+)\s*$/;
    const bad: string[] = [];
    for (const f of files) {
      const text = code(readFileSync(f, 'utf8'));
      for (const m of text.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        for (const pm of m[1].matchAll(/(\w+)\s*:\s*([^,]+)/g)) {
          if (VISUAL.test(pm[1]) && LITERAL.test(pm[2])) bad.push(`${relative(SRC, f)}: ${pm[1]}`);
        }
      }
    }
    const perFile = [...new Set(bad.map((b) => b.split(':')[0]))];
    expect(perFile).toEqual([]);
  });
});

/** Design-token guard: CSS never carries literal type/radius/spacing/colour/z values. */
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) cssFiles(p, out);
    else if (/\.css$/.test(name)) out.push(p);
  }
  return out;
}
/** Declarations only — token definitions (`--x: …`) and comments are the source of truth. */
function decls(f: string): string[] {
  const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return text.split('\n').filter((l) => !/^\s*--[\w-]+\s*:/.test(l));
}
const css = cssFiles(SRC);

describe('token guard', () => {
  const scan = (re: RegExp, skip: (f: string) => boolean = () => false) => {
    const bad: string[] = [];
    for (const f of css) {
      if (skip(f)) continue;
      decls(f).forEach((l) => re.test(l) && bad.push(`${relative(SRC, f)}: ${l.trim()}`));
    }
    return bad.slice(0, 15);
  };
  it('font sizes come from --fs-* tokens', () => {
    expect(scan(/font(-size)?:[^;]*\b\d+(\.\d+)?px/)).toEqual([]);
  });
  it('radii come from --r-* tokens', () => {
    expect(scan(/border(-[a-z]+)*-radius:\s*(?!.*var\()[^;]*\b([1-9]|1\d|2[0-4])px/)).toEqual([]);
  });
  it('gap/padding/margin use --s-* tokens for 2–48px', () => {
    expect(
      scan(
        /^\s*(gap|row-gap|column-gap|padding[a-z-]*|margin[a-z-]*):\s*(?!.*(var|calc|env|clamp|min|max)\()[^;]*(?<![-\d.])([2-9]|[1-3]\d|4[0-8])px/,
      ),
    ).toEqual([]);
  });
  it('colours come from palette tokens (glass.css defines the theme)', () => {
    expect(scan(/rgba?\(|#[0-9a-fA-F]{3,8}\b/, (f) => f.endsWith('glass.css'))).toEqual([]);
  });
  it('global stacking layers use --z-* tokens', () => {
    expect(scan(/z-index:\s*(\d{2,})\b/)).toEqual([]);
  });
});

describe('kit override guard', () => {
  it('feature CSS never restyles a kit element (use a kit prop / custom-property hook)', () => {
    const VISUAL =
      /(^|[;\s])(background(-color|-image)?|color|border-radius|box-shadow|border-color)\s*:/;
    const KIT = /\.ui(btn|card|chip|row|field|w|seg|step|gl|sc|cat|ss)\b/;
    const bad: string[] = [];
    for (const f of css) {
      const rel = relative(SRC, f);
      if (rel.startsWith(join('components', 'ui')) || rel === 'glass.css') continue;
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        for (const sel of m[1].split(',')) {
          const last =
            sel
              .trim()
              .split(/\s+|>|\+|~/)
              .filter(Boolean)
              .pop() ?? '';
          if (KIT.test(last) && VISUAL.test(m[2])) bad.push(`${rel}: ${sel.trim()}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('layout guard', () => {
  it('has no static layout inline styles — use ul-/ua-/uj-/ug-/umt-/umb- utilities', () => {
    const LAYOUT =
      /^(display|flexDirection|alignItems|justifyContent|flexWrap|gap|marginTop|marginBottom|textAlign)$/;
    const LITERAL =
      /^\s*('(flex|column|row|center|flex-start|flex-end|space-between|baseline|stretch|wrap|left|right|var\(--space-\d\))'|"[a-z-]+"|(?:[2-9]|[1-4]\d)|'\d+px')\s*$/;
    const bad = new Set<string>();
    for (const f of files) {
      const text = code(readFileSync(f, 'utf8'));
      for (const m of text.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        const entries = [...m[1].matchAll(/(\w+)\s*:\s*([^,]+)/g)];
        // Objects with any computed value are dynamic layout (grid templates, sizes) — allowed.
        if (entries.some((e) => !/^\s*('[^']*'|"[^"]*"|-?[\d.]+)\s*$/.test(e[2]))) continue;
        for (const pm of entries) {
          if (LAYOUT.test(pm[1]) && LITERAL.test(pm[2]))
            bad.add(`${relative(SRC, f)}: ${pm[1]}: ${pm[2].trim()}`);
        }
      }
    }
    expect([...bad].slice(0, 60)).toEqual([]);
  });
});
