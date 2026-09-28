/**
 * UI-kit contract (docs/UI-KIT.md, .cursor/rules/ui-kit.mdc), checked on every
 * test run:
 *   1. every primitive in components/ui/ ships a CSF3 story file next to it;
 *   2. kit CSS and the kit-built pages use tokens — no raw hex colours.
 */
import { describe, expect, it } from 'vitest';

const raw = (m: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k.split('/').pop() as string, String(v)]));

const TSX = raw(import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }));
const CSS = raw(import.meta.glob('./*.css', { query: '?raw', import: 'default', eager: true }));
const PAGES = import.meta.glob(
  [
    '../../views/Health.css',
    '../../views/LogActivity.css',
    '../../views/sessionSummary/NextUp.css',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Not primitives: the in-app gallery screen (it renders the primitives). */
const NOT_PRIMITIVES = new Set(['Gallery.tsx']);

const components = Object.keys(TSX).filter(
  (f) => !f.endsWith('.stories.tsx') && !f.endsWith('.test.tsx') && !NOT_PRIMITIVES.has(f),
);

const noComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const HEX = /#[0-9a-fA-F]{3,8}\b/;

describe('UI kit: every primitive has stories', () => {
  it('finds the primitives', () => {
    expect(components.length).toBeGreaterThan(10);
  });
  it.each(components)('%s has a *.stories.tsx next to it', (f) => {
    const story = f.replace(/\.tsx$/, '.stories.tsx');
    expect(Object.keys(TSX), `add ${story} (CSF3, all variants and states)`).toContain(story);
    expect(TSX[story]).toMatch(/export default meta/);
    expect(TSX[story]).toMatch(/title: 'Kit\//);
  });
});

describe('UI kit: tokens only', () => {
  it.each(Object.keys(CSS))('components/ui/%s has no raw hex', (f) => {
    expect(noComments(CSS[f])).not.toMatch(HEX);
  });

  // Pages rebuilt on the kit: colours come from :root tokens (styles.css).
  it('checks the three kit-built pages', () => {
    expect(Object.keys(PAGES)).toHaveLength(3);
  });
  it.each(Object.keys(PAGES))('%s has no raw hex / rgba colours', (p) => {
    const css = noComments(PAGES[p]);
    expect(css).not.toMatch(HEX);
    expect(css).not.toMatch(/rgba?\(/);
  });
});
