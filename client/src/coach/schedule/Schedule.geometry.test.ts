import { glassCss } from '../../components/ui/readCss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (...p: string[]) => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');
const rule = (css: string, selector: string): string => {
  const i = css.lastIndexOf(`\n${selector} {`) + 1;
  expect(i, selector).toBeGreaterThan(0);
  return css.slice(i, css.indexOf('}', i));
};

describe('Hour labels sit in the gutter, not on the lines (iter19)', () => {
  const css = src('coach', 'schedule', 'Schedule.css');
  it('the gutter is wider than a "07:00" label plus its padding', () => {
    expect(css).toMatch(/--sc-gutter: calc\(var\(--s-48\) \+ var\(--s-8\)\)/);
  });
  it('each label has right padding before the column line and is centred on its hour line', () => {
    expect(rule(css, '.sc-hour')).toMatch(/padding: 0 var\(--s-12\) 0 var\(--s-4\)/);
    expect(rule(css, '.sc-hour')).toMatch(/text-align: right/);
    expect(rule(css, '.sc-hours')).toMatch(/margin-top: calc\(var\(--fs-min\) \* -0\.5\)/);
  });
  it('the body leaves room above the first line, so the first label is never clipped by the header', () => {
    expect(rule(css, '.sc-grid-body')).toMatch(/padding-top: var\(--s-12\)/);
  });
});

describe('The chat popover is solid frosted glass (iter19)', () => {
  const glass = glassCss();
  const block = rule(glass, 'html[data-theme] .uicard.cd-card');
  it('is at least 94% opaque: it paints from the shared plate tokens, and every plate stop is >= 0.94', () => {
    expect(block).toMatch(/var\(--plate-top\)/);
    expect(block).toMatch(/var\(--plate-bot\)/);
    const alphas = [
      ...glass.matchAll(/--plate-(?:top|bot): [^;]*?rgba\(\d+, \d+, \d+, (0?\.\d+)\)/g),
    ].map((m) => Number(m[1]));
    expect(alphas.length).toBeGreaterThanOrEqual(4);
    for (const a of alphas) expect(a).toBeGreaterThanOrEqual(0.94);
  });
  it('blurs what is behind it strongly', () => {
    // the blur is the --bf-dock token (reduced-transparency.css defines it, and turns it off for the accessibility mode)
    expect(block).toMatch(/backdrop-filter: var\(--bf-dock\)/);
    const def = /--bf-dock:\s*blur\((\d+)px\)/.exec(src('reduced-transparency.css'));
    expect(Number(def![1])).toBeGreaterThanOrEqual(24);
  });
  it('is 440 px wide on a desktop, and the base style is near-opaque in every theme', () => {
    expect(src('coach', 'layout', 'frame.css')).toMatch(/--co-dock-w: 440px/);
    expect(rule(src('coach', 'chat', 'ChatDock.css'), '.cd-panel .cd-card')).toMatch(
      /var\(--color-surface\) 96%/,
    );
  });
});
