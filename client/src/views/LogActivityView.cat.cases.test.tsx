import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { pinsPref } from '../activityPrefs';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { setDesktop } from './__fixtures__/viewKit';
import {
  MIN,
  NOW,
  acts,
  at,
  click,
  history,
  put,
  resetSeq,
  tick,
  view,
} from './__fixtures__/logActivityKit';

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  vi.setSystemTime(NOW);
  setLocale('en');
  setDesktop(false);
  localStorage.clear();
  pinsPref.reset();
  resetSeq();
  put(history());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const searchIn = (v: string) =>
  fireEvent.change(screen.getByPlaceholderText(en.laSearchIn.sport), { target: { value: v } });

describe('category page (mobile)', () => {
  it('lists the recent ones, then every type with the pinned first; "Other sport" is always last and says to name it', () => {
    pinsPref.set(['padel']);
    view({ cat: 'sport' });
    expect(screen.getByText(en.laRecentIn(en.actSports))).toBeTruthy();
    const tiles = [...document.querySelectorAll('.la-grid .la-tn')].map((n) => n.textContent);
    expect(tiles[0]).toBe('Padel');
    expect(tiles[tiles.length - 1]).toBe(en.actType.sport);
    expect(screen.getByText(en.laNameIt)).toBeTruthy();
    expect(document.querySelectorAll('.la-pcard.wide').length).toBeGreaterThan(0);
  });

  it('a pinned "Other sport" moves up with the other pinned ones', () => {
    pinsPref.set(['sport', 'padel']);
    view({ cat: 'sport' });
    const tiles = [...document.querySelectorAll('.la-grid .la-tn')].map((n) => n.textContent);
    expect(tiles.slice(0, 2)).toEqual([en.actType.sport, 'Padel']);
  });

  it('with no history there is no "recent" row', () => {
    put([]);
    view({ cat: 'recovery' });
    expect(screen.queryByText(en.laRecentIn(en.actRecovery))).toBeNull();
    expect(screen.getAllByText(en.laNotYet).length).toBeGreaterThan(0);
  });

  it('searching narrows the grid and hides the recent row; clearing restores it', () => {
    view({ cat: 'sport' });
    searchIn('tenn');
    expect(screen.queryByText(en.laRecentIn(en.actSports))).toBeNull();
    const names = [...document.querySelectorAll('.la-grid .la-tn')].map((n) => n.textContent);
    expect(names).toContain('Tennis');
    expect(names).not.toContain('Padel');
    fireEvent.click(screen.getByLabelText(en.laClearSearch));
    expect(screen.getByText(en.laRecentIn(en.actSports))).toBeTruthy();
  });

  it('a tile opens the quick log in a sheet; logging closes it and announces it', () => {
    view({ cat: 'sport' });
    click(screen.getAllByLabelText(/^Tennis, 60 min/)[0]);
    expect(screen.getByRole('heading', { name: 'Tennis' })).toBeTruthy();
    click(screen.getByRole('button', { name: /^Log it/ }));
    expect(acts().some((a) => a.type === 'tennis' && a.startedAt === NOW - 60 * MIN)).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Tennis' })).toBeNull();
    expect(screen.getByText(/^Tennis · 60 min logged/)).toBeTruthy();
  });

  it('a pin button toggles the pin; the tile shows it is pinned', () => {
    view({ cat: 'sport' });
    click(screen.getByLabelText(en.laPin('Padel')));
    expect(pinsPref.get()).toEqual(['padel']);
    expect(document.querySelector('.la-tile.on')).not.toBeNull();
    click(screen.getByLabelText(en.laUnpin('Padel')));
    expect(pinsPref.get()).toEqual([]);
  });

  it('holding a tile pins it without opening the quick log', () => {
    view({ cat: 'sport' });
    const tile = screen.getByLabelText('Padel');
    fireEvent.pointerDown(tile);
    tick(600);
    fireEvent.pointerUp(tile);
    click(tile);
    expect(pinsPref.get()).toEqual(['padel']);
    expect(screen.queryByRole('heading', { name: 'Padel' })).toBeNull();
  });

  it('the back button returns to the main page', () => {
    const { shell } = view({ cat: 'recovery' });
    click(screen.getByLabelText(en.laBackToLog));
    expect(shell.calls.replaceOverlay).toHaveBeenCalledWith({ screen: 'log-activity' });
  });

  it('starting a timer from the sheet moves to the activity page', () => {
    const { shell } = view({ cat: 'conditioning' });
    click(screen.getAllByLabelText(/^Run, 30 min/)[0]);
    click(screen.getByRole('button', { name: en.laStartTimer }));
    expect(shell.calls.replaceOverlay).toHaveBeenCalledWith({ screen: 'activity' });
  });
});

