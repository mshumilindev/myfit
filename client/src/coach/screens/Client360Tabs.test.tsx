import { markReauthed } from '../security/reauth';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { c360En as c } from '../../i18n/coachClient360.en';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { buildFixtureWorld, createFixturesPort } from '../data/__fixtures__/fixtures';
import { createLocalReadLog } from '../data/readLog';
import { setViewport } from '../testViewport';
import { Client360Screen } from './Client360Screen';
import { idOf, lockedClient, totalsOnlyClient, worldPort } from './storyPorts';

afterEach(cleanup);
beforeEach(() => {
  setViewport(1440);
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:x';
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
});

const W = buildFixtureWorld();
const OLEH = idOf(W, 'Oleh Bondar');
const VIK = idOf(W, 'Viktoriia Danylchuk');
const MAKS = idOf(W, 'Maksym Shevchuk');

const mount = (tab: string, over: Partial<Parameters<typeof Client360Screen>[0]> = {}) => {
  const onNavigate = vi.fn();
  const readLog = createLocalReadLog();
  render(
    <Client360Screen
      cid={OLEH}
      tab={tab}
      onNavigate={onNavigate}
      port={createFixturesPort()}
      unreadByClient={{}}
      readLog={readLog}
      {...over}
    />,
  );
  return { onNavigate, readLog };
};

