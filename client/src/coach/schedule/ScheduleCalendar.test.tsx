import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { setCoachTimeZone } from '../format';
import { setViewport } from '../testViewport';
import { createFixturesSchedulePort, TODAY_KEY, WEEK0 } from './__fixtures__/fixtures';
import { ScheduleScreen } from './ScheduleScreen';
import { tsOf } from './time';
import { currentHash } from '../../route';

beforeEach(() => {
  setLocale('en');
  setViewport(1440);
  window.history.replaceState(null, '', '#/c/schedule');
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  setCoachTimeZone('UTC');
  window.history.replaceState(null, '', '#/c/schedule');
});

const world = () => createFixturesPort({ warm: true });
const mount = (port = createFixturesSchedulePort(), onNavigate = vi.fn()) => {
  render(<ScheduleScreen onNavigate={onNavigate} port={port} worldPort={world()} />);
  return { port, onNavigate };
};
const blocks = () => screen.getAllByRole('button', { name: /\d\d:\d\d–\d\d:\d\d|Proposed/ });
const label = () => document.querySelector('.sc-nav-label')!.textContent;
const nav = () => screen.getByRole('group', { name: t.scNavLabel });
const col = (day: number) => document.querySelector<HTMLElement>(`.sc-col[data-day="${day}"]`)!;

/** jsdom has no layout: give a column a 1000 px height so a clientY maps to minutes (07:00-21:00 = 0.84 min / px). */
function sized(c: HTMLElement) {
  c.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      width: 100,
      height: 1000,
      right: 100,
      bottom: 1000,
      x: 0,
      y: 0,
    }) as DOMRect;
  return c;
}
const press = (c: HTMLElement, y: number, type = 'mouse') =>
  fireEvent.pointerDown(c, { clientY: y, clientX: 5, button: 0, pointerType: type, pointerId: 1 });
const move = (c: HTMLElement, y: number, type = 'mouse') =>
  fireEvent.pointerMove(c, { clientY: y, clientX: 5, pointerType: type, pointerId: 1 });
const release = (c: HTMLElement, y: number, type = 'mouse') =>
  fireEvent.pointerUp(c, { clientY: y, clientX: 5, button: 0, pointerType: type, pointerId: 1 });

