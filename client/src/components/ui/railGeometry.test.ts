import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIL_EXTRA_TILE, RAIL_GAP, RAIL_TILE } from './railOverflow';

/**
 * One rail geometry for the whole suite. Gym, Apex, People, Nutrition, Learn and Coach render the
 * same kit `Rail`; switching apps must not move a single button. These constants are the shared
 * numbers (kit CSS and railOverflow.ts agree), and no app-scoped CSS may change geometry.
 */
const SRC = join(__dirname, '..', '..');
const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');
const STYLES = readFileSync(join(SRC, 'styles.css'), 'utf8');
const RAIL = read('Rail.css');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (f !== 'node_modules') walk(p, out);
    } else if (p.endsWith('.css')) out.push(p);
  }
  return out;
}
const body = (css: string, sel: string): string => {
  const at = css.indexOf(`${sel} {`);
  expect(at, sel).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf('}', at));
};

describe('shared rail geometry constants', () => {
  it('tiles: labelled 72x64, compact 44, default 46; extras 44/46; gap 5.6', () => {
    expect(RAIL_TILE).toEqual({ labelled: 64, compact: 44, default: 46 });
    expect(RAIL_EXTRA_TILE).toEqual({ labelled: 44, compact: 44, default: 46 });
    expect(RAIL_GAP).toBe(5.6);
    expect(body(RAIL, '.rail.rail--labelled')).toMatch(/width: 88px/);
    expect(body(RAIL, '.rail.rail--compact')).toMatch(/width: 60px/);
    expect(body(RAIL, '.rail--labelled .rail-item')).toMatch(/width: 72px;[\s\S]*height: 64px/);
    expect(body(RAIL, '.rail--compact .rail-item')).toMatch(/width: 44px;\s*height: 44px/);
    expect(body(RAIL, '.rail--labelled .rail-label')).toMatch(/font-size: var\(--fs-13\)/);
    expect(body(RAIL, '.rail--labelled .rail-label')).toMatch(/font-weight: 500/);
    expect(body(RAIL, '.rail--labelled .rail-label')).toMatch(/white-space: nowrap/);
    expect(body(RAIL, '.rail-extra')).toMatch(/height: 46px/);
    expect(body(RAIL, '.rail--labelled .rail-extra,\n.rail--compact .rail-extra')).toMatch(
      /height: 44px/,
    );
  });

  it('frame: rail padding, gap and brand block come from styles.css only', () => {
    const media = STYLES.slice(STYLES.indexOf('/* --- Desktop layout (≥720px)'));
    const rail = body(media, '  .rail');
    expect(rail).toMatch(/padding: var\(--space-6\) 0/);
    expect(rail).toMatch(/gap: var\(--space-2\)/);
    expect(body(STYLES, '.rail-brand')).toMatch(/padding: 0 0 var\(--s-18\)/);
    expect(body(STYLES, '.rail-brand .spotter-mark-plate')).toMatch(/width: 40px;\s*height: 40px/);
    expect(body(RAIL, '.rail-nav')).toMatch(/gap: var\(--space-2\)/);
  });

  it('Rail.css has no per-app dependence (the old .app-coach density block is gone)', () => {
    expect(RAIL).not.toMatch(/\.app-coach/);
  });

  it('the active tile has no edge bar / notch in any stylesheet', () => {
    for (const f of walk(SRC))
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/\.rail-item\.active::(before|after)/);
  });
});

describe('one shared rail foot (Apps + avatar) for all six apps', () => {
  const tsx = (f: string) => readFileSync(join(SRC, f), 'utf8');

  it('the avatar trigger is a fixed 44px slot with no padding, from the kit CSS only', () => {
    const b = body(RAIL, '.rail-foot .rail-account .account-chip');
    expect(b).toMatch(/width: 44px;\s*height: 44px;\s*min-height: 44px;\s*padding: 0/);
    expect(b).toMatch(/margin: var\(--space-2\) 0 0/);
  });

  it('the rail foot, avatar and account trigger exist in ONE component, SuiteRailFoot', () => {
    const foot = tsx('components/suite/SuiteRailFoot.tsx');
    expect(foot).toMatch(/className="account-chip"/);
    expect(foot).toMatch(/avatar\(34\)/);
    expect(foot).toMatch(/<AccountPopover/);
    for (const f of ['components/AppRail.tsx', 'coach/CoachApp.tsx']) {
      const src = tsx(f);
      expect(src, f).toMatch(/<SuiteRailFoot/);
      expect(src, f).not.toMatch(
        /account-chip|account-avatar|rail-account|<AccountPopover|<Avatar\b/,
      );
      expect(src, f).not.toMatch(/icon="squares-four"/);
    }
  });

  it('no second implementation of the nav account anywhere in the app', () => {
    const files: string[] = [];
    const scan = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) scan(p);
        else if (/\.tsx$/.test(f) && !/\.(test|stories)\.tsx$/.test(f)) files.push(p);
      }
    };
    scan(SRC);
    const users = (re: RegExp) =>
      files
        .filter((f) => re.test(readFileSync(f, 'utf8')))
        .map((f) => f.replace(SRC + '/', ''))
        .sort();
    // the popover (desktop avatar) is mounted by the shared foot only; the panel by the two kit
    // containers (popover on desktop, More sheet on phone); the account props by one hook.
    expect(users(/<AccountPopover\b/)).toEqual(['components/suite/SuiteRailFoot.tsx']);
    expect(users(/<AccountPanel\b/)).toEqual([
      'components/ui/AccountPopover.tsx',
      'components/ui/MoreMenu.tsx',
    ]);
    expect(users(/\buseSuiteAccount\(/)).toEqual([
      'coach/CoachApp.tsx',
      'components/SuiteTabBar.tsx',
      'components/suite/SuiteRailFoot.tsx',
      'components/suite/useSuiteAccount.tsx',
    ]);
  });

  it('Coach has no foot / avatar CSS of its own', () => {
    const css = readFileSync(join(SRC, 'coach', 'CoachApp.css'), 'utf8');
    expect(css).not.toMatch(/account-|rail-foot|rail-account|rail-switch/);
  });
});

describe('no app-scoped CSS moves the rail', () => {
  // A rule whose selector is scoped to one app (or Coach) and touches a rail part may only skin
  // it (colour, background, shadow, z-order, display toggle), never size, space or place it.
  const SCOPE =
    /(\.app-(?!root)[\w-]+|\.theme-(?!glass)[\w-]+|\.co-shell|\.apex-app)[^,{}]*\.rail(-[\w-]+)?\b/;
  const GEOMETRY =
    /(^|[;{\s])(width|height|min-width|min-height|max-width|max-height|padding[\w-]*|margin[\w-]*|gap|row-gap|column-gap|font-size|font-weight|line-height|top|left|right|bottom|inset|flex[\w-]*|align-[\w-]+|justify-[\w-]+|order|border-width|border-radius|transform):/;

  it('every app-scoped .rail* rule is skin only', () => {
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].trim();
        if (!SCOPE.test(sel)) continue;
        // display toggles of the hidden/visible rail are allowed
        const decl = m[2].replace(/display:\s*[\w-]+;?/g, '');
        if (GEOMETRY.test(decl)) offenders.push(`${f.replace(SRC, '')}: ${sel} { ${m[2].trim()} }`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
