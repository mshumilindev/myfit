import { safeEn } from '../../i18n/coachSafe.en';
import { notesEn } from '../../i18n/coachNotes.en';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { buildFixtureWorld, createFixturesPort } from '../data/__fixtures__/fixtures';
import { setViewport } from '../testViewport';
import { Client360Screen } from './Client360Screen';
import { idOf, lockedClient, totalsOnlyClient, worldPort } from './storyPorts';

afterEach(cleanup);
beforeEach(() => setViewport(1440));

const W = buildFixtureWorld();
const OLEH = idOf(W, 'Oleh Bondar');
const VIK = idOf(W, 'Viktoriia Danylchuk');
const MAKS = idOf(W, 'Maksym Shevchuk');

const mount = (over: Partial<Parameters<typeof Client360Screen>[0]> = {}) => {
  const onNavigate = vi.fn();
  const utils = render(
    <Client360Screen
      cid={OLEH}
      onNavigate={onNavigate}
      port={createFixturesPort()}
      unreadByClient={{ [OLEH]: 3 }}
      {...over}
    />,
  );
  return { onNavigate, ...utils };
};

describe('Client 360: shared injuries', () => {
  it('a client who shares injuries: a read-only kit list (name, stage, note) and the Restriction line from it', async () => {
    const c = W.clients.find((x) => x.id === 'c3')!;
    expect(c.injuries?.length).toBeGreaterThan(0);
    mount({ cid: 'c3' });
    expect(await screen.findByText(r.c3Injuries)).toBeTruthy();
    expect(screen.getAllByText(/Left shoulder/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Pinching when the bar passes my ears/)).toBeTruthy();
    expect(screen.getByText(r.c3InjFoot)).toBeTruthy();
  });
  it('a healed injury says so and a client who shares none has no list', async () => {
    mount({ cid: 'c13' });
    expect(await screen.findByText(r.c3InjHealed)).toBeTruthy();
    cleanup();
    mount({ cid: OLEH });
    await screen.findAllByRole('tab');
    expect(screen.queryByText(r.c3Injuries)).toBeNull();
  });
});

describe('Client 360: tabs', () => {
  it('has six tabs, Overview selected by default, panel labelled by its tab', async () => {
    mount();
    const tabs = await screen.findAllByRole('tab');
    expect(tabs).toHaveLength(6);
    const sel = tabs.find((t) => t.getAttribute('aria-selected') === 'true')!;
    expect(sel.textContent).toBe(r.c3Tabs.overview);
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(sel.id);
  });

  it('an unknown tab falls back to Overview', async () => {
    mount({ tab: 'nonsense' });
    const sel = (await screen.findAllByRole('tab')).find(
      (t) => t.getAttribute('aria-selected') === 'true',
    )!;
    expect(sel.textContent).toBe(r.c3Tabs.overview);
  });

  it('the Notes tab is the real notes list, and tabs navigate by route', async () => {
    const { onNavigate } = mount({ tab: 'notes' });
    expect(await screen.findByRole('region', { name: notesEn.nTitle('Oleh') })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: r.c3Tabs.strength }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'client', cid: OLEH, tab: 'strength' });
    fireEvent.click(screen.getByRole('tab', { name: r.c3Tabs.overview }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'client', cid: OLEH });
  });
});

describe('Client 360: header and menu', () => {
  it('desktop: Message names the unread count', async () => {
    mount();
    expect(await screen.findByRole('button', { name: r.c3MessageUnread('Oleh', 3) })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Oleh Bondar' })).toBeTruthy();
  });

  it('phone: the unread dot lives on the menu and Message is inside it', async () => {
    setViewport(390);
    mount();
    const menu = await screen.findByRole('button', { name: new RegExp(r.c3MenuLabel) });
    expect(menu.getAttribute('aria-label') ?? menu.textContent).toContain(r.c3MenuUnread(3));
    fireEvent.click(menu);
    expect(screen.getByRole('menuitem', { name: r.c3MenuMessage('Oleh') })).toBeTruthy();
    expect(screen.getByText(r.c3ReadsNamed('Oleh'))).toBeTruthy();
  });

  it('menu note says reads are logged', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: r.c3MenuLabel }));
    expect(screen.getByText(r.c3ReadsNamed('Oleh'))).toBeTruthy();
  });
});

describe('Client 360: overview shares', () => {
  it('lists all seven categories', async () => {
    mount();
    const list = await screen.findByLabelText(r.c3SharesList);
    expect(list.querySelectorAll('.uiinfo-row')).toHaveLength(7);
  });
});

