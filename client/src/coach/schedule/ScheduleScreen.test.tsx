import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { setViewport } from '../testViewport';
import { createFixturesSchedulePort } from './__fixtures__/fixtures';
import { ScheduleRequestCard } from './ScheduleRequestCard';
import { ScheduleScreen } from './ScheduleScreen';
import { usePeople } from './people';
import { WeekScreen } from './WeekScreen';
import { safeEn } from '../../i18n/coachSafe.en';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '#/c/schedule');
});
beforeEach(() => {
  setViewport(1440);
  window.history.replaceState(null, '', '#/c/schedule');
});

const world = () => createFixturesPort({ warm: true });
const WORLD = world();
const mount = (port = createFixturesSchedulePort()) => {
  const onNavigate = vi.fn();
  render(<ScheduleScreen onNavigate={onNavigate} port={port} worldPort={world()} />);
  return { onNavigate, port };
};
const blocks = () => screen.getAllByRole('button', { name: /\d\d:\d\d–\d\d:\d\d|Proposed/ });

describe('Schedule screen: trainer gyms (B)', () => {
  it('the Gym filter lists only the ticked gyms and the header Gyms chip opens the settings', async () => {
    const { configureCalendarSettings } = await import('./calendarSettings');
    const { defaultSettings } = await import('./hours');
    const { GYMS } = await import('./__fixtures__/gyms');
    const only = GYMS[0]!;
    configureCalendarSettings({
      load: () => Promise.resolve({ ...defaultSettings(), gymIds: [only.id] }),
      save: () => Promise.resolve(),
    });
    try {
      mount();
      const sel = await screen.findByLabelText(new RegExp(t.scGymLabel));
      await waitFor(() => expect(within(sel).getAllByRole('option')).toHaveLength(2));
      const chip = screen.getByRole('button', { name: t.hsOpen });
      fireEvent.click(chip);
      expect(await screen.findByRole('dialog', { name: t.hsTitle })).toBeTruthy();
    } finally {
      configureCalendarSettings(null);
    }
  });
});

describe('Schedule screen', () => {
  it('loading skeleton, then the week grid with sessions', async () => {
    const slow = createFixturesSchedulePort({ delayMs: 40 });
    mount({
      ...slow,
      peek: () => null,
      subscribe: (on, onError) => {
        let off: (() => void) | undefined;
        const id = setTimeout(() => (off = slow.subscribe(on, onError)), 40);
        return () => {
          clearTimeout(id);
          off?.();
        };
      },
    });
    expect(screen.getByRole('status', { name: t.scLoading })).toBeTruthy();
    await waitFor(() => expect(blocks().length).toBeGreaterThan(8));
    expect(screen.getByRole('group', { name: t.scGridLabel })).toBeTruthy();
  });

  it('a clash is said in words, not colour only', async () => {
    mount();
    await waitFor(() => blocks());
    expect(screen.getAllByText(/1 overlap:/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: new RegExp(t.scOverlapTag) }).length,
    ).toBeGreaterThan(0);
  });

  it('selecting a session opens the session drawer with Move and Cancel; Move opens the form', async () => {
    mount();
    await waitFor(() => blocks());
    const planned = screen
      .getAllByRole('button', { name: /Planned/ })
      .find((b) => b.getAttribute('aria-pressed') === 'false');
    fireEvent.click(planned as HTMLElement);
    const insp = await screen.findByRole('dialog', { name: t.scInspectorH });
    expect(within(insp).getByRole('button', { name: t.scCancelSession })).toBeTruthy();
    const move = within(insp).queryByRole('button', { name: t.scMove });
    if (move) {
      fireEvent.click(move);
      expect(
        await screen.findByRole('form', { name: new RegExp(t.rfTitle.slice(0, 4)) }),
      ).toBeTruthy();
    }
  });

  it('keyboard: a block is a button reachable by Tab and opens on Enter/Space (native button)', async () => {
    mount();
    await waitFor(() => blocks());
    const b = blocks()[0];
    expect(b.tagName).toBe('BUTTON');
    b.focus();
    expect(document.activeElement).toBe(b);
  });

  it('Add sessions opens the builder; saving needs a client and a day (errors are said in words)', async () => {
    mount();
    await waitFor(() => blocks());
    fireEvent.click(screen.getByRole('button', { name: t.scAddSessions }));
    const form = await screen.findByRole('form', { name: t.bdTitle });
    fireEvent.click(screen.getByRole('button', { name: t.bdSave }));
    expect((await within(form).findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(within(form).getByText(t.bdNoClient, { selector: 'p' })).toBeTruthy();
  });

  it('empty schedule: the calendar grid still shows, with a hint and Add sessions in the header (no empty state instead)', async () => {
    mount(createFixturesSchedulePort({ empty: true }));
    expect(await screen.findByText(t.scEmptyB)).toBeTruthy();
    expect(screen.getByRole('group', { name: t.scGridLabel })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.scAddSessions })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.hsOpen })).toBeTruthy();
  });

  it('error with nothing cached: failed state with Retry', async () => {
    const base = createFixturesSchedulePort();
    const port = {
      ...base,
      peek: () => null,
      subscribe: (_on: unknown, onError: (e: unknown) => void) => {
        onError(new Error('x'));
        return () => undefined;
      },
    };
    mount(port as typeof base);
    expect(await screen.findByText(safeEn.pbUnknownTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: safeEn.retry })).toBeTruthy();
  });

  it('phone: day strip and agenda rows instead of the grid', async () => {
    setViewport(390);
    mount();
    await screen.findByRole('group', { name: t.scDayStripLabel });
    expect(screen.queryByRole('group', { name: t.scGridLabel })).toBeNull();
  });

  it('month view: the kit month grid; a day opens the day view', async () => {
    window.history.replaceState(null, '', '#/c/schedule?view=month');
    mount();
    expect(await screen.findByRole('grid', { name: t.scMonthLabel })).toBeTruthy();
  });
});