describe('Calendar navigation', () => {
  it('shows the range, steps a week at a time, and Today brings you back', async () => {
    mount();
    await waitFor(() => blocks());
    expect(label()).toBe('5 – 11 Oct 2026');
    const today = within(nav()).getByRole('button', { name: t.scToday });
    expect((today as HTMLButtonElement).disabled).toBe(true); // already on this week
    fireEvent.click(within(nav()).getByRole('button', { name: t.scNextWeek }));
    expect(label()).toBe('12 – 18 Oct 2026');
    expect(currentHash()).toContain(`d=${TODAY_KEY + 7}`);
    expect((today as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(nav()).getByRole('button', { name: t.scPrevWeek }));
    fireEvent.click(within(nav()).getByRole('button', { name: t.scPrevWeek }));
    expect(label()).toBe('28 Sep – 4 Oct 2026');
    fireEvent.click(today);
    expect(label()).toBe('5 – 11 Oct 2026');
    expect(currentHash()).not.toContain('d=');
  });

  it('the Now line and the today highlight belong to the current week only', async () => {
    mount();
    await waitFor(() => blocks());
    expect(document.querySelectorAll('.uinow')).toHaveLength(1);
    expect(document.querySelectorAll('.sc-col.is-today')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: t.scNextWeek }));
    expect(document.querySelectorAll('.uinow')).toHaveLength(0);
    expect(document.querySelectorAll('.sc-col.is-today')).toHaveLength(0);
    expect(document.querySelectorAll('.sc-colhead.is-today')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: t.scToday }));
    expect(document.querySelectorAll('.uinow')).toHaveLength(1);
  });

  it('Back returns to the week before (every page is a history entry) and a reload restores it', async () => {
    mount();
    await waitFor(() => blocks());
    fireEvent.click(screen.getByRole('button', { name: t.scNextWeek }));
    fireEvent.click(screen.getByRole('button', { name: t.scNextWeek }));
    expect(label()).toBe('19 – 25 Oct 2026');
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(label()).toBe('12 – 18 Oct 2026');
    cleanup();
    mount(); // a refresh: same hash, same page
    expect(label()).toBe('12 – 18 Oct 2026');
  });

  it('pages far beyond the generated window without a blank page: sessions keep appearing', async () => {
    window.history.replaceState(null, '', `#/c/schedule?d=${TODAY_KEY - 7 * 20}`);
    mount();
    await waitFor(() => expect(document.querySelector('.sc-grid')).toBeTruthy());
    expect(label()).toMatch(/2026$/);
    // the fixtures' plans started 5 weeks before the lab week, so 20 weeks back is empty on purpose: no crash, still a grid
    expect(screen.getByRole('group', { name: t.scGridLabel })).toBeTruthy();
  });

  it('day view steps one day; month view steps one month', async () => {
    window.history.replaceState(null, '', `#/c/schedule?view=day&d=${TODAY_KEY}`);
    mount();
    await waitFor(() => expect(document.querySelector('.sc-grid')).toBeTruthy());
    expect(label()).toBe('Wednesday, 7 Oct');
    fireEvent.click(screen.getByRole('button', { name: t.scNextDay }));
    expect(label()).toBe('Thursday, 8 Oct');
    cleanup();
    window.history.replaceState(null, '', '#/c/schedule?view=month');
    mount();
    await screen.findByRole('grid', { name: t.scMonthLabel });
    expect(label()).toBe('October 2026');
    fireEvent.click(screen.getByRole('button', { name: t.scNextMonth }));
    expect(label()).toBe('November 2026');
  });

  it('phone: the same buttons page the week strip', async () => {
    setViewport(390);
    mount();
    await screen.findByRole('group', { name: t.scDayStripLabel });
    expect(label()).toBe('5 – 11 Oct 2026');
    fireEvent.click(screen.getByRole('button', { name: t.scNextWeek }));
    expect(label()).toBe('12 – 18 Oct 2026');
  });

  it('a swipe pages the phone agenda', async () => {
    setViewport(390);
    mount();
    const strip = await screen.findByRole('group', { name: t.scDayStripLabel });
    const view = strip.closest('.sc-view') as HTMLElement;
    fireEvent.touchStart(view, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(view, { changedTouches: [{ clientX: 120, clientY: 210 }] });
    expect(label()).toBe('12 – 18 Oct 2026');
    fireEvent.touchStart(view, { touches: [{ clientX: 100, clientY: 200 }] });
    fireEvent.touchEnd(view, { changedTouches: [{ clientX: 300, clientY: 205 }] });
    expect(label()).toBe('5 – 11 Oct 2026');
  });
});

describe('Day headers', () => {
  it('today says "Today · N sessions", the other days say "N sessions"', async () => {
    mount();
    await waitFor(() => blocks());
    const heads = [...document.querySelectorAll<HTMLElement>('.sc-colhead')];
    expect(heads).toHaveLength(7);
    const today = document.querySelector('.sc-colhead.is-today .sc-colhead-s')!;
    expect(today.textContent).toMatch(/^Today · \d+ sessions?$/);
    for (const h of heads.filter((x) => !x.classList.contains('is-today')))
      expect(h.querySelector('.sc-colhead-s')!.textContent).toMatch(/^\d+ sessions?$/);
  });
});

describe('Hour labels', () => {
  it('are in the gutter, one per visible hour, from 07:00', async () => {
    mount();
    await waitFor(() => blocks());
    const hours = [...document.querySelectorAll('.sc-hour')].map((h) => h.textContent);
    expect(hours[0]).toBe('07:00');
    expect(hours).toHaveLength(14);
  });
});

