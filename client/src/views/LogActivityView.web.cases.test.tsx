import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, createEvent, fireEvent, screen, within } from '@testing-library/react';
import { pinsPref } from '../activityPrefs';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { setDesktop } from './__fixtures__/viewKit';
import {
  NOW,
  acts,
  at,
  click,
  history,
  lifted,
  live,
  put,
  resetSeq,
  view,
} from './__fixtures__/logActivityKit';

type DT = {
  setData: (k: string, v: string) => void;
  getData: (k: string) => string;
  dropEffect: string;
  effectAllowed: string;
};
const dt = (): DT => {
  const store: Record<string, string> = {};
  return {
    setData: (k, v) => void (store[k] = v),
    getData: (k) => store[k] ?? '',
    dropEffect: '',
    effectAllowed: '',
  };
};
/** jsdom has no layout: give each pinned card a box so the drop position can be worked out. */
function layOut(cards: HTMLElement[]) {
  cards.forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({
        left: i * 100,
        width: 100,
        right: i * 100 + 100,
        top: 0,
        bottom: 40,
        height: 40,
        x: i * 100,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  });
}
/** jsdom has no DragEvent, so the pointer position has to be put on the event by hand. */
function over(target: HTMLElement, data: DT, clientX: number) {
  const ev = createEvent.dragOver(target, { dataTransfer: data });
  Object.defineProperty(ev, 'clientX', { value: clientX });
  fireEvent(target, ev);
}
function leave(target: HTMLElement, related: HTMLElement | null) {
  const ev = createEvent.dragLeave(target);
  Object.defineProperty(ev, 'relatedTarget', { value: related });
  fireEvent(target, ev);
}
const pinCards = () => [...document.querySelectorAll<HTMLElement>('[data-pin]')];
const zone = () => document.querySelector('.la-pinzone') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  vi.setSystemTime(NOW);
  setLocale('en');
  setDesktop(true);
  localStorage.clear();
  pinsPref.reset();
  resetSeq();
  put(history());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Log activity (web): the hero and suggestions', () => {
  it('shows the likely activity with bars of recent lengths and the usual start in the footer', () => {
    view();
    expect(screen.getByText('Dance?')).toBeTruthy();
    expect(document.querySelector('.la-hero.web .la-wbars')).not.toBeNull();
    expect(document.querySelectorAll('.la-wbars .la-bl').length).toBeGreaterThan(0);
    expect(document.querySelector('.la-hero-actions span')?.textContent).toBeTruthy();
  });

  it('the side list has one-tap log buttons; a type logged today shows its time instead', () => {
    view();
    click(screen.getByLabelText(/^Log Sauna/));
    expect(acts().some((a) => a.type === 'sauna' && a.startedAt >= NOW - 30 * 60_000)).toBe(true);
    expect(screen.getByText(en.laDone)).toBeTruthy();
    expect(screen.getByText(/^Logged \d\d:\d\d$/)).toBeTruthy();
  });

  it('with nothing logged yet, starters are listed and can be pinned', () => {
    put([]);
    view();
    expect(screen.getByText(en.laPopular)).toBeTruthy();
    click(screen.getByLabelText(en.laPin('Walk')));
    expect(pinsPref.get()).toEqual(['walk']);
  });

  it('while an activity runs the side shows what usually follows, and the page offers the queue', () => {
    put([live(), ...history()]);
    view();
    expect(screen.getByText(en.laAfterUsually('Dance'))).toBeTruthy();
    expect(screen.queryByText('Dance?')).toBeNull();
    click(screen.getByText(/^Sauna · 20 min/).closest('button'));
    expect(screen.getByText(en.laQueued)).toBeTruthy();
  });
});

