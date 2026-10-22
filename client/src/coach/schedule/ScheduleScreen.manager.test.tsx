/**
 * SPO-201: the team manager's schedule. Trainer filter, no gyms / calendar settings, Manager badge; the inspector with a
 * Trainer row, no Message, Move / Cancel / Mark done-missed; Move is a request (caption says the client answers);
 * "Proposed by you" with Cancel request, and the trainer's view "Proposed by … (Manager)"; Cancel through the dialog.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { teamEn } from '../../i18n/coachTeam.en';
import { createFixturesPort, FIXTURE_NOW } from '../data/__fixtures__/fixtures';
import { configureManagerClients, createStaticManagerClients } from '../team/managerClients';
import { MANAGER_CLIENTS } from '../team/__fixtures__/managerClients';
import { currentHash } from '../../route';
import { setViewport } from '../testViewport';
import { createFixturesSchedulePort, scheduleSeed, WEEK0 } from './__fixtures__/fixtures';
import { opaqueSlotKey } from './ids';
import { useManagerSchedule } from './managerSchedule';
import { generateSlots } from './model';
import type { People } from './people';
import { RescheduleForm } from './RescheduleForm';
import { ScheduleScreen } from './ScheduleScreen';
import { createScheduleStore } from './scheduleStore';
import { SessionInspector } from './SessionInspector';
import { dayOfTs, tsOf } from './time';
import type { RescheduleRequest } from './types';

beforeEach(() => {
  setViewport(1440);
  window.history.replaceState(null, '', '#/c/schedule');
  configureManagerClients(createStaticManagerClients(MANAGER_CLIENTS));
});
afterEach(() => {
  cleanup();
  configureManagerClients(null);
  window.history.replaceState(null, '', '#/c/schedule');
});

const TODAY = dayOfTs(FIXTURE_NOW);
const FRI = WEEK0 + 4;
const mountScreen = (manager: boolean) =>
  render(
    <ScheduleScreen
      onNavigate={vi.fn()}
      manager={manager}
      port={createFixturesSchedulePort()}
      worldPort={createFixturesPort({ warm: true })}
    />,
  );

const people: People = {
  list: [],
  byId: new Map(),
  name: (id) => (id === 'c1' ? 'Oleh Bondar' : id),
  first: (id) => (id === 'c1' ? 'Oleh' : id),
  loading: false,
};
function parts(requests: RescheduleRequest[] = []) {
  const port = createFixturesSchedulePort({
    seed: { ...scheduleSeed(), requests },
    now: () => FIXTURE_NOW,
  });
  const posted: RescheduleRequest[] = [];
  const store = createScheduleStore(port, {
    isOnline: () => true,
    onRequest: (r) => posted.push(r),
  });
  store.start();
  const slots = generateSlots(store.getState().docs, store.getState().requests, {
    fromDay: WEEK0 - 7,
    toDay: WEEK0 + 40,
    now: FIXTURE_NOW,
  });
  return { port, store, slots, posted, requests: store.getState().requests };
}
function Inspector(p: {
  slotId: string;
  manager: boolean;
  requests?: RescheduleRequest[];
  now?: number;
}) {
  const { store, slots, requests } = parts(p.requests);
  const team = useManagerSchedule(MANAGER_CLIENTS, p.manager);
  const slot = slots.find((s) => s.id === p.slotId)!;
  return (
    <SessionInspector
      slot={slot}
      clash={false}
      slots={slots}
      requests={requests}
      store={store}
      people={people}
      t={t}
      locale="en"
      now={p.now ?? FIXTURE_NOW}
      onMove={vi.fn()}
      onOpenClient={vi.fn()}
      onMessage={vi.fn()}
      onJump={vi.fn()}
      manager={team ?? undefined}
    />
  );
}
const FRI_ID = `r-c1-fri:${FRI}`;

describe('manager toolbar and header (AC 1)', () => {
  it('has a Trainer select after the view switch, a Manager badge, no Gym select and no calendar settings', async () => {
    mountScreen(true);
    const sel = await screen.findByLabelText(new RegExp(t.scTrainerLabel));
    const opts = within(sel)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(opts).toEqual([t.scAllTrainers, 'Olena Kovalenko', 'Andriy Petrenko']);
    expect(screen.getByText(teamEn.tmRoleManager)).toBeTruthy();
    expect(screen.queryByLabelText(new RegExp(t.scGymLabel))).toBeNull();
    expect(screen.queryByRole('button', { name: t.hsOpen })).toBeNull();
    // order: the view switch comes before the Trainer select in the toolbar
    const view = screen.getByText(t.scMonth);
    expect(view.compareDocumentPosition(sel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a trainer sees Gym + settings and no Trainer select or badge', async () => {
    mountScreen(false);
    await screen.findByLabelText(new RegExp(t.scGymLabel));
    expect(screen.queryByLabelText(new RegExp(t.scTrainerLabel))).toBeNull();
    expect(screen.queryByText(teamEn.tmRoleManager)).toBeNull();
    expect(screen.getByRole('button', { name: t.hsOpen })).toBeTruthy();
  });

  it("choosing a trainer keeps only that trainer's clients' sessions", async () => {
    window.history.replaceState(null, '', '#/c/schedule');
    mountScreen(true);
    const sel = (await screen.findByLabelText(new RegExp(t.scTrainerLabel))) as HTMLSelectElement;
    const count = () => screen.queryAllByRole('button', { name: /\d\d:\d\d–\d\d:\d\d/ }).length;
    await waitFor(() => expect(count()).toBeGreaterThan(0));
    const all = count();
    fireEvent.change(sel, { target: { value: 'trainer-andriy' } });
    await waitFor(() => expect(count()).toBeLessThan(all));
    const andriy = count();
    fireEvent.change(sel, { target: { value: 'trainer-olena' } });
    await waitFor(() => expect(count()).not.toBe(andriy));
    expect(count() + andriy).toBeGreaterThanOrEqual(all);
    expect(currentHash()).toContain('trainer=trainer-olena');
  });
});

describe("clients whose app has not delegated yet (SPO-201 'waiting for client's app')", () => {
  it('the manager schedule explains it with a status notice', async () => {
    mountScreen(true);
    const note = await screen.findByText(teamEn.mcPending(5));
    expect(note.closest('[role="status"]')).toBeTruthy();
  });
});

describe('manager inspector (AC 2, 4, 5)', () => {
  it('shows the Trainer row and Move / Cancel, with no Message button', () => {
    render(<Inspector slotId={FRI_ID} manager />);
    expect(screen.getByText(`${t.scTrainerLabel}: Olena Kovalenko`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(t.scMessage) })).toBeNull();
    expect(screen.getByRole('button', { name: t.scMove })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.scCancelSession })).toBeTruthy();
  });

  it('the trainer keeps Message and has no Trainer row', () => {
    render(<Inspector slotId={FRI_ID} manager={false} />);
    expect(screen.queryByText(new RegExp(`^${t.scTrainerLabel}:`))).toBeNull();
    expect(screen.getByRole('button', { name: new RegExp(t.scMessage) })).toBeTruthy();
  });

  it('a past session offers Mark done and Mark missed', () => {
    render(<Inspector slotId={FRI_ID} manager now={tsOf(FRI, 18 * 60 + 30)} />);
    expect(screen.getByRole('button', { name: t.scMarkDoneAll })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.scMarkMissedAll })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.scMove })).toBeNull();
  });

  it('Cancel session goes through the effects dialog and cancels only on confirm', async () => {
    render(<Inspector slotId={FRI_ID} manager />);
    fireEvent.click(screen.getByRole('button', { name: t.scCancelSession }));
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(t.scCancelH)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: t.scKeep }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.scCancelSession }));
    const again = await screen.findByRole('alertdialog');
    fireEvent.click(within(again).getByRole('button', { name: t.scCancelConfirm }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  const req = (over: Partial<RescheduleRequest> = {}): RescheduleRequest => {
    const s = parts().slots.find((x) => x.id === FRI_ID)!;
    return {
      id: 'rq-m1',
      clientId: 'c1',
      from: 'trainer',
      via: 'manager',
      byName: 'Irina M.',
      slotKey: opaqueSlotKey(s.key),
      fromStart: s.start,
      toStart: tsOf(FRI + 1, 10 * 60),
      status: 'pending',
      createdAt: FIXTURE_NOW,
      expiresAt: FIXTURE_NOW + 3 * 86_400_000,
      scope: 'all',
      ...over,
    };
  };

  it('the manager sees "Proposed by you" with Cancel request', () => {
    render(<Inspector slotId={FRI_ID} manager requests={[req()]} />);
    expect(screen.getByText(t.scReqByYou)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.scCancelRequest })).toBeTruthy();
  });

  it('the trainer sees "Proposed by Irina M. (Manager)"', () => {
    render(<Inspector slotId={FRI_ID} manager={false} requests={[req()]} />);
    expect(screen.getByText('Proposed by Irina M. (Manager)')).toBeTruthy();
  });

  it("the manager sees the trainer's own request as the trainer's, without Cancel", () => {
    render(
      <Inspector slotId={FRI_ID} manager requests={[req({ via: undefined, byName: undefined })]} />,
    );
    expect(screen.getByText('Proposed by trainer Olena Kovalenko')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.scCancelRequest })).toBeNull();
  });

  it('once the client accepts the manager request, the trainer sees the session "Just moved" at the new time', () => {
    const accepted = req({
      status: 'accepted',
      decidedAt: FIXTURE_NOW - 1000,
    });
    render(<Inspector slotId={FRI_ID} manager={false} requests={[accepted]} />);
    expect(screen.getByText(t.scJustMoved)).toBeTruthy();
    expect(screen.queryByText(t.scReqByYou)).toBeNull();
  });

  it('a pending manager request is not yet "Just moved"', () => {
    render(<Inspector slotId={FRI_ID} manager={false} requests={[req()]} />);
    expect(screen.queryByText(t.scJustMoved)).toBeNull();
  });
});

describe('manager move = request (AC 3)', () => {
  it('the form says the client answers in My trainer, and the request goes out on the trainer side', async () => {
    const { store, slots, posted } = parts();
    render(
      <RescheduleForm
        store={store}
        people={people}
        slots={slots}
        requests={[]}
        t={t}
        locale="en"
        now={FIXTURE_NOW}
        today={TODAY}
        mode="known"
        slot={slots.find((s) => s.id === FRI_ID)}
        clientId="c1"
        side="manager"
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        'The client gets a request in My trainer and answers there. Nothing moves until they accept.',
      ),
    ).toBeTruthy();
    const cell = screen
      .getAllByRole('gridcell')
      .map((g) => within(g).queryByRole('button'))
      .find((b) => b?.getAttribute('data-day') === String(FRI + 1));
    fireEvent.click(cell!);
    fireEvent.change(screen.getByLabelText(t.rfStart), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ clientId: 'c1', from: 'trainer', status: 'pending' });
  });
});