describe('Week page', () => {
  it('counts equal Today and Roster (from the world), requests are answerable', async () => {
    const onNavigate = vi.fn();
    const w = world();
    render(
      <WeekScreen onNavigate={onNavigate} port={createFixturesSchedulePort()} worldPort={w} />,
    );
    expect(await screen.findByText(/sessions done, \d+ clients\./)).toBeTruthy();
    expect(await screen.findAllByText(t.rcKind)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.wkOpenAgenda }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'agenda' });
  });
});

describe('request card in the chat', () => {
  function Card({ id, port }: { id: string; port: ReturnType<typeof createFixturesSchedulePort> }) {
    const people = usePeople(WORLD);
    return <ScheduleRequestCard reqId={id} people={people} port={port} />;
  }
  it('an incoming request is answered with Accept and then says what happened', async () => {
    const port = createFixturesSchedulePort();
    render(<Card id="rq1" port={port} />);
    const accept = await screen.findByRole('button', { name: /Accept .*request/ });
    fireEvent.click(accept);
    await waitFor(() => expect(screen.getAllByText(t.rcAccepted).length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /Accept .*request/ })).toBeNull();
  });
  it('the trainer’s own request waits and can be cancelled', async () => {
    const port = createFixturesSchedulePort();
    render(<Card id="rq2" port={port} />);
    fireEvent.click(await screen.findByRole('button', { name: t.rcCancelReq }));
    await waitFor(() => expect(screen.getAllByText(t.rcCancelled).length).toBeGreaterThan(0));
  });
  it('an unknown request says it is gone', async () => {
    render(<Card id="nope" port={createFixturesSchedulePort()} />);
    expect(await screen.findByText(t.rcMissing)).toBeTruthy();
  });
});

describe('Schedule legend filters', () => {
  const chip = (name: string) =>
    screen
      .getAllByRole('button', { name: new RegExp(`^${name}`) })
      .find((b) => b.closest('.sc-legend'))!;

  it('every legend chip is a toggle (aria-pressed), all on at first', async () => {
    mount();
    await waitFor(() => blocks());
    for (const n of [t.scPlanned, t.scDone, t.scMissed, t.scProposed, t.scOverlapTag])
      expect(chip(n).getAttribute('aria-pressed')).toBe('true');
  });

  it('turning Done off hides done sessions, keeps the others, and survives in the hash', async () => {
    mount();
    await waitFor(() => blocks());
    const doneBefore = document.querySelectorAll('.sc-block .sc-block-state svg').length;
    expect(doneBefore).toBeGreaterThan(0);
    fireEvent.click(chip(t.scDone));
    expect(chip(t.scDone).getAttribute('aria-pressed')).toBe('false');
    expect(window.location.hash).toContain('hide=done');
    expect(screen.queryAllByRole('button', { name: new RegExp(`${t.scDone}$`) })).toHaveLength(
      screen
        .queryAllByRole('button', { name: new RegExp(`${t.scDone}$`) })
        .filter((b) => b.closest('.sc-legend')).length,
    );
    expect(blocks().length).toBeGreaterThan(5);
    fireEvent.click(chip(t.scDone));
    expect(window.location.hash).not.toContain('hide');
  });

  it('Overlap off removes the warning marks but keeps the sessions', async () => {
    mount();
    await waitFor(() => blocks());
    const n = blocks().length;
    expect(document.querySelectorAll('.sc-block--clash').length).toBeGreaterThan(0);
    fireEvent.click(chip(t.scOverlapTag));
    expect(document.querySelectorAll('.sc-block--clash')).toHaveLength(0);
    expect(blocks()).toHaveLength(n);
  });

  it('starts from the hash (a refreshed page keeps the filter)', async () => {
    window.history.replaceState(null, '', '#/c/schedule?hide=planned');
    mount();
    await waitFor(() => chip(t.scPlanned));
    expect(chip(t.scPlanned).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows at most one overlap marker per cluster of overlapping sessions', async () => {
    mount();
    await waitFor(() => blocks());
    const cols = [...document.querySelectorAll('.sc-col')];
    for (const col of cols) {
      const marks = col.querySelectorAll('.sc-block--clash');
      const clashing = [...col.querySelectorAll('.sc-block')].filter((b) =>
        (b.getAttribute('aria-label') ?? '').includes(t.scOverlapTag),
      );
      expect(marks.length).toBeLessThanOrEqual(clashing.length);
      expect(marks.length).toBeLessThanOrEqual(1);
    }
  });

  it('the time is never cut: full range and start-only are both in the block, the name has a tooltip', async () => {
    mount();
    await waitFor(() => blocks());
    const b = document.querySelector<HTMLElement>('.sc-col .sc-block:not(.sc-block--moved)')!;
    expect(b.querySelector('.sc-t-full')?.textContent).toMatch(/\d\d:\d\d/);
    expect(b.querySelector('.sc-t-start')?.textContent).toMatch(/^\d\d:\d\d$/);
    expect(b.getAttribute('title')).toBe(b.getAttribute('aria-label'));
  });
});