describe('Log activity (web): the pinned row', () => {
  beforeEach(() => pinsPref.set(['run', 'tennis', 'yoga']));

  it('lists each pinned type with when it was last done; a tap opens the panel; the pin toggle removes it', () => {
    view();
    expect(pinCards().map((c) => c.dataset.pin)).toEqual(['run', 'tennis', 'yoga']);
    expect(screen.getByLabelText(/^Run, pinned, last 5 km/)).toBeTruthy();
    expect(screen.getByLabelText(en.laPinnedAria('Yoga', ''))).toBeTruthy();
    expect(within(pinCards()[2]).getByText(en.laNotYet)).toBeTruthy();
    click(screen.getByLabelText(/^Run, pinned/));
    expect(screen.getByRole('complementary').getAttribute('aria-label')).toContain('Run');
    click(screen.getByLabelText(en.laUnpin('Tennis')));
    expect(pinsPref.get()).toEqual(['run', 'yoga']);
  });

  it('a live type shows its clock and a tap resumes it', () => {
    put([live('run'), ...history()]);
    const { shell } = view();
    expect(
      within(document.querySelector('[data-pin="run"]') as HTMLElement).getByText(
        en.laLive('42:00'),
      ),
    ).toBeTruthy();
    click(document.querySelector('[data-pin="run"] .la-pinb'));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'activity' });
  });

  it('dragging a card over the row shows where it would land; dropping reorders without a toast', () => {
    view();
    const cards = pinCards();
    layOut(cards);
    const data = dt();
    fireEvent.dragStart(cards[2], { dataTransfer: data });
    expect(data.getData('text/plain')).toBe('yoga');
    expect(cards[2].className).toContain('origin');
    layOut(pinCards().filter((c) => c.dataset.pin !== 'yoga'));
    over(zone(), data, 10);
    expect(data.dropEffect).toBe('move');
    expect(screen.getByText(en.laDropFirst)).toBeTruthy();
    expect(document.querySelector('.la-ins')).not.toBeNull();
    over(zone(), data, 120);
    expect(screen.getByText(en.laDropBetween('Run', 'Tennis'))).toBeTruthy();
    over(zone(), data, 500);
    expect(screen.getByText(en.laDropAfter('Tennis'))).toBeTruthy();
    fireEvent.drop(zone(), { dataTransfer: data });
    expect(pinsPref.get()).toEqual(['run', 'tennis', 'yoga']);
    over(zone(), data, 10);
    expect(screen.queryByText(en.laDropFirst)).toBeNull();
    expect(document.querySelector('.snack, .uisnack, [role="status"]')).toBeNull();
  });

  it('dropping a card at the front moves it there', () => {
    view();
    const cards = pinCards();
    layOut(cards);
    const data = dt();
    fireEvent.dragStart(cards[2], { dataTransfer: data });
    layOut(pinCards().filter((c) => c.dataset.pin !== 'yoga'));
    over(zone(), data, 10);
    fireEvent.drop(zone(), { dataTransfer: data });
    expect(pinsPref.get()).toEqual(['yoga', 'run', 'tennis']);
  });

  it('leaving the row clears the hint but moving between its children does not', () => {
    view();
    const cards = pinCards();
    layOut(cards);
    const data = dt();
    fireEvent.dragStart(cards[0], { dataTransfer: data });
    layOut(pinCards().filter((c) => c.dataset.pin !== 'run'));
    over(zone(), data, 10);
    expect(document.querySelector('.la-hint.drop')).not.toBeNull();
    leave(zone(), cards[1]);
    expect(document.querySelector('.la-hint.drop')).not.toBeNull();
    leave(zone(), null);
    expect(document.querySelector('.la-hint.drop')).toBeNull();
  });

  it('ending a drag outside the row cancels it', () => {
    view();
    const cards = pinCards();
    const data = dt();
    fireEvent.dragStart(cards[0], { dataTransfer: data });
    expect(zone().className).toContain('drop');
    fireEvent.dragEnd(cards[0]);
    expect(zone().className).not.toContain('drop');
  });

  it('dragging over the row when nothing is being dragged does nothing', () => {
    view();
    const data = dt();
    over(zone(), data, 10);
    expect(data.dropEffect).toBe('');
  });

  it('dragging a new type in pins it where it is dropped and Undo takes it back', () => {
    view();
    pinsPref.set(['tennis', 'yoga']);
    click(document.querySelector('.la-cexp-btn'));
    const tile = document.querySelector('.la-tile2') as HTMLElement;
    expect(tile.getAttribute('aria-label')).toBe(en.laQuickLogAria('Run'));
    const data = dt();
    fireEvent.dragStart(tile, { dataTransfer: data });
    expect(data.effectAllowed).toBe('copyMove');
    layOut(pinCards());
    over(zone(), data, 120);
    expect(data.dropEffect).toBe('copy');
    fireEvent.drop(zone(), { dataTransfer: data });
    expect(pinsPref.get()).toEqual(['tennis', 'run', 'yoga']);
    expect(screen.getByText(en.laPinnedToast('Run', 2))).toBeTruthy();
    click(screen.getByRole('button', { name: en.undo }));
    expect(pinsPref.get()).toEqual(['tennis', 'yoga']);
  });

  it('dropping something that is not an activity is ignored', () => {
    view();
    const data = dt();
    data.setData('text/plain', 'not-a-type');
    fireEvent.drop(zone(), { dataTransfer: data });
    fireEvent.drop(zone(), { dataTransfer: dt() });
    expect(pinsPref.get()).toEqual(['run', 'tennis', 'yoga']);
  });

  it('with an empty row the hint says "Drop to pin"', () => {
    pinsPref.set([]);
    view();
    const tileBtn = document.querySelector('.la-cexp-btn') as HTMLElement;
    click(tileBtn);
    const tile = document.querySelector('.la-tile2') as HTMLElement;
    const data = dt();
    fireEvent.dragStart(tile, { dataTransfer: data });
    over(zone(), data, 10);
    expect(screen.getAllByText(en.laDropToPin).length).toBeGreaterThan(0);
    fireEvent.dragEnd(tile);
  });
});