describe('category page (web)', () => {
  beforeEach(() => setDesktop(true));

  it('puts what you use first (pinned, then recent) and the rest A–Z with "Other sport" last', () => {
    pinsPref.set(['padel']);
    view({ cat: 'sport' });
    expect(screen.getByText(en.laYourFirst.sport)).toBeTruthy();
    expect(screen.getByText(en.laAllAZ.sport)).toBeTruthy();
    const grids = document.querySelectorAll('.la-grid.five');
    const first = [...grids[0].querySelectorAll('.la-tn')].map((n) => n.textContent);
    expect(first[0]).toBe('Padel');
    expect(first).toContain('Tennis');
    const rest = [...grids[1].querySelectorAll('.la-tn')].map((n) => n.textContent);
    expect(rest[rest.length - 1]).toBe(en.actType.sport);
    expect(rest).not.toContain('Tennis');
  });

  it('says what was last logged in the category, in weeks when it is old', () => {
    view({ cat: 'sport' });
    expect(document.querySelector('.la-muted13')?.textContent).toContain('Tennis');
    cleanup();
    put([at(2025, 8, 1, 18, 0, 'tennis', 60)]);
    view({ cat: 'sport' });
    expect(document.querySelector('.la-muted13')?.textContent).toContain(en.laWeeksAgo(8));
  });

  it('two weeks is the point where the category line switches from a date to "wk ago"', () => {
    put([at(2025, 9, 13, 18, 0, 'tennis', 60)]);
    view({ cat: 'sport' });
    expect(document.querySelector('.la-muted13')?.textContent).toContain(en.laWeeksAgo(2));
    cleanup();
    put([at(2025, 9, 20, 18, 0, 'tennis', 60)]);
    view({ cat: 'sport' });
    expect(document.querySelector('.la-muted13')?.textContent).not.toContain('wk ago');
  });

  it('searching lists the matches under one heading and no "rest" block', () => {
    view({ cat: 'sport' });
    searchIn('tenn');
    expect(screen.getByText(en.laMatches(2))).toBeTruthy();
    expect(screen.queryByText(en.laAllAZ.sport)).toBeNull();
  });

  it('with no history nothing is "yours" yet', () => {
    put([]);
    view({ cat: 'sport' });
    expect(screen.queryByText(en.laYourFirst.sport)).toBeNull();
    expect(screen.getByText(en.laAllAZ.sport)).toBeTruthy();
  });

  it('pinning shows where it landed and Undo puts it back; unpinning says so', () => {
    pinsPref.set(['padel']);
    view({ cat: 'sport' });
    click(screen.getByLabelText(en.laPin('Tennis')));
    const bar = screen.getByRole('status');
    expect(bar.textContent).toContain(
      en.laPinnedToast('Tennis', pinsPref.get().indexOf('tennis') + 1),
    );
    click(within(bar).getByText(en.undo));
    expect(pinsPref.get()).toEqual(['padel']);
    expect(screen.queryByRole('status')).toBeNull();
    click(screen.getByLabelText(en.laUnpin('Padel')));
    expect(screen.getByRole('status').textContent).toContain(en.laUnpinnedToast('Padel'));
    tick(5100);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it("the quick log opens beside the grid with today's total, and the list can be shown and hidden", () => {
    put([...history(), at(2025, 9, 27, 9, 0, 'run', 30)]);
    view({ cat: 'sport' });
    click(screen.getByLabelText(/^Tennis, 60 min/));
    const panel = screen.getByRole('complementary');
    expect(panel.getAttribute('aria-label')).toBe(`${en.laQuickLog} · Tennis`);
    expect(panel.textContent).toContain(en.laLoggedSum(1, 30));
    expect(screen.queryByText(en.laGymRow('x'), { exact: false })).toBeNull();
    click(screen.getByText(`${en.laShow} ›`));
    expect(screen.getByText(en.actType.run)).toBeTruthy();
    click(screen.getByText(`${en.laHideList} ›`));
    expect(screen.queryByText(en.actType.run)).toBeNull();
  });

  it("the panel's close button empties it again", () => {
    view({ cat: 'sport' });
    click(screen.getByLabelText(/^Tennis, 60 min/));
    click(screen.getByLabelText(en.laCloseQuick));
    expect(screen.getByText(en.laPickAnActivity)).toBeTruthy();
  });

  it('both back buttons work: one leaves the page, the other returns to the categories', () => {
    const { onClose, shell } = view({ cat: 'sport' });
    click(screen.getByLabelText(en.backAction));
    expect(onClose).toHaveBeenCalledTimes(1);
    click(screen.getByLabelText(en.laBackToCats));
    expect(shell.calls.replaceOverlay).toHaveBeenCalledWith({ screen: 'log-activity' });
  });

  it('a day older than a week in the category row reads as a date, not a weekday', () => {
    put([at(2025, 9, 10, 18, 0, 'tennis', 60)]);
    view({ cat: 'sport' });
    expect(document.querySelector('.la-muted13')?.textContent).toMatch(/Tennis · .*\d/);
  });
});
