import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyRemoteTheme,
  endPreview,
  getCommittedTheme,
  getPreview,
  initTheme,
  onThemeChoice,
  startPreview,
} from './registry';
import { offSeason } from './testClock';

offSeason();

const attr = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
  localStorage.clear();
  initTheme();
});

describe('theme preview (SPO-355)', () => {
  it('wears the theme on <html> without saving or announcing a choice', () => {
    const chosen: string[] = [];
    const off = onThemeChoice((id) => chosen.push(id));
    startPreview('cyberpunk');
    expect(attr()).toBe('cyberpunk');
    expect(getPreview()).toBe('cyberpunk');
    expect(getCommittedTheme()).toBe('glass');
    expect(localStorage.getItem('gym.theme')).toBeNull();
    expect(chosen).toEqual([]);
    off();
  });

  it('Keep current goes back to the saved theme and saves nothing', () => {
    startPreview('cyberpunk');
    endPreview(false);
    expect(attr()).toBe('glass');
    expect(getPreview()).toBeNull();
    expect(localStorage.getItem('gym.theme')).toBeNull();
  });

  it('Use saves the previewed theme as the user’s choice', () => {
    const chosen: string[] = [];
    const off = onThemeChoice((id) => chosen.push(id));
    startPreview('cyberpunk');
    endPreview(true);
    expect(attr()).toBe('cyberpunk');
    expect(getCommittedTheme()).toBe('cyberpunk');
    expect(localStorage.getItem('gym.theme')).toBe('cyberpunk');
    expect(chosen).toEqual(['cyberpunk']);
    expect(getPreview()).toBeNull();
    off();
  });

  it('an unknown id is ignored, a reload starts from the saved theme', () => {
    startPreview('nope');
    expect(getPreview()).toBeNull();
    startPreview('cyberpunk');
    initTheme();
    expect(attr()).toBe('glass');
    expect(getPreview()).toBeNull();
  });

  it('a theme arriving from another device does not pull the preview away', () => {
    startPreview('cyberpunk');
    applyRemoteTheme('glass');
    expect(attr()).toBe('cyberpunk');
    expect(getCommittedTheme()).toBe('glass');
    endPreview(false);
    expect(attr()).toBe('glass');
  });

  it('endPreview with no preview does nothing', () => {
    endPreview(true);
    expect(attr()).toBe('glass');
    expect(localStorage.getItem('gym.theme')).toBeNull();
  });
});

describe('theme change transition (SPO-355)', () => {
  const root = document.documentElement;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    root.style.setProperty('--switch-out', '100');
    root.style.setProperty('--switch-tail', '200');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    root.style.removeProperty('--switch-out');
    root.style.removeProperty('--switch-tail');
    delete root.dataset.glitch;
  });

  it('a preview start runs the app-switch transition, already on the NEW theme', () => {
    startPreview('cyberpunk');
    expect(attr()).toBe('cyberpunk'); // the theme is on <html> first, so the phases are its own
    expect(root.dataset.glitch).toBe('out');
    vi.advanceTimersByTime(100);
    expect(root.dataset.glitch).toBe('in');
    vi.advanceTimersByTime(200);
    expect(root.dataset.glitch).toBeUndefined();
  });

  it('Keep current goes back with the transition of the theme it returns to', () => {
    startPreview('cyberpunk');
    vi.advanceTimersByTime(400);
    endPreview(false);
    expect(attr()).toBe('glass');
    expect(root.dataset.glitch).toBe('out');
  });

  it('a preview cut short (workout, document, chat) puts the look back without a show', () => {
    startPreview('cyberpunk');
    vi.advanceTimersByTime(400);
    endPreview(false, true);
    expect(attr()).toBe('glass');
    expect(root.dataset.glitch).toBeUndefined();
  });

  it('a theme that arrives by itself (another device, a holiday theme) plays the transition too', () => {
    applyRemoteTheme('cyberpunk');
    expect(attr()).toBe('cyberpunk');
    expect(root.dataset.glitch).toBe('out');
  });

  it('the first paint (initTheme) is never animated', () => {
    localStorage.setItem('gym.theme', 'cyberpunk');
    initTheme();
    expect(attr()).toBe('cyberpunk');
    expect(root.dataset.glitch).toBeUndefined();
  });

  it('Use after a preview does not play the transition a second time', () => {
    startPreview('cyberpunk');
    vi.advanceTimersByTime(400);
    endPreview(true);
    expect(root.dataset.glitch).toBeUndefined();
  });
});
