import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEMES, getHolidayTheme, initTheme, setTheme, startPreview, endPreview } from './registry';
import type { ThemeDef } from './registry';
import { startHolidayWatch } from './holidayWatch';

const list = THEMES as ThemeDef[];
const html = () => document.documentElement;
let stop: (() => void) | null = null;

const at = (y: number, m: number, d: number, hh = 12) =>
  vi.setSystemTime(new Date(y, m - 1, d, hh));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false })); // jsdom has none; motion is not reduced
  localStorage.clear();
  html().lang = 'en';
  html().removeAttribute('data-theme');
  html().removeAttribute('data-glitch');
  html().style.setProperty('--switch-out', '100'); // the theme draws its transition (jsdom loads no CSS)
  list.push({ id: 'halloween', name: 'Halloween', since: '2026-10-28', holiday: 'halloween' });
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  html().style.removeProperty('--switch-out');
  stop?.();
  stop = null;
  list.splice(
    list.findIndex((t) => t.id === 'halloween'),
    1,
  );
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('holiday themes on the device (SPO-321)', () => {
  it('opening the app inside the window starts on the holiday theme, and saves nothing', () => {
    at(2026, 10, 28);
    initTheme();
    expect(html().getAttribute('data-theme')).toBe('halloween');
    expect(getHolidayTheme()).toBe('halloween');
    expect(localStorage.getItem('gym.theme')).toBeNull();
  });

  it('outside the window the saved theme is on; a holiday without a theme does nothing', () => {
    at(2026, 10, 23);
    initTheme();
    expect(html().getAttribute('data-theme')).toBe('glass');
    expect(getHolidayTheme()).toBeNull();
    at(2026, 3, 15); // St Patrick's Day has no theme in the registry
    initTheme();
    expect(html().getAttribute('data-theme')).toBe('glass');
  });

  it('comes on a week before and goes back to the saved theme the day after, via the transition', () => {
    localStorage.setItem('gym.theme', 'cyberpunk');
    at(2026, 10, 23, 23);
    initTheme();
    stop = startHolidayWatch();
    expect(html().getAttribute('data-theme')).toBe('cyberpunk');
    // midnight: 24 October
    vi.advanceTimersByTime(3_601_050); // just past midnight (+1 s margin), inside the 100 ms 'out' phase
    expect(html().getAttribute('data-theme')).toBe('halloween');
    expect(html().getAttribute('data-glitch')).toBe('out'); // the app-switch animation plays
    // the day after the holiday
    at(2026, 11, 1, 0);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(html().getAttribute('data-theme')).toBe('cyberpunk');
    expect(getHolidayTheme()).toBeNull();
    expect(localStorage.getItem('gym.theme')).toBe('cyberpunk');
  });

  it('waits in a quiet zone and switches once the person has left', () => {
    at(2026, 10, 20);
    initTheme();
    stop = startHolidayWatch();
    window.history.replaceState(null, '', '/session/abc');
    at(2026, 10, 25);
    window.dispatchEvent(new Event('focus'));
    expect(html().getAttribute('data-theme')).toBe('glass');
    vi.advanceTimersByTime(3_100);
    expect(html().getAttribute('data-theme')).toBe('glass');
    window.history.replaceState(null, '', '/today');
    vi.advanceTimersByTime(3_100);
    expect(html().getAttribute('data-theme')).toBe('halloween');
  });

  it('does not cut a theme preview short; applies after it ends', () => {
    at(2026, 10, 20);
    initTheme();
    stop = startHolidayWatch();
    startPreview('cyberpunk');
    at(2026, 10, 25);
    window.dispatchEvent(new Event('focus'));
    expect(html().getAttribute('data-theme')).toBe('cyberpunk');
    endPreview(false, true);
    vi.advanceTimersByTime(3_100);
    expect(html().getAttribute('data-theme')).toBe('halloween');
  });

  it('a theme the person picks during the holiday is theirs: the holiday stays off this year', () => {
    at(2026, 10, 28);
    initTheme();
    setTheme('cyberpunk');
    expect(html().getAttribute('data-theme')).toBe('cyberpunk');
    expect(getHolidayTheme()).toBeNull();
    stop = startHolidayWatch();
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(10_000);
    expect(html().getAttribute('data-theme')).toBe('cyberpunk');
    initTheme(); // next launch, still the same holiday
    expect(html().getAttribute('data-theme')).toBe('cyberpunk');
    // the next year it comes back
    at(2027, 10, 28);
    initTheme();
    expect(html().getAttribute('data-theme')).toBe('halloween');
  });
});

describe('Christmas (SPO-393)', () => {
  it('is on from 18 December through 1 January and back to the saved theme on 2 January', () => {
    localStorage.clear();
    at(2026, 12, 17);
    initTheme();
    expect(getHolidayTheme()).toBeNull();
    for (const [m, d] of [
      [12, 18],
      [12, 25],
      [1, 1],
    ] as const) {
      at(m === 1 ? 2027 : 2026, m, d);
      initTheme();
      expect(getHolidayTheme()).toBe('christmas');
      expect(document.documentElement.getAttribute('data-theme')).toBe('christmas');
    }
    at(2027, 1, 2);
    initTheme();
    expect(getHolidayTheme()).toBeNull();
  });
});