describe('Workouts tab (S-04)', () => {
  it('shows today, next sessions and history grouped by week with totals', async () => {
    mount('workouts');
    expect(await screen.findByText(c.wkNext)).toBeTruthy();
    expect(screen.getByText(c.wkHistory)).toBeTruthy();
    expect(screen.getByText(c.wkSessionsIn(41, 12))).toBeTruthy();
    expect(screen.getByRole('list', { name: c.wkNext }).querySelectorAll('li')).toHaveLength(3);
    expect(
      screen.getAllByText(new RegExp(c.wkThisWeek('.*').replace(' · .*', '')))[0],
    ).toBeTruthy();
  });

  it('a pending move shows the status instead of a second request button', async () => {
    mount('workouts');
    const list = await screen.findByRole('list', { name: c.wkNext });
    expect(within(list).getByText(c.wkMoveRequested)).toBeTruthy();
    expect(within(list).getAllByRole('button', { name: /Request reschedule/ })).toHaveLength(2);
  });

  it('history rows are disclosure buttons that open a read-only recap, one at a time', async () => {
    mount('workouts');
    await screen.findByText(c.wkHistory);
    const rows = screen
      .getAllByRole('button', { expanded: false })
      .filter((b) => /Upper|Lower/.test(b.textContent ?? ''));
    fireEvent.click(rows[0]);
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(c.wkReadOnly('Oleh'))).toBeTruthy();
    fireEvent.click(rows[1]);
    expect(rows[0].getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByText(c.wkReadOnly('Oleh'))).toHaveLength(1);
  });

  it('the recap has a per-set grid per exercise when sets are shared; totals-only has none', async () => {
    mount('workouts');
    await screen.findByText(c.wkHistory);
    const row = screen
      .getAllByRole('button', { expanded: false })
      .filter((b) => /Upper|Lower/.test(b.textContent ?? ''))[0];
    fireEvent.click(row);
    const recap = screen.getByRole('group', { name: /recap/ });
    const tables = within(recap).getAllByRole('table');
    expect(tables.length).toBeGreaterThanOrEqual(3);
    const cols = within(tables[0])
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(cols).toEqual([c.wkGridSet, c.wkGridKg, c.wkGridReps, c.wkGridRpe]);
    // the set count of the grids adds up to the session's sets
    const rowsN = tables.reduce((n, t) => n + within(t).getAllByRole('row').length - 1, 0);
    expect(String(rowsN)).toBe(
      within(recap).getByText(c.wkRecapSets).nextElementSibling?.textContent,
    );
  });

  it('totals only: no recap rows open, so no set detail reaches the page', async () => {
    mount('workouts', {
      port: worldPort(
        (w) => ({
          ...w,
          clients: w.clients.map((x) =>
            x.id === OLEH ? { ...x, consent: { ...x.consent, sets: 'off', totals: 'full' } } : x,
          ),
        }),
        { warm: true },
      ),
    });
    await screen.findByText(c.wkTotalsOnlyH('Oleh') + '.');
    expect(screen.queryAllByRole('table')).toHaveLength(0);
    expect(screen.queryByText(c.wkGridKg)).toBeNull();
  });

  it('Export offers one row per set and the file then has the set columns', async () => {
    const seen: string[] = [];
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class extends OrigBlob {
        constructor(parts?: BlobPart[], o?: BlobPropertyBag) {
          super(parts, o);
          seen.push(parts?.map((x) => String(x)).join('') ?? '');
        }
      },
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    markReauthed();
    mount('workouts');
    fireEvent.click(await screen.findByRole('button', { name: c.exLabel }));
    const dlg = screen.getByRole('dialog', { name: c.exTitle(c.exScopeWorkouts) });
    fireEvent.click(within(dlg).getByRole('switch', { name: new RegExp(c.exPerSet) }));
    expect(within(dlg).getByText(new RegExp(c.exColSets.exercise))).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: c.exSubmit }));
    await waitFor(() => expect(seen.some((x) => x.includes(c.exColSets.exercise))).toBe(true));
    const csv = seen.find((x) => x.includes(c.exColSets.exercise)) ?? '';
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe(Object.values(c.exColSets).join(','));
    expect(lines.length).toBeGreaterThan(100);
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('Show more pages the history by 12', async () => {
    mount('workouts');
    await screen.findByText(c.wkHistory);
    const count = () =>
      screen.getAllByRole('list').flatMap((l) => [...l.querySelectorAll(':scope > li')]).length;
    const before = count();
    fireEvent.click(screen.getByRole('button', { name: c.wkShowMore(12) }));
    expect(count()).toBe(before + 12);
  });

  it('totals only: no sets, tonnage, PR or adherence; the lock row names what is left out', async () => {
    mount('workouts', {
      port: worldPort(
        (w) => ({
          ...w,
          clients: w.clients.map((x) =>
            x.id === OLEH ? { ...x, consent: { ...x.consent, sets: 'off', totals: 'full' } } : x,
          ),
        }),
        { warm: true },
      ),
    });
    expect(await screen.findByText(c.wkTotalsOnlyH('Oleh') + '.')).toBeTruthy();
    expect(
      screen.getByText(/Left out of the CSV: Sets, Tonnage \(kg\), PR, Adherence \(%\)/),
    ).toBeTruthy();
    expect(screen.queryByText(c.wkAdherence)).toBeNull();
    expect(screen.queryByText(c.wkPR)).toBeNull();
    expect(screen.getByRole('button', { name: c.lkAskFor('Oleh', c.lkSets) })).toBeTruthy();
  });

  it('locked: no totals consent shows the lock row with Ask to share and no export', async () => {
    const { onNavigate, readLog } = mount('workouts', {
      cid: VIK,
      port: worldPort(lockedClient, { warm: true }),
    });
    expect(await screen.findByText(c.wkLockedH('Viktoriia') + '.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: c.exLabel })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: c.lkAskFor('Viktoriia', c.lkTotals) }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'chat', with: VIK });
    expect(readLog.entries.filter((e) => e.category === 'totals' || e.category === 'sets')).toEqual(
      [],
    );
  });

  it('program-only: explains there is no history', async () => {
    mount('workouts', { cid: MAKS });
    expect(await screen.findByText(c.wkProgramBody('Maksym'))).toBeTruthy();
  });

  it('Export names the columns; exporting logs an export read', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    markReauthed();
    const { readLog } = mount('workouts');
    fireEvent.click(await screen.findByRole('button', { name: c.exLabel }));
    const dlg = screen.getByRole('dialog', { name: c.exTitle(c.exScopeWorkouts) });
    expect(within(dlg).getByText(c.exAsShown(41))).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: c.exSubmit }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(readLog.entries.some((e) => e.via === 'export' && e.category === 'sets')).toBe(true);
    click.mockRestore();
  });

  it('logs the read once per open, for the categories shown', async () => {
    const { readLog } = mount('workouts');
    await screen.findByText(c.wkHistory);
    expect(readLog.entries.filter((e) => e.via === 'view').map((e) => e.category)).toEqual([
      'totals',
      'sets',
    ]);
  });

  it('phone: the same tab renders and Request reschedule stays reachable', async () => {
    setViewport(390);
    mount('workouts');
    const list = await screen.findByRole('list', { name: c.wkNext });
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(0);
  });
});

