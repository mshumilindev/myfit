import { describe, expect, it } from 'vitest';
import {
  APP_BREAKPOINT,
  COACH_BREAKPOINT,
  COACH_WIDE_BREAKPOINT,
  minWidthQuery,
} from './breakpoints';
import { kitCss } from './readCss';

const css = kitCss;

describe('breakpoints (R-KIT-31)', () => {
  it('the Coach shell swaps at 768, the real app stays at 720', () => {
    expect(COACH_BREAKPOINT).toBe(768);
    expect(APP_BREAKPOINT).toBe(720);
    expect(COACH_WIDE_BREAKPOINT).toBe(1280);
    expect(minWidthQuery(COACH_BREAKPOINT)).toBe('(min-width: 768px)');
  });

  it.each(['Rail', 'TabBar'])('%s.css pins the coach band to the constant', (name) => {
    const band = `@media (min-width: ${APP_BREAKPOINT}px) and (max-width: ${COACH_BREAKPOINT - 0.02}px)`;
    expect(css(name)).toContain(band);
  });

  it('TabBar.css still hides the default bar at 720 (real-app behaviour unchanged)', () => {
    expect(css('TabBar')).toMatch(
      /@media \(min-width: 720px\) \{\s*\.tabbar-wrap,\s*\.tabbar \{\s*display: none;/,
    );
  });

  it('coach overrides are scoped to the coach classes only', () => {
    const rail = css('Rail');
    expect(rail.slice(rail.indexOf('@media (min-width: 720px) and (max-width'))).toContain(
      '.rail.rail--coach',
    );
    const tab = css('TabBar');
    const band = tab.slice(tab.indexOf('@media (min-width: 720px) and (max-width'));
    expect(band).toContain('.tabbar-wrap.tabbar-wrap--coach');
    expect(band).not.toMatch(/^\s*\.tabbar-wrap\s*[,{]/m);
  });
});
