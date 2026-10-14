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
  it('coach never defines its own Drawer / Switch / Chip / ListRow / Segmented (reuse the kit ones; theme via tokens)', () => {
    const DEF =
      /(?:function|const|class)\s+(Drawer|Switch|Toggle|Chip|ListRow|Segmented|SidePanel2|Sheet)\b(?!\w)/;
    const coach = files.filter((f) => relative(SRC, f).startsWith('coach'));
    const bad = coach.filter((f) => DEF.test(code(readFileSync(f, 'utf8'))));
    expect(bad.map((f) => relative(SRC, f))).toEqual([]);
    const css = (dir: string, out: string[] = []): string[] => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) css(p, out);
        else if (n.endsWith('.css')) out.push(p);
      }
      return out;
    };
    const dead = css(join(SRC, 'coach')).filter((f) =>
      /\.co-drawer\b/.test(readFileSync(f, 'utf8')),
    );
    expect(dead.map((f) => relative(SRC, f))).toEqual([]);
  });

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
  it('a literal that HAS a spacing / radius token never hides inside calc() / max() / clamp() / shorthands', () => {
    // The plain-token checks above skip any line that mentions calc/max/min/clamp; this one removes var()/env() groups first,
    // then looks for a px literal that equals a token step (--s-2…48, --r-2…24). A re-theme must reach those too.
    const S = new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48]);
    const R = new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24]);
    const strip = (v: string) => v.replace(/(?:var|env)\((?:[^()]|\([^()]*\))*\)/g, '');
    const bad: string[] = [];
    for (const f of css) {
      decls(f).forEach((l) => {
        const sp = /^\s*(gap|row-gap|column-gap|padding[a-z-]*|margin[a-z-]*):(.*)$/.exec(l);
        const ra = /^\s*(border-radius|border-[a-z-]*-radius):(.*)$/.exec(l);
        const m = sp ?? ra;
        if (!m) return;
        const table = sp ? S : R;
        for (const x of strip(m[2]).matchAll(/(?<![-\d.\w])(\d+)px/g))
          if (table.has(Number(x[1]))) bad.push(`${relative(SRC, f)}: ${l.trim()}`);
      });
    }
    expect([...new Set(bad)].slice(0, 15)).toEqual([]);
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

