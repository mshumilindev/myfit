import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeDef } from './registry';
import { initTheme } from './registry';
import {
  THEMES_SEEN_FIELD,
  getUnseenThemes,
  isSeenReady,
  markAllThemesSeen,
  markThemesSeen,
  resetSeenForTest,
  syncSeenFromDoc,
  unseenThemes,
} from './seen';

const LIST: ThemeDef[] = [
  { id: 'glass', name: 'Brass Glass', since: '2026-10-01' },
  { id: 'cyberpunk', name: 'Cyberpunk', since: '2026-10-24' },
  { id: 'xmas', name: 'Xmas', since: '2026-12-01', pickable: false },
  { id: 'third', name: 'Third', since: '2026-11-01' },
];

beforeEach(() => {
  localStorage.clear();
  resetSeenForTest();
  initTheme();
});

describe('unseenThemes', () => {
  it('nothing seen: every pickable theme except the one worn is new', () => {
    expect(unseenThemes([], 'glass', LIST).map((t) => t.id)).toEqual(['cyberpunk', 'third']);
  });
  it('holiday (not pickable) themes are never new', () => {
    expect(unseenThemes([], 'glass', LIST).some((t) => t.id === 'xmas')).toBe(false);
  });
  it('seen themes drop out; a later theme is new again', () => {
    expect(unseenThemes(['cyberpunk'], 'glass', LIST).map((t) => t.id)).toEqual(['third']);
    expect(unseenThemes(['cyberpunk', 'third'], 'glass', LIST)).toEqual([]);
  });
  it('the worn theme is not new; an unknown seen id is harmless', () => {
    expect(unseenThemes(['ghost', 'glass'], 'cyberpunk', LIST).map((t) => t.id)).toEqual(['third']);
  });
});

describe('themesSeen sync', () => {
  it('is not ready before the account document is read', () => {
    expect(isSeenReady()).toBe(false);
    syncSeenFromDoc({}, vi.fn());
    expect(isSeenReady()).toBe(true);
  });

  it('merges the account list with the local one and writes back only what the account lacks', () => {
    const write = vi.fn();
    markThemesSeen(['a']); // local only (no writer bound yet)
    syncSeenFromDoc({ [THEMES_SEEN_FIELD]: ['b'] }, write);
    expect(write).toHaveBeenCalledWith({ [THEMES_SEEN_FIELD]: ['b', 'a'] });
    write.mockClear();
    syncSeenFromDoc({ [THEMES_SEEN_FIELD]: ['a', 'b'] }, write);
    expect(write).not.toHaveBeenCalled();
  });

  it('ignores a malformed field', () => {
    const write = vi.fn();
    syncSeenFromDoc({ [THEMES_SEEN_FIELD]: 'oops' }, write);
    expect(write).not.toHaveBeenCalled();
  });

  it('marking writes the whole list once and is idempotent', () => {
    const write = vi.fn();
    markThemesSeen(['cyberpunk'], write);
    markThemesSeen(['cyberpunk'], write);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ [THEMES_SEEN_FIELD]: ['cyberpunk'] });
    expect(JSON.parse(localStorage.getItem('gym.themesSeen') ?? '[]')).toEqual(['cyberpunk']);
  });

  it('markAllThemesSeen leaves no new theme for the current registry', () => {
    syncSeenFromDoc({}, vi.fn());
    expect(getUnseenThemes().length).toBeGreaterThan(0); // cyberpunk is new for a glass user
    markAllThemesSeen();
    expect(getUnseenThemes()).toEqual([]);
  });
});

describe('the worn theme counts as seen', () => {
  it('arriving on a theme (a pick, or the account’s) marks it seen without announcing it', async () => {
    const { setTheme, applyRemoteTheme } = await import('./registry');
    syncSeenFromDoc({}, vi.fn());
    setTheme('cyberpunk');
    expect(JSON.parse(localStorage.getItem('gym.themesSeen') ?? '[]')).toContain('cyberpunk');
    expect(getUnseenThemes().map((t) => t.id)).not.toContain('cyberpunk');
    applyRemoteTheme('glass');
    expect(JSON.parse(localStorage.getItem('gym.themesSeen') ?? '[]')).toContain('glass');
  });

  it('a first sync on a device already wearing a new theme offers nothing and writes nothing', () => {
    document.documentElement.setAttribute('data-theme', 'cyberpunk');
    const write = vi.fn();
    syncSeenFromDoc({}, write);
    expect(write).not.toHaveBeenCalled(); // nothing the account lacks that we decided: no write just for this
    expect(getUnseenThemes().map((t) => t.id)).toEqual(['glass']);
  });
});

describe('moving off an unannounced theme', () => {
  it('the theme that was worn without being announced is recorded when the person leaves it', async () => {
    const { setTheme } = await import('./registry');
    document.documentElement.setAttribute('data-theme', 'cyberpunk');
    syncSeenFromDoc({}, vi.fn());
    setTheme('glass');
    const stored = JSON.parse(localStorage.getItem('gym.themesSeen') ?? '[]') as string[];
    expect(stored).toEqual(expect.arrayContaining(['cyberpunk', 'glass']));
    expect(getUnseenThemes()).toEqual([]);
  });
});
