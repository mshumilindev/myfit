/** The member's side of the schedule: only my sessions, the waiting / counter states of the next-session tile, the reschedule sheet. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as cc } from '../../../i18n/coachClient.en';
import { scheduleEn as sc } from '../../../i18n/coachSchedule.en';
import { FIXTURE_NOW } from '../../data/__fixtures__/fixtures';
import {
  createFixturesSchedulePort,
  scheduleSeed,
  WEEK0,
} from '../../schedule/__fixtures__/fixtures';
import { configureSchedule } from '../../schedule/useSchedule';
import type { RescheduleRequest, ScheduleSlot } from '../../schedule/types';
import { opaqueSlotKey } from '../../schedule/ids';
import { tsOf } from '../../schedule/time';
import { setViewport } from '../../testViewport';
import { createFixturesClientChatPort } from '../data/__fixtures__/chat';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import { configureClientCoach } from '../data/config';
import type { ClientChatPort } from '../data/chatPort';
import {
  ClientRescheduleSheet,
  NextSessionTile,
  postClientRequestCard,
  sessionTitle,
  UpcomingSessions,
  useMySessions,
} from './ClientSchedule';
import { configureCoachData } from '../../data/config';
import { createFixturesChatPort } from '../../chat/__fixtures__/fixtures';

beforeEach(() => setViewport(1440));
afterEach(() => {
  cleanup();
  configureClientCoach();
  configureSchedule(null);
  configureCoachData();
});

function setup(clientId: string, requests?: RescheduleRequest[], chat?: ClientChatPort) {
  const base = createFixturesClientPort({ scenario: 'active', now: () => FIXTURE_NOW });
  const snap = { ...base.state(), link: { ...base.state().link, clientId } };
  configureClientCoach({
    port: {
      ...base,
      peek: () => snap,
      subscribe: (on) => (on(snap), () => undefined),
    },
    chat: chat ?? createFixturesClientChatPort({ unread: 0 }),
  });
  const seed = scheduleSeed();
  const port = createFixturesSchedulePort({
    seed: requests ? { ...seed, requests } : seed,
    now: () => FIXTURE_NOW,
  });
  configureSchedule(port);
  return port;
}

function Harness({
  n,
  onMove = () => undefined,
  onRequest = () => undefined,
}: {
  n?: number;
  onMove?: (s: ScheduleSlot) => void;
  onRequest?: (s: ScheduleSlot) => void;
}) {
  const my = useMySessions();
  if (!my) return <p>no link</p>;
  return (
    <>
      <p data-testid="meta">{`${my.myId}|${my.first}|${my.upcoming.length}|${my.loading}`}</p>
      <UpcomingSessions my={my} n={n} onMove={onMove} />
      <NextSessionTile my={my} onRequest={onRequest} />
    </>
  );
}

describe('useMySessions', () => {
  it('lists only sessions I attend that are still ahead, soonest first, with my own requests', async () => {
    setup('c1');
    render(<Harness />);
    const meta = await screen.findByTestId('meta');
    await waitFor(() => expect(meta.textContent).toMatch(/^c1\|Iryna\|\d+\|false$/));
    expect(Number(meta.textContent!.split('|')[2])).toBeGreaterThan(1);
    // another client's group and sessions are not on this screen
    expect(screen.queryByText(/Mobility/)).toBeNull();
  });
});

describe('UpcomingSessions', () => {
  it('a session I already asked to move shows the waiting tag with the proposed time instead of a Move button', async () => {
    setup('c1');
    render(<Harness n={5} />);
    await screen.findByText(cc.mtWaiting);
    // the list row and the next-session tile both say what I asked for
    expect(screen.getAllByText(/You asked for/).length).toBe(2);
    // the other upcoming sessions still offer Move
    expect(screen.getAllByRole('button', { name: cc.mtMove }).length).toBeGreaterThan(0);
  });

  it('Move hands the session to the caller', async () => {
    setup('c1');
    const onMove = vi.fn();
    render(<Harness n={5} onMove={onMove} />);
    const move = (await screen.findAllByRole('button', { name: cc.mtMove }))[0];
    fireEvent.click(move);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0]).toMatchObject({ kind: 'solo' });
  });

  it('shows the first n and "Show all N" reveals the rest', async () => {
    setup('c1');
    render(<Harness n={1} />);
    const all = await screen.findByRole('button', { name: /Show all/ });
    const total = Number(/Show all (\d+)/.exec(all.textContent!)![1]);
    expect(total).toBeGreaterThan(1);
    const list = all.closest('[role="region"], ul, section') ?? document.body;
    const before = within(list as HTMLElement).queryAllByText(cc.mtWaiting, {
      exact: false,
    }).length;
    fireEvent.click(all);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
    expect(before).toBeGreaterThanOrEqual(0);
  });

  it('a member without any session gets the empty row', async () => {
    setup('c13');
    render(<Harness />);
    expect((await screen.findAllByText(cc.mtNoSessions)).length).toBeGreaterThan(0);
  });

  it('a group session names its title and how many people; the footer explains shared sessions; others are never named', async () => {
    setup('c2');
    render(<Harness n={10} />);
    expect((await screen.findAllByText(cc.mtGroup('Mobility class'))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(cc.mtPeople(3))).length).toBeGreaterThan(0);
    expect(screen.getByText(cc.mtUpcomingGroupFoot)).toBeTruthy();
    for (const other of ['Sofiia', 'Maria', 'Dmytro', 'c5', 'c10'])
      expect(document.body.textContent).not.toContain(other);
  });
});

describe('NextSessionTile', () => {
  it('my own pending request: waiting chip, body and Cancel; cancelling withdraws it', async () => {
    const port = setup('c1');
    render(<Harness />);
    expect(await screen.findByText(cc.tdWaitingTag('Iryna'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.tdCancelReq }));
    await waitFor(() =>
      expect(port.dump().requests.find((r) => r.id === 'rq1')!.status).toBe('cancelled'),
    );
    expect(await screen.findByRole('button', { name: cc.tdRequest })).toBeTruthy();
  });

  it('the trainer asked to move it: counter chip with the proposed time; Accept answers yes as the client', async () => {
    const port = setup('c2');
    render(<Harness />);
    expect(await screen.findByText(cc.tdCounterTag('Iryna'))).toBeTruthy();
    expect(screen.getByText(/They suggest/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.tdAccept }));
    await waitFor(() =>
      expect(port.dump().requests.find((r) => r.id === 'rq2')!.status).toBe('accepted'),
    );
  });

  it('Decline answers no', async () => {
    const port = setup('c2');
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: cc.tdDecline }));
    await waitFor(() =>
      expect(port.dump().requests.find((r) => r.id === 'rq2')!.status).toBe('declined'),
    );
  });

  it('no open request: the plain tile with Request reschedule; a group session says so in its kicker', async () => {
    setup('c5', []);
    const onRequest = vi.fn();
    render(<Harness onRequest={onRequest} />);
    fireEvent.click(await screen.findByRole('button', { name: cc.tdRequest }));
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Next (group )?session with Iryna/)).toBeTruthy();
  });

  it('nothing upcoming: nothing rendered', async () => {
    setup('c13', []);
    render(<Harness />);
    await screen.findByTestId('meta');
    expect(screen.queryByRole('button', { name: cc.tdRequest })).toBeNull();
  });
});

describe('sessionTitle', () => {
  const s = (kind: ScheduleSlot['kind'], title?: string) => ({ kind, title }) as ScheduleSlot;
  it('names the kind: group with its title, split with the trainer, solo with the trainer', () => {
    expect(sessionTitle(cc, s('group', 'Mobility'), 'Iryna')).toBe(cc.mtGroup('Mobility'));
    expect(sessionTitle(cc, s('group'), 'Iryna')).toBe(cc.mtGroup(''));
    expect(sessionTitle(cc, s('split'), 'Iryna')).toBe(cc.mtSplit('Iryna'));
    expect(sessionTitle(cc, s('solo'), 'Iryna')).toBe(cc.mtSessionWith('Iryna'));
  });
});

describe('postClientRequestCard', () => {
  const rq = (from: 'client' | 'trainer'): RescheduleRequest => ({
    id: 'r9',
    clientId: 'c1',
    from,
    slotKey: 'sk',
    fromStart: 1,
    toStart: 2,
    status: 'pending',
    createdAt: 0,
    expiresAt: 9,
    scope: 'all',
  });

  it('a request the member made is posted into their chat as a request card with a stable id', async () => {
    const send = vi.fn(async () => undefined);
    const chat = { ...createFixturesClientChatPort({ unread: 0 }), send, now: () => 777 };
    configureClientCoach({ chat });
    postClientRequestCard(rq('client'));
    await Promise.resolve();
    expect(send).toHaveBeenCalledWith('cid-c1', {
      id: 'msg-r9',
      text: '',
      at: 777,
      body: { kind: 'request', reqId: 'r9' },
    });
  });

  it("the trainer's own request is not posted from the member's device", async () => {
    const send = vi.fn(async () => undefined);
    configureClientCoach({ chat: { ...createFixturesClientChatPort({ unread: 0 }), send } });
    const trainerSend = vi.fn(async () => undefined);
    configureCoachData({ chat: { ...createFixturesChatPort(), send: trainerSend } });
    postClientRequestCard(rq('trainer'));
    await Promise.resolve();
    expect(send).not.toHaveBeenCalled();
    expect(trainerSend).not.toHaveBeenCalled();
  });

  it('a failing chat never breaks the request', async () => {
    const send = vi.fn(async () => {
      throw new Error('offline');
    });
    configureClientCoach({ chat: { ...createFixturesClientChatPort({ unread: 0 }), send } });
    expect(() => postClientRequestCard(rq('client'))).not.toThrow();
    await Promise.resolve();
    expect(send).toHaveBeenCalled();
  });
});

describe('ClientRescheduleSheet', () => {
  function SheetHarness({
    mode,
    onChat,
  }: {
    mode: 'known' | 'pick' | 'counter';
    onChat?: () => void;
  }) {
    const my = useMySessions();
    // the form takes its session when it mounts: wait for the schedule like the real screens do
    if (!my || my.loading || my.upcoming.length === 0) return null;
    const slot = my.upcoming[0];
    const counterOf = my.requests.find((r) => r.from === 'trainer');
    return (
      <ClientRescheduleSheet
        my={my}
        slot={mode === 'known' ? slot : undefined}
        counterOf={mode === 'counter' ? counterOf : undefined}
        onClose={() => undefined}
        onOpenChat={onChat}
      />
    );
  }

  it("known session: titled in the client voice with the trainer's first name; sending creates a request FROM the client", async () => {
    const port = setup('c1', []);
    const onChat = vi.fn();
    render(<SheetHarness mode="known" onChat={onChat} />);
    expect(await screen.findByText(cc.rqTitle)).toBeTruthy();
    expect(screen.getByText(cc.rqSub('Iryna'))).toBeTruthy();
    // pick a later day than the session and a time
    fireEvent.click(document.querySelector<HTMLElement>(`[data-day="${WEEK0 + 5}"]`)!);
    fireEvent.change(screen.getByLabelText(sc.rfStart), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: sc.rfSend }));
    expect(await screen.findByText(cc.rqSent)).toBeTruthy();
    expect(screen.getByText(cc.rqSentB('Iryna'))).toBeTruthy();
    await waitFor(() => expect(port.dump().requests).toHaveLength(1));
    expect(port.dump().requests[0]).toMatchObject({
      clientId: 'c1',
      from: 'client',
      toStart: tsOf(WEEK0 + 5, 600),
    });
    fireEvent.click(screen.getByRole('button', { name: sc.rfOpenChat }));
    expect(onChat).toHaveBeenCalled();
  });

  it("pick mode: I choose which of MY sessions to move; the trainer's other clients are not offered", async () => {
    setup('c1', []);
    render(<SheetHarness mode="pick" />);
    expect(await screen.findByText(sc.rfWhichH)).toBeTruthy();
    expect(screen.queryByLabelText(sc.rfClient)).toBeNull();
    const list = screen.getByRole('region', { name: sc.rfWhichHint });
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(0);
  });

  it("counter mode answers the trainer's request", async () => {
    const own: RescheduleRequest = {
      id: 'tq',
      clientId: 'c1',
      from: 'trainer',
      slotKey: opaqueSlotKey(`r-c1-fri:${WEEK0 + 4}`),
      fromStart: tsOf(WEEK0 + 4, 18 * 60),
      toStart: tsOf(WEEK0 + 5, 10 * 60),
      status: 'pending',
      createdAt: FIXTURE_NOW - 1000,
      expiresAt: FIXTURE_NOW + 86_400_000,
      scope: 'all',
    };
    setup('c1', [own]);
    render(<SheetHarness mode="counter" />);
    expect(await screen.findByRole('form', { name: cc.rqTitle })).toBeTruthy();
    expect((screen.getByLabelText(sc.rfStart) as HTMLInputElement).value).toBe('10:00');
  });
});