describe('Log activity (web): categories', () => {
  it('a category expands to its first types and collapses again', () => {
    view();
    const btn = document.querySelector('.la-cexp-btn') as HTMLElement;
    expect(btn.getAttribute('aria-label')).toBe(en.laShowTypes);
    click(btn);
    expect(btn.getAttribute('aria-label')).toBe(en.laHideTypes);
    expect(document.querySelectorAll('.la-cexp .la-tile2')).toHaveLength(6);
    click(btn);
    expect(document.querySelector('.la-tile2')).toBeNull();
  });

  it('the first tiles are the ones you did last; Enter or Space on a tile opens it; other keys do not', () => {
    view();
    click(document.querySelector('.la-cexp-btn'));
    const tile = document.querySelector('.la-tile2') as HTMLElement;
    expect(tile.getAttribute('aria-label')).toBe(en.laQuickLogAria('Run'));
    fireEvent.keyDown(tile, { key: 'a' });
    expect(screen.queryByRole('heading', { name: 'Run' })).toBeNull();
    fireEvent.keyDown(tile, { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Run' })).toBeTruthy();
    click(screen.getByLabelText(en.laCloseQuick));
    fireEvent.keyDown(tile, { key: ' ' });
    expect(screen.getByRole('heading', { name: 'Run' })).toBeTruthy();
  });

  it("a key pressed inside a tile's pin button is not taken as opening the tile", () => {
    view();
    click(document.querySelector('.la-cexp-btn'));
    const pinBtn = document.querySelector('.la-tile2 .la-pint') as HTMLElement;
    fireEvent.keyDown(pinBtn, { key: 'Enter' });
    expect(screen.queryByRole('heading', { name: 'Run' })).toBeNull();
  });

  it('a tile pins and unpins from its own button; "All …" opens the category page', () => {
    const { shell } = view();
    click(document.querySelector('.la-cexp-btn'));
    click(screen.getByLabelText(en.laPin('Run')));
    expect(pinsPref.get()).toEqual(['run']);
    expect(screen.getByLabelText(en.laUnpin('Run'), { selector: '.la-tile2 *' })).toBeTruthy();
    click(screen.getByText(/^All \d+ conditioning ›$/));
    expect(shell.calls.replaceOverlay).toHaveBeenCalledWith({
      screen: 'log-activity',
      cat: 'conditioning',
    });
  });

  it('the row of the type being logged says "Open in quick log"', () => {
    view();
    click(document.querySelector('.la-cexp-btn'));
    click(document.querySelector('.la-tile2'));
    expect(screen.getByText(en.laOpenInQuick('Run'))).toBeTruthy();
  });
});

describe('Log activity (web): the panel and today', () => {
  it("empty: invites to pick, lists today's lifting and activities, and shows the load", () => {
    put(
      [
        ...history(),
        at(2025, 9, 27, 9, 0, 'run', 30, { distanceKm: 5.4 }),
        at(2025, 9, 27, 7, 0, 'sauna', 20),
      ],
      {
        workouts: [lifted('lw')],
      },
    );
    const { shell } = view();
    expect(screen.getByText(en.laPickAnActivity)).toBeTruthy();
    expect(screen.getByText(en.laGymRow('Push'))).toBeTruthy();
    expect(screen.getByText(en.laEntries(110, 3))).toBeTruthy();
    expect(screen.getByText(`30 min · 5.4 ${en.laKm}`)).toBeTruthy();
    expect(document.querySelector('.la-loadbar div')).not.toBeNull();
    expect(screen.getByText(en.laLoadHintBalanced)).toBeTruthy();
    click(screen.getByText(en.actType.run, { selector: '.uirow-l, .uirow-l *' }));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'activity' }),
    );
  });

  it('load hints: a light day invites more; a day with only effort mentions recovery', () => {
    put(history());
    view();
    expect(screen.getByText(en.laLoadHintLight)).toBeTruthy();
    cleanup();
    put([...history(), at(2025, 9, 27, 9, 0, 'run', 120, { effort: 'hard' })]);
    view();
    expect(screen.getByText(en.laLoadHintRec)).toBeTruthy();
    expect(screen.getByText(en.laLoadLevel.high)).toBeTruthy();
  });

  it('a note under a sport shows under its own name', () => {
    put([...history(), at(2025, 9, 27, 9, 0, 'sport', 45, { note: 'Underwater hockey' })]);
    view();
    expect(screen.getByText('Underwater hockey')).toBeTruthy();
  });

  it('logging shows the entry in the list as "Just now"', () => {
    view();
    click(screen.getByText('Log 2 h'));
    expect(screen.getByText(en.laJustNow)).toBeTruthy();
    expect(screen.getByText(/^Dance · 120 min logged/)).toBeTruthy();
  });

  it('a lock bar and the live banner sit above the page while something runs', () => {
    put([live(), ...history()]);
    view();
    expect(document.querySelector('.la-lockbar')).not.toBeNull();
    click(screen.getByText(en.actFinish));
    expect(acts().find((a) => a.id === 'live')?.finishedAt).not.toBeNull();
  });

  it('searching shows the results where the page was, and the search box carries the type count', () => {
    view();
    expect(screen.getByPlaceholderText(en.laSearch)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(en.laSearch), { target: { value: 'yoga' } });
    const row = screen.getByLabelText(/^Yoga, /);
    drag(row);
    click(row);
    expect(screen.getByRole('complementary').getAttribute('aria-label')).toContain('Yoga');
  });
});

function drag(row: HTMLElement) {
  const data = dt();
  fireEvent.dragStart(row, { dataTransfer: data });
  expect(data.getData('text/plain')).toBe('yoga');
  fireEvent.dragEnd(row);
}