describe('Strength tab (S-05)', () => {
  it('lists the exercises with results, one stalled, with the noise footnote', async () => {
    mount('strength');
    expect(await screen.findByText(c.stWith(13, 1))).toBeTruthy();
    expect(screen.getByText(c.stNoise('2.5'))).toBeTruthy();
    expect(screen.getAllByText(c.stStalled).length).toBe(1);
    expect(screen.getByRole('button', { name: /Bench press/ })).toBeTruthy();
  });

  it('+-0 is neutral text and never a gain', async () => {
    mount('strength');
    const row = await screen.findByRole('button', { name: /Bulgarian split squat/ });
    expect(row.textContent).toContain('±0 kg');
  });

  it('search narrows and a no-match explains', async () => {
    mount('strength');
    fireEvent.change(await screen.findByRole('searchbox', { name: c.stSearch }), {
      target: { value: 'curl' },
    });
    expect(screen.getAllByRole('button', { name: /curl/i }).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText(c.stNoMatch('zzz'))).toBeTruthy();
  });

  it('sort Stalled first puts the stalled lift on top', async () => {
    mount('strength');
    fireEvent.click(await screen.findByRole('button', { name: c.stSortStalled }));
    const first = screen.getByRole('list', { name: c.stExercises }).querySelector('li button');
    expect(first?.textContent).toContain('Bench press');
  });

  it('a row expands to its per-session table and a share-in-chat action', async () => {
    const { onNavigate } = mount('strength');
    const row = await screen.findByRole('button', { name: /Bench press/ });
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('table', { name: c.stDetail('Bench press') })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: c.stShareChat }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'chat', with: OLEH });
  });

  it('locked: when sets are not shared nothing is drawn and the way to ask is offered', async () => {
    const { readLog } = mount('strength', {
      cid: VIK,
      port: worldPort(totalsOnlyClient, { warm: true }),
    });
    expect(await screen.findByText(c.stLockedH('Viktoriia'))).toBeTruthy();
    expect(screen.getByRole('button', { name: c.stOpenWorkouts })).toBeTruthy();
    expect(screen.queryByText(c.stExercises)).toBeNull();
    expect(readLog.entries.filter((e) => e.category === 'sets')).toEqual([]);
  });

  it('Export covers all rows; filtered view offers the choice', async () => {
    mount('strength');
    fireEvent.change(await screen.findByRole('searchbox', { name: c.stSearch }), {
      target: { value: 'curl' },
    });
    fireEvent.click(screen.getByRole('button', { name: c.exLabel }));
    expect(screen.getByRole('radiogroup', { name: c.exRowsGroup })).toBeTruthy();
  });
});

describe('Decisions tab', () => {
  it('lists the client decisions and opens a record inline', async () => {
    mount('decisions');
    const list = await screen.findByRole('list', { name: c.drForClient('Oleh') });
    const row = within(list).getAllByRole('button')[0];
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(c.drWhat)).toBeTruthy();
  });

  it('a client without decisions says so', async () => {
    mount('decisions', {
      cid: MAKS,
      port: worldPort(
        (w) => ({
          ...w,
          book: { ...w.book, decisions: w.book.decisions.filter((d) => d.clientId !== MAKS) },
        }),
        { warm: true },
      ),
    });
    await waitFor(() => expect(screen.queryByText(r.c3Loading)).toBeNull());
    expect(await screen.findByText(c.drNoneForClient('Maksym'))).toBeTruthy();
  });
});