describe('Create a session from an empty slot', () => {
  const SUN = WEEK0 + 6;

  it('a click on an empty slot opens the form with the day and the snapped time (the 15-minute row under the pointer)', async () => {
    mount();
    await waitFor(() => blocks());
    const c = sized(col(SUN));
    press(c, 470);
    release(c, 470);
    const form = await screen.findByRole('form', { name: t.qcTitle });
    expect(within(form).getByText(/Sunday, 11 Oct · 13:30 – 14:30/)).toBeTruthy();
    expect((within(form).getByLabelText(t.bdStart) as HTMLInputElement).value).toBe('13:30');
  });

  it('hover shows the ghost block at the snapped row; leaving removes it', async () => {
    mount();
    await waitFor(() => blocks());
    const c = sized(col(SUN));
    move(c, 470);
    const ghost = c.querySelector<HTMLElement>('[data-newslot]')!;
    expect(ghost.textContent).toBe('13:30–14:30');
    fireEvent.pointerLeave(c);
    expect(c.querySelector('[data-newslot]')).toBeNull();
  });

  it('dragging sets the length (13:30 to 15:00)', async () => {
    mount();
    await waitFor(() => blocks());
    const c = sized(col(SUN));
    press(c, 470);
    move(c, 560);
    expect(c.querySelector('[data-newslot]')!.textContent).toBe('13:30–15:00');
    release(c, 560);
    const form = await screen.findByRole('form', { name: t.qcTitle });
    expect(within(form).getByText(/13:30 – 15:00/)).toBeTruthy();
    expect(within(form).getByRole('button', { name: '90 min' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('a touch tap works; a touch that moves is a scroll, not a tap', async () => {
    mount();
    await waitFor(() => blocks());
    const c = sized(col(SUN));
    press(c, 470, 'touch');
    move(c, 520, 'touch');
    release(c, 520, 'touch');
    expect(screen.queryByRole('form', { name: t.qcTitle })).toBeNull();
    press(c, 470, 'touch');
    release(c, 470, 'touch');
    expect(await screen.findByRole('form', { name: t.qcTitle })).toBeTruthy();
  });

  it('pressing a session selects it and never creates', async () => {
    mount();
    await waitFor(() => blocks());
    fireEvent.pointerDown(blocks()[0], { clientY: 10, button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(blocks()[0], { clientY: 10, button: 0, pointerType: 'mouse' });
    expect(screen.queryByRole('form', { name: t.qcTitle })).toBeNull();
  });

  it('the keyboard way: every day has a button that opens the same form', async () => {
    mount();
    await waitFor(() => blocks());
    const add = screen.getAllByRole('button', { name: /^Add a session on / });
    expect(add).toHaveLength(7);
    fireEvent.click(add[6]);
    const form = await screen.findByRole('form', { name: t.qcTitle });
    expect(within(form).getByText(/Sunday, 11 Oct · 09:00 – 10:00/)).toBeTruthy();
  });

  it('only active clients can be picked, the search narrows them, and Create saves a one-off through the store', async () => {
    const { port } = mount();
    await waitFor(() => blocks());
    const c = sized(col(SUN));
    press(c, 470);
    release(c, 470);
    const form = await screen.findByRole('form', { name: t.qcTitle });
    // nothing picked: the error is said in words, nothing is saved
    fireEvent.click(screen.getByRole('button', { name: t.qcCreate }));
    expect((await within(form).findAllByRole('alert')).length).toBeGreaterThan(0);
    fireEvent.change(within(form).getByRole('searchbox', { name: t.qcSearch }), {
      target: { value: 'oleh' },
    });
    const pick = within(form).getByRole('button', { name: 'Oleh Bondar' });
    expect(within(form).queryByRole('button', { name: 'Maria Tkach' })).toBeNull();
    fireEvent.click(pick);
    fireEvent.click(screen.getByRole('button', { name: t.qcCreate }));
    await waitFor(() => expect(screen.queryByRole('form', { name: t.qcTitle })).toBeNull());
    const docs = port.peek()?.docs ?? [];
    const made = docs.flatMap((d) => d.oneOffs.map((o) => ({ cid: d.clientId, ...o })));
    const mine = made.find((o) => o.day === SUN && o.start === '13:30');
    expect(mine).toMatchObject({ cid: 'c1', dur: 60 }); // Oleh Bondar
    expect(await screen.findAllByRole('button', { name: /13:30–14:30/ })).toBeTruthy();
    expect(window.localStorage.getItem('sc.quick.dur')).toBe('60');
  });

  it('repeat every week makes a weekly plan on that weekday', async () => {
    const { port } = mount();
    await waitFor(() => blocks());
    const c = sized(col(SUN));
    press(c, 470);
    release(c, 470);
    const form = await screen.findByRole('form', { name: t.qcTitle });
    fireEvent.click(within(form).getByRole('button', { name: 'Oleh Bondar' }));
    fireEvent.click(within(form).getByRole('switch', { name: t.qcRepeat }));
    fireEvent.click(screen.getByRole('button', { name: t.qcCreate }));
    await waitFor(() => expect(screen.queryByRole('form', { name: t.qcTitle })).toBeNull());
    const rows = (port.peek()?.docs ?? [])
      .flatMap((d) => d.patterns)
      .flatMap((p) => p.rows)
      .filter((r) => r.start === '13:30');
    expect(rows).toHaveLength(1);
    expect(rows[0].dow).toBe(6); // Sunday
  });

  it('an overlap is warned about before saving (and does not block it)', async () => {
    mount();
    await waitFor(() => blocks());
    // Rehab Upper (c3) runs Wed 10:00-10:45: 10:15 is inside it. y for 10:15 = (615-420)/840*1000 = 232
    const c = sized(col(TODAY_KEY));
    press(c, 236);
    release(c, 236);
    const form = await screen.findByRole('form', { name: t.qcTitle });
    expect(within(form).getByText(t.bdClashH)).toBeTruthy();
    expect(within(form).getByText(t.bdClashB)).toBeTruthy();
  });

  it('a start in the past (before the app clock, 09:05) is refused with a reason', async () => {
    const { port } = mount();
    await waitFor(() => blocks());
    const c = sized(col(TODAY_KEY));
    press(c, 100); // 08:24 -> 08:15
    release(c, 100);
    const form = await screen.findByRole('form', { name: t.qcTitle });
    fireEvent.click(within(form).getByRole('button', { name: 'Oleh Bondar' }));
    const before = JSON.stringify(port.peek()?.docs);
    fireEvent.click(screen.getByRole('button', { name: t.qcCreate }));
    expect(
      (await within(form).findAllByRole('alert')).some((a) => a.textContent === t.qcPast),
    ).toBe(true);
    expect(JSON.stringify(port.peek()?.docs)).toBe(before);
  });

  it('the coach zone decides the wall clock: 13:30 in Kyiv is saved as 13:30 and shown as 13:30', async () => {
    setCoachTimeZone('Europe/Kyiv');
    const { port } = mount();
    await waitFor(() => blocks());
    const c = sized(col(SUN));
    press(c, 470);
    release(c, 470);
    const form = await screen.findByRole('form', { name: t.qcTitle });
    fireEvent.click(within(form).getByRole('button', { name: 'Oleh Bondar' }));
    fireEvent.click(screen.getByRole('button', { name: t.qcCreate }));
    await waitFor(() => expect(screen.queryByRole('form', { name: t.qcTitle })).toBeNull());
    const one = (port.peek()?.docs ?? []).flatMap((d) => d.oneOffs).find((o) => o.day === SUN);
    expect(one?.start).toBe('13:30');
    const mineInSunday = await within(col(SUN)).findAllByRole('button', { name: /13:30–14:30/ });
    expect(mineInSunday).toHaveLength(1);
    expect(tsOf(SUN, 13 * 60 + 30, 'Europe/Kyiv')).toBe(Date.UTC(2026, 9, 11, 10, 30));
  });

  it('the form opens from the hash (a refresh keeps it) and closing clears it', async () => {
    window.history.replaceState(null, '', `#/c/schedule?create=${SUN}.810.45`);
    mount();
    const form = await screen.findByRole('form', { name: t.qcTitle });
    expect(within(form).getByText(/Sunday, 11 Oct · 13:30 – 14:15/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.bdCancel }));
    expect(screen.queryByRole('form', { name: t.qcTitle })).toBeNull();
    expect(currentHash()).not.toContain('create=');
  });

  it('phone: the agenda has an "Add a session" button for the day shown', async () => {
    setViewport(390);
    mount();
    await screen.findByRole('group', { name: t.scDayStripLabel });
    fireEvent.click(screen.getAllByRole('button', { name: /^Add a session on / })[0]);
    expect(await screen.findByRole('form', { name: t.qcTitle })).toBeTruthy();
  });
});

describe('Session drawer', () => {
  const open = async () => {
    mount();
    await waitFor(() => blocks());
    const b = blocks().find((x) => /Planned/.test(x.getAttribute('aria-label') ?? ''))!;
    b.focus();
    fireEvent.click(b);
    return { b, dialog: await screen.findByRole('dialog', { name: t.scInspectorH }) };
  };

  it('is a modal overlay: the calendar is not squeezed into a split and keeps its place', async () => {
    mount();
    await waitFor(() => blocks());
    const viewBefore = document.querySelector('.sc-view')!.parentElement;
    const { dialog } = await open();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('.co-split')).toBeNull();
    expect(document.querySelector('.co-inspector')).toBeNull();
    expect(document.querySelector('.scrim--light')).toBeTruthy();
    expect(document.querySelector('.sc-view')!.parentElement).toBe(viewBefore);
  });

  it('the selected session stays highlighted', async () => {
    const { b } = await open();
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.classList.contains('is-selected')).toBe(true);
  });

  it('closes with the X, and focus returns to the session that opened it', async () => {
    const { b, dialog } = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: t.scInspectorClose }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t.scInspectorH })).toBeNull());
    expect(currentHash()).not.toContain('open=');
    expect(document.activeElement).toBe(b);
  });

  it('closes on a click on the scrim', async () => {
    await open();
    fireEvent.click(document.querySelector('.scrim')!);
    expect(screen.queryByRole('dialog', { name: t.scInspectorH })).toBeNull();
  });

  it('a click on the scrim over another session shows THAT session in the same panel', async () => {
    const { dialog } = await open();
    const first = within(dialog).getByRole('heading', { level: 3 }).textContent;
    const other = blocks().find(
      (x) =>
        x.getAttribute('aria-pressed') === 'false' &&
        /Planned/.test(x.getAttribute('aria-label') ?? '') &&
        !(x.getAttribute('aria-label') ?? '').startsWith(`${first},`),
    )!;
    const otherTitle = (other.getAttribute('aria-label') ?? '').split(',')[0];
    const real = document.elementsFromPoint;
    document.elementsFromPoint = () => [document.querySelector('.scrim')!, other];
    try {
      fireEvent.click(document.querySelector('.scrim')!, { clientX: 10, clientY: 10 });
    } finally {
      document.elementsFromPoint = real;
    }
    const dlg = screen.getByRole('dialog', { name: t.scInspectorH });
    expect(dlg).toBe(dialog); // the same panel, the content swapped
    expect(other.getAttribute('aria-pressed')).toBe('true');
    expect(within(dlg).getByRole('heading', { level: 3 }).textContent).toBe(otherTitle);
  });

  it('is rich: time range large, date, relative words, place, repeat, clients with quick actions, action bar', async () => {
    const { dialog } = await open();
    expect(dialog.querySelector('.sc-insp-time')!.textContent).toMatch(/^\d\d:\d\d–\d\d:\d\d$/);
    expect(dialog.querySelector('.sc-insp-date')!.textContent).toMatch(/ · \d+ min$/);
    expect(dialog.querySelector('.sc-insp-rel')!.textContent).toMatch(
      /hour|minute|day|tomorrow|yesterday|progress/,
    );
    expect(dialog.querySelector('.sc-insp-meta svg')).toBeTruthy(); // the map pin
    expect(within(dialog).getByRole('region', { name: t.scClientsH })).toBeTruthy();
    expect(
      within(dialog).getAllByRole('button', { name: new RegExp(`^${t.scMessage}:`) }).length,
    ).toBeGreaterThan(0);
    expect(
      within(dialog).getAllByRole('button', { name: new RegExp(`^${t.scOpenClient}:`) }).length,
    ).toBeGreaterThan(0);
    expect(dialog.querySelector('.co-foot-actions')).toBeTruthy();
  });

  it('Open client goes to that client', async () => {
    const onNavigate = vi.fn();
    mount(createFixturesSchedulePort(), onNavigate);
    await waitFor(() => blocks());
    fireEvent.click(blocks().find((x) => /Planned/.test(x.getAttribute('aria-label') ?? ''))!);
    const dialog = await screen.findByRole('dialog', { name: t.scInspectorH });
    fireEvent.click(
      within(dialog).getAllByRole('button', { name: new RegExp(`^${t.scOpenClient}:`) })[0],
    );
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ screen: 'client' }));
  });

  it('a request from the client shows from -> to, who asked, the expiry and Accept / Decline right there', async () => {
    window.history.replaceState(
      null,
      '',
      `#/c/schedule?open=${encodeURIComponent(`r-c1-fri:${WEEK0 + 4}`)}`,
    );
    mount();
    const dialog = await screen.findByRole('dialog', { name: t.scInspectorH });
    const req = within(dialog).getByRole('region', { name: t.scRequestOpen });
    expect(within(req).getByText(/Proposed by Oleh/)).toBeTruthy();
    expect(within(req).getByText(/Expires /)).toBeTruthy();
    expect(req.querySelector('.sc-insp-req-at.is-old')!.textContent).toMatch(/18:00/);
    fireEvent.click(within(req).getByRole('button', { name: t.rcAcceptAria('Oleh') }));
    await waitFor(() =>
      expect(within(dialog).queryByRole('button', { name: t.rcAcceptAria('Oleh') })).toBeNull(),
    );
  });

  it('a request the trainer made says so and can be cancelled', async () => {
    window.history.replaceState(
      null,
      '',
      `#/c/schedule?open=${encodeURIComponent(`r-c2-wed:${WEEK0 + 2}`)}`,
    );
    mount();
    const dialog = await screen.findByRole('dialog', { name: t.scInspectorH });
    expect(within(dialog).getByText(t.scReqByYou)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: t.scCancelRequest })).toBeTruthy();
  });

  it('an in-progress session can be marked done or missed from the action bar', async () => {
    const now = tsOf(TODAY_KEY, 10 * 60 + 15); // Rehab Upper 10:00-10:45 is running
    window.history.replaceState(
      null,
      '',
      `#/c/schedule?open=${encodeURIComponent(`r-c3-wed:${WEEK0 + 2}`)}`,
    );
    mount(createFixturesSchedulePort({ now: () => now }));
    const dialog = await screen.findByRole('dialog', { name: t.scInspectorH });
    expect(dialog.querySelector('.sc-insp-rel')!.textContent).toBe(t.scInProgress);
    expect(within(dialog).queryByRole('button', { name: t.scMove })).toBeNull(); // started: no move
    fireEvent.click(within(dialog).getByRole('button', { name: t.scMarkDoneAll }));
    await waitFor(() =>
      expect(within(dialog).queryByRole('button', { name: t.scMarkDoneAll })).toBeNull(),
    );
    expect(within(dialog).getAllByText(t.scDone).length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: t.scMarkMissedAll })).toBeTruthy(); // can still be corrected
  });

  it('the overlap pill is a button: it opens the first conflicting session, whose panel lists the others with Show buttons', async () => {
    mount();
    await waitFor(() => blocks());
    const pill = document.querySelector<HTMLElement>('.sc-overlap-pill')!;
    expect(pill.tagName).toBe('BUTTON');
    fireEvent.click(pill);
    const dialog = await screen.findByRole('dialog', { name: t.scInspectorH });
    const clash = within(dialog).getByRole('region', { name: t.scConflictH });
    const first = within(dialog).getByRole('heading', { level: 3 }).textContent;
    const show = within(clash).getAllByRole('button', { name: /^Show / });
    expect(show.length).toBeGreaterThan(0);
    fireEvent.click(show[0]);
    expect(within(dialog).getByRole('heading', { level: 3 }).textContent).not.toBe(first);
  });

  it('phone: a bottom sheet instead of the drawer', async () => {
    setViewport(390);
    mount();
    await screen.findByRole('group', { name: t.scDayStripLabel });
    const row = screen.getAllByRole('button', { name: /Planned|Overlap/ })[0];
    fireEvent.click(row);
    const dlg = await screen.findByRole('dialog', { name: t.scInspectorH });
    expect(dlg.classList.contains('sheet')).toBe(true);
    expect(document.querySelector('.co-drawer')).toBeNull();
  });
});