describe('Client 360: full Overview (F5)', () => {
  it('draws every lab block for a client who shares sets: lifts, last 5, rhythm, requests, days', async () => {
    mount();
    expect(await screen.findByRole('table', { name: r.c3LiftsLabel })).toBeTruthy();
    const lifts = screen.getByRole('table', { name: r.c3LiftsLabel });
    expect(within(lifts).getAllByRole('row')).toHaveLength(1 + 4);
    const sessions = screen.getByRole('table', { name: r.c3SessionsLabel });
    expect(within(sessions).getAllByRole('row')).toHaveLength(1 + 5);
    expect(screen.getByRole('figure', { name: r.c3RhythmMeta })).toBeTruthy();
    expect(screen.getByText(r.c3RhythmPlan(4))).toBeTruthy();
    expect(screen.getByRole('heading', { name: r.c3Reschedule })).toBeTruthy();
    const days = screen.getByRole('list', { name: r.c3TrainingDays });
    expect(within(days).getAllByRole('listitem', { name: r.c3DayWith(r.c3Dow.Tue) })).toHaveLength(
      1,
    );
    expect(within(days).getAllByRole('listitem', { name: r.c3DayWith(r.c3Dow.Fri) })).toHaveLength(
      1,
    );
  });

  it('flat lifts are announced as flat, rising ones as rising', async () => {
    mount();
    const lifts = await screen.findByRole('table', { name: r.c3LiftsLabel });
    expect(within(lifts).getByRole('img', { name: r.c3TrendFlat(116) })).toBeTruthy();
    expect(within(lifts).getAllByRole('img', { name: /rising/ })).toHaveLength(3);
  });

  it('answering the request in place shows the result and no second request', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Accept move for Oleh/ }));
    expect(await screen.findByText(/Accepted\./)).toBeTruthy();
  });

  it('totals only: lifts and sessions are locked sentences, rhythm stays', async () => {
    mount({ cid: VIK, port: worldPort(totalsOnlyClient), unreadByClient: {} });
    expect(await screen.findByText(r.c3LiftsTotalsOnly('Viktoriia'))).toBeTruthy();
    expect(screen.getByText(r.c3SessionsLocked('Viktoriia'))).toBeTruthy();
    expect(screen.queryByRole('table', { name: r.c3LiftsLabel })).toBeNull();
    expect(screen.queryByRole('table', { name: r.c3SessionsLabel })).toBeNull();
    expect(screen.getByRole('figure', { name: r.c3RhythmMeta })).toBeTruthy();
  });

  it('shares nothing: no table, no rhythm, no sparkline (history is gated by consent)', async () => {
    mount({ cid: VIK, port: worldPort(lockedClient), unreadByClient: {} });
    await screen.findByText(r.c3LockedH('Viktoriia'), { exact: false });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('figure', { name: r.c3RhythmMeta })).toBeNull();
    expect(document.querySelector('.c3-spark')).toBeNull();
  });

  it('program-only: no lifts table, no rhythm', async () => {
    mount({ cid: MAKS, unreadByClient: {} });
    await screen.findByText(r.c3OfflineBanner('Maksym'), { exact: false });
    expect(screen.getByText(r.c3OfflineLifts('Maksym'))).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('figure', { name: r.c3RhythmMeta })).toBeNull();
  });

  it('phone keeps the lab layout: lifts, sessions and rhythm are wide-only', async () => {
    setViewport(390);
    mount();
    await screen.findAllByRole('tab');
    expect(screen.queryByRole('table', { name: r.c3LiftsLabel })).toBeNull();
    expect(screen.queryByRole('figure', { name: r.c3RhythmMeta })).toBeNull();
    expect(screen.getByRole('heading', { name: r.c3Reschedule })).toBeTruthy();
  });

  it('exactly one filled primary on the Overview: Open decision', async () => {
    const { onNavigate } = mount();
    const btn = await screen.findByRole('button', { name: r.sgOpenDecision });
    expect(btn.className).toContain('uibtn--primary');
    expect(document.querySelectorAll('.uibtn--primary')).toHaveLength(1);
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe('Client 360: restricted states', () => {
  it('locked: explains and shows no restriction or evidence', async () => {
    mount({ cid: VIK, port: worldPort(lockedClient), unreadByClient: {} });
    expect(await screen.findByText(r.c3LockedH('Viktoriia'), { exact: false })).toBeTruthy();
    expect(screen.getByText(r.c3RestrictionLocked('Viktoriia'))).toBeTruthy();
    expect(screen.queryByText(r.c3NoneReported)).toBeNull();
  });

  it('program-only: offline banner, nothing logged', async () => {
    mount({ cid: MAKS, unreadByClient: {} });
    expect(await screen.findByText(r.c3OfflineBanner('Maksym'), { exact: false })).toBeTruthy();
    expect(screen.getByText(r.c3OfflineShares)).toBeTruthy();
  });

  it('revoked prop: access card only, no client data', async () => {
    const { onNavigate } = mount({ revoked: true });
    expect(await screen.findByText(r.stRevokedTitle('Oleh'))).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByText(r.c3Today)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: r.stBackToClients }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'clients' });
  });

  it('revoked via a forbidden read error shows the same frame', async () => {
    mount({ port: worldPort(undefined, { warm: true, failWith: () => 'forbidden' }) });
    expect(await screen.findByText(r.stRevokedTitle('Oleh'))).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('client not on the list', async () => {
    mount({ cid: 'does-not-exist' });
    expect(await screen.findByText(r.stNoClientTitle)).toBeTruthy();
  });
});

describe('Client 360: data states', () => {
  it('loading shows a polite skeleton', () => {
    mount({ port: createFixturesPort({ delayMs: 60_000 }) });
    expect(screen.getByRole('status', { name: r.c3Loading })).toBeTruthy();
  });

  it('error with nothing cached: Try again recovers', async () => {
    let fail = true;
    mount({ port: createFixturesPort({ failWith: () => (fail ? 'unavailable' : null) }) });
    expect(await screen.findByText(safeEn.pbUnknownTitle)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: safeEn.retry }));
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(6));
  });
});