describe('switch-control guard (tabs / segmented / pills / chips)', () => {
  /** Selectors that name a switch-like control. */
  const SWITCHY = /(^|[.\-_])(tabs?|seg|segmented|pills?|chips?|toggle|switcher)([-_.:\s>[]|$)/;
  const VISUAL =
    /(^|[;\s])(background(-color|-image)?|border(-[a-z]+)*-radius|box-shadow|border(-color)?)\s*:/;
  it('coach and client-coach CSS never restyle a tab / segmented / pill / chip (kit tokens do)', () => {
    const bad: string[] = [];
    for (const f of css) {
      const rel = relative(SRC, f);
      if (!rel.startsWith('coach')) continue;
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        for (const sel of m[1].split(',')) {
          const last =
            sel
              .trim()
              .split(/\s+|>|\+|~/)
              .filter(Boolean)
              .pop() ?? '';
          if (SWITCHY.test(last) && VISUAL.test(m[2])) bad.push(`${rel}: ${sel.trim()}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
  it('the switch family is tokenised: Segmented / Chip / ScrollTabs CSS carry no literal radius or px size', () => {
    const bad: string[] = [];
    for (const n of ['Segmented', 'Chip', 'ScrollTabs']) {
      const f = join(SRC, 'components', 'ui', `${n}.css`);
      decls(f).forEach((l) => {
        if (
          /border-radius:[^;]*\b\d+px/.test(l) ||
          /\b(height|padding[a-z-]*):[^;]*\b(?<![-\d.])\d{2,}px/.test(l)
        )
          bad.push(`${n}.css: ${l.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });
});

describe('control-height guard (iter22: one control-height scale everywhere)', () => {
  /** Kit control classes whose height comes ONLY from the scale (styles.css --ctl-h-*). */
  const CONTROL =
    /\.(uibtn|uiseg|uiseg-opt|uichip|uifield|uifield-box|uifield-in|uisearch|uitime|uipc|uipc-chip|stab-t|uiback)(?![\w-])/;
  const HEIGHTISH =
    /(^|[;\s])(height|min-height|max-height|line-height|padding|padding-block|padding-top|padding-bottom)\s*:\s*([^;]+);/g;
  /** Approved exceptions: a control that is NOT a row member (indicator / stretch fill / wrapped name). Keep this list short. */
  const ALLOW: Record<string, string> = {
    '.srail-dot': 'milestone indicator dot on the session rail, not a control row member',
    '.plan-segments .uibtn.add': 'last segment of the focus stepper: stretches to the segment row',
    '.exercise-card .head .uibtn.name':
      'exercise name button: multi-line label, height follows the text',
    '.uibtn.past-gym-row': 'gym row of the past-session hero: a text row, not a control row member',
    '.past-gym-row': 'gym row of the past-session hero: a text row, not a control row member',
    '.exercise-card .head .name': 'exercise name button: multi-line label, height follows the text',
    '.sc-col-add':
      'schedule column "add" target: 1px and visually hidden until it takes keyboard focus',
    '.timed-timer.running':
      'the running timer readout (a row with the stop button), not a kit control itself',
    '.plaque .cta': 'nutrition plaque call-to-action text, not a kit control',
    '.app-nutrition .name': 'nutrition list label, not a kit control',
  };
  /** Class names that features hand to a kit control (`<Button className="x y">`, `<Chip className=…>`): they are controls too. */
  const handedClasses = (): Set<string> => {
    const out = new Set<string>();
    const TAG =
      /<(Button|IconButton|LinkButton|Chip|Segmented|Select|Field|TimeField|SearchField|PresetChips|BackButton|ExportMenu)\b[^<>]*?\bclassName="([^"]+)"/g;
    for (const f of files) {
      const text = code(readFileSync(f, 'utf8'));
      for (const m of text.matchAll(TAG)) for (const c of m[2].split(/\s+/)) if (c) out.add(c);
    }
    return out;
  };
  it('feature CSS never sets height / min-height / padding on a kit control (use size= / the --ctl-h-* scale)', () => {
    const handed = handedClasses();
    const bad: string[] = [];
    for (const f of css) {
      const rel = relative(SRC, f);
      if (rel.startsWith(join('components', 'ui'))) continue;
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        for (const sel of m[1].split(',')) {
          const s = sel.trim();
          const last =
            s
              .split(/\s+|>|\+|~/)
              .filter(Boolean)
              .pop() ?? '';
          const handedHit = [...last.matchAll(/\.([\w-]+)/g)].some((c) => handed.has(c[1]));
          if (!CONTROL.test(last) && !handedHit) continue;
          if (Object.keys(ALLOW).some((a) => s.includes(a))) continue;
          for (const d of m[2].matchAll(HEIGHTISH)) {
            if (/^\s*var\(--ctl-[\w-]+\)\s*$/.test(d[3])) continue;
            // Side padding is layout (width), vertical padding is a height lever: only a zero vertical part is allowed.
            if (/^padding(-block|-top|-bottom)?$/.test(d[2]) && /^\s*0(px)?(\s|$)/.test(d[3]))
              continue;
            bad.push(`${rel}: ${s} { ${d[2]}: ${d[3].trim()} }`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
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

describe('no demo data in the product (iteration 25)', () => {
  const walkAll = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== 'node_modules') walkAll(p, out);
      } else if (/\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };
  /** Test doubles and story scaffolding may use sample data; nothing else may even import it. */
  const isTestSide = (rel: string): boolean =>
    rel.includes('__fixtures__') ||
    /\.(test|stories)\.tsx?$/.test(rel) ||
    /(StoryFrame|storyKit|storyPorts|testVault|testViewport|testWorld)\.tsx?$/.test(rel) ||
    rel.startsWith('stories') ||
    rel.includes(`${join('tools', 'programEditor', 'stories')}`) ||
    rel.includes(`${join('firestore', 'parity')}`);
  const runtime = walkAll(SRC).filter((f) => !isTestSide(relative(SRC, f)));
  const importsOf = (text: string): string[] =>
    [...text.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  it('runtime code never imports a __fixtures__ module or a fixture file', () => {
    const bad: string[] = [];
    for (const f of runtime) {
      for (const spec of importsOf(code(readFileSync(f, 'utf8'))))
        if (/__fixtures__|(^|\/)fixtures(\.ts)?$|demoClock|\/fixture[A-Z]\w*$/.test(spec))
          bad.push(`${relative(SRC, f)} -> ${spec}`);
    }
    expect(bad).toEqual([]);
  });

  it('runtime code has no demo switch: no demo flag, no localStorage override, no "Use demo data"', () => {
    const bad: string[] = [];
    for (const f of runtime) {
      const text = readFileSync(f, 'utf8');
      if (
        /coachIsDemo|setDevBackendOverride|canOfferDemo|DEV_BACKEND_KEY|spotter\.coachBackend|spotter\.clientCoach/.test(
          text,
        )
      )
        bad.push(relative(SRC, f));
    }
    expect(bad).toEqual([]);
  });

  it('the app entry never loads the QA / test registration', () => {
    for (const f of ['main.tsx', 'App.tsx'])
      expect(readFileSync(join(SRC, f), 'utf8')).not.toMatch(/__fixtures__/);
  });
});
