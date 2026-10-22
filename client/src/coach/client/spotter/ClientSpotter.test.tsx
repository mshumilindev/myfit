/** SPO-236 / SPO-205 (boards C4, C5): the client's Spotter: port over the own notices, the pinned row, the read-only thread. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clientEn as cc } from '../../../i18n/coachClient.en';
import { scheduleEn as sc } from '../../../i18n/coachSchedule.en';
import { FIXTURE_NOW } from '../../data/__fixtures__/fixtures';
import { configureCoachData } from '../../data/config';
import { createMemoryFs } from '../../data/firestore/memoryFs';
import { createFixturesSchedulePort } from '../../schedule/__fixtures__/fixtures';
import { configureSchedule } from '../../schedule/useSchedule';
import { setViewport } from '../../testViewport';
import { createFixturesClientChatPort } from '../data/__fixtures__/chat';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import { configureClientCoach } from '../data/config';
import {
  CLIENT_SPOTTER_KINDS,
  SPOTTER_LIMIT,
  createFirestoreClientSpotterPort,
  createUnavailableClientSpotterPort,
  parseSpotterNotice,
  type ClientSpotterFeed,
} from './clientSpotterPort';
import { MyTrainerPage } from '../screens/MyTrainerPage';
import { configureClientSpotter } from './config';
import { ClientSpotterRow } from './ClientSpotterRow';
import { ClientSpotterScreen, spotterText } from './ClientSpotterScreen';
import {
  SPOTTER_REQUEST_ID,
  buildClientSpotterItems,
  createClientSpotterStore,
  createFixturesClientSpotterPort,
} from './__fixtures__/fixtures';

beforeEach(() => setViewport(390));
afterEach(() => {
  cleanup();
  configureClientCoach();
  configureSchedule(null);
  configureCoachData();
});

const UID = 'u-client';
const doc = (o: Record<string, unknown>) => ({ createdAt: FIXTURE_NOW, readAt: null, ...o });

describe('port over users/{uid}/notices', () => {
  it('parses every client kind and skips the other screens kinds and broken documents', () => {
    for (const kind of CLIENT_SPOTTER_KINDS)
      expect(parseSpotterNotice('n', doc({ kind, detail: 'Irina M.' }))).toMatchObject({
        id: 'n',
        kind,
        who: 'Irina M.',
        unread: true,
      });
    // other screens' notices in the same collection
    for (const kind of ['program-updated', 'trainer-assigned', 'removal-request', 'unknown'])
      expect(parseSpotterNotice('x', doc({ kind }))).toBeNull();
    expect(parseSpotterNotice('x', { kind: 'team' })).toBeNull(); // no time
    expect(parseSpotterNotice('x', doc({ kind: 'move-request', refId: 'r1' }))?.refId).toBe('r1');
    expect(parseSpotterNotice('x', doc({ kind: 'reminder', start: 5 }))?.at).toBe(5);
    expect(parseSpotterNotice('x', doc({ kind: 'move-answer', status: 'declined' }))?.status).toBe(
      'declined',
    );
    // the server's newer shape (`ts`), and a notice read on another device
    expect(parseSpotterNotice('x', { kind: 'team', ts: 9, readAt: 10 })).toMatchObject({
      createdAt: 9,
      unread: false,
    });
  });

  it('is a live query on the own notices only: newest first, capped, other kinds left out', async () => {
    const fs = createMemoryFs(FIXTURE_NOW);
    fs.seed(`users/${UID}/notices/a`, doc({ kind: 'team', createdAt: 10 }));
    fs.seed(
      `users/${UID}/notices/b`,
      doc({ kind: 'session-done', createdAt: 30, detail: 'Irina' }),
    );
    fs.seed(`users/${UID}/notices/c`, doc({ kind: 'program-updated', createdAt: 50 }));
    fs.seed(`users/someone-else/notices/z`, doc({ kind: 'team', createdAt: 60 }));
    let feed: ClientSpotterFeed | null = null;
    const off = createFirestoreClientSpotterPort(fs, UID).subscribe(
      (f) => (feed = f),
      () => undefined,
    );
    await waitFor(() => expect(feed).not.toBeNull());
    expect(feed!.items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(feed!.unread).toBe(2);
    off();
    expect(SPOTTER_LIMIT).toBe(50);
  });

  it('read state is on the notice: marking on one device updates the feed of another; only readAt is written', async () => {
    const fs = createMemoryFs(FIXTURE_NOW);
    fs.seed(`users/${UID}/notices/a`, doc({ kind: 'team', createdAt: 10 }));
    fs.seed(`users/${UID}/notices/b`, doc({ kind: 'reminder', createdAt: 20 }));
    const phone = createFirestoreClientSpotterPort(fs, UID);
    const laptop = createFirestoreClientSpotterPort(fs, UID);
    let seen: ClientSpotterFeed | null = null;
    laptop.subscribe(
      (f) => (seen = f),
      () => undefined,
    );
    await waitFor(() => expect(seen?.unread).toBe(2));
    await phone.markRead(['a']);
    await waitFor(() => expect(seen?.unread).toBe(1));
    const stored = fs.keys(`users/${UID}/notices`);
    expect(stored.length).toBe(2);
    // the rules allow `readAt` and nothing else: the notice keeps every other field
    const a = await fs.get(`users/${UID}/notices/a`);
    expect(Object.keys(a!).sort()).toEqual(['createdAt', 'kind', 'readAt']);
    expect(typeof a!.readAt).toBe('number');
    // idempotent, and nothing to do for no ids
    await phone.markRead(['a']);
    const before = fs.writes.length;
    await phone.markRead([]);
    expect(fs.writes.length).toBe(before);
  });

  it('the stand-in reports an error and never invents messages', async () => {
    const p = createUnavailableClientSpotterPort();
    let failed = false;
    p.subscribe(
      () => undefined,
      () => (failed = true),
    );
    await act(async () => undefined);
    expect(failed).toBe(true);
    await expect(p.markRead(['a'])).rejects.toThrow();
  });
});

function setupSchedule() {
  const base = createFixturesClientPort({ scenario: 'active', now: () => FIXTURE_NOW });
  const snap = { ...base.state(), link: { ...base.state().link, clientId: 'c2' } };
  configureClientCoach({
    port: {
      ...base,
      peek: () => snap,
      subscribe: (on: (s: typeof snap) => void) => (on(snap), () => undefined),
    },
    chat: createFixturesClientChatPort({ unread: 0 }),
  });
  const sched = createFixturesSchedulePort({ now: () => FIXTURE_NOW });
  configureSchedule(sched);
  return sched;
}

describe('thread (read-only)', () => {
  it('shows one message of each kind in words, no composer, a read-only notice', async () => {
    setupSchedule();
    const port = createFixturesClientSpotterPort({ now: FIXTURE_NOW });
    render(<ClientSpotterScreen onBack={() => undefined} port={port} />);
    const list = await screen.findByRole('list', { name: cc.spListLabel });
    const items = buildClientSpotterItems(FIXTURE_NOW);
    expect(new Set(items.map((i) => i.kind))).toEqual(new Set(CLIENT_SPOTTER_KINDS));
    for (const i of items.filter((x) => x.kind !== 'move-request'))
      expect(within(list).getByText(spotterText(cc, i))).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(screen.getByText(cc.spReadOnly)).toBeTruthy();
  });

  it('texts per kind name who did it; a missing name reads as the trainer', () => {
    const it = (
      kind: Parameters<typeof spotterText>[1]['kind'],
      who = 'Irina M.',
      status?: string,
    ) => spotterText(cc, { id: 'x', kind, who, createdAt: 1, unread: false, status });
    expect(it('session-done')).toBe(cc.spDone('Irina M.'));
    expect(it('session-missed')).toBe(cc.spMissed('Irina M.'));
    expect(it('session-cancelled')).toBe(cc.spCancelled('Irina M.'));
    expect(it('team')).toBe(cc.spTeam('Irina M.'));
    expect(it('team', '')).toBe(cc.spTeam(cc.ccTrainer));
    expect(it('move-answer', 'Olena', 'accepted')).toBe(cc.spMoveAnswer('Olena', true));
    expect(it('move-answer', 'Olena', 'declined')).toBe(cc.spMoveAnswer('Olena', false));
    expect(it('access')).toBe(cc.spAccess);
    expect(it('reminder')).toBe(cc.spReminder);
    expect(it('summary')).toBe(cc.spSummary);
    expect(it('move-request')).toBe(cc.mtReqAnswer);
  });

  it('opening marks the unread messages read once, and the bar says how many were new', async () => {
    setupSchedule();
    const port = createFixturesClientSpotterPort({ now: FIXTURE_NOW });
    render(<ClientSpotterScreen onBack={() => undefined} port={port} />);
    await screen.findByRole('list', { name: cc.spListLabel });
    await waitFor(() => expect(port.store.marked.length).toBe(1));
    expect(port.store.marked[0]).toEqual(['s1', 's2', 's3']);
    await waitFor(() => expect(port.feed().unread).toBe(0));
    expect(port.store.marked.length).toBe(1);
  });

  it('Back leaves; a failed read-mark is silent', async () => {
    setupSchedule();
    let back = 0;
    const port = createFixturesClientSpotterPort({ now: FIXTURE_NOW, failMark: true });
    render(<ClientSpotterScreen onBack={() => back++} port={port} />);
    await screen.findByRole('list', { name: cc.spListLabel });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: cc.ccBack }));
    expect(back).toBe(1);
  });

  it('loading, empty and failed states; Retry subscribes again', async () => {
    setupSchedule();
    const cold = createFixturesClientSpotterPort({ cold: true });
    const a = render(<ClientSpotterScreen onBack={() => undefined} port={cold} />);
    expect(screen.getByLabelText(cc.ccLoading)).toBeTruthy();
    a.unmount();
    const empty = createFixturesClientSpotterPort({ items: [] });
    const b = render(<ClientSpotterScreen onBack={() => undefined} port={empty} />);
    expect(await screen.findByText(cc.spEmptyTitle)).toBeTruthy();
    b.unmount();
    const bad = createFixturesClientSpotterPort({ fail: true });
    let subs = 0;
    const counted = {
      ...bad,
      subscribe: (...a: Parameters<typeof bad.subscribe>) => (subs++, bad.subscribe(...a)),
    };
    render(<ClientSpotterScreen onBack={() => undefined} port={counted} />);
    fireEvent.click(await screen.findByRole('button', { name: cc.ccRetry }));
    await waitFor(() => expect(subs).toBe(2));
  });
});

describe('move request card in the thread', () => {
  it('Accept answers through the schedule store (as the client) and the card shows the outcome, once', async () => {
    const sched = setupSchedule();
    const port = createFixturesClientSpotterPort({ now: FIXTURE_NOW });
    render(<ClientSpotterScreen onBack={() => undefined} port={port} schedulePort={sched} />);
    const accept = await screen.findByRole('button', { name: new RegExp(`^${sc.rcAccept}`) });
    expect(screen.getByRole('button', { name: new RegExp(`^${sc.rcDecline}`) })).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(`^${sc.rcCounter}`) })).toBeTruthy();
    fireEvent.click(accept);
    await waitFor(() =>
      expect(sched.dump().requests.find((r) => r.id === SPOTTER_REQUEST_ID)!.status).toBe(
        'accepted',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: new RegExp(`^${sc.rcAccept}`) })).toBeNull(),
    );
    // still one card for the request, not a second one
    expect(screen.getAllByText(sc.rcAccepted).length).toBe(1);
  });

  it('Decline answers no; Suggest another time opens the counter form and answers nothing yet', async () => {
    const sched = setupSchedule();
    const port = createFixturesClientSpotterPort({ now: FIXTURE_NOW });
    render(<ClientSpotterScreen onBack={() => undefined} port={port} schedulePort={sched} />);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${sc.rcCounter}`) }));
    expect(await screen.findByRole('form', { name: cc.rqTitle })).toBeTruthy();
    expect(sched.dump().requests.find((r) => r.id === SPOTTER_REQUEST_ID)!.status).toBe('pending');
    cleanup();
    const sched2 = setupSchedule();
    render(
      <ClientSpotterScreen
        onBack={() => undefined}
        port={createFixturesClientSpotterPort({ now: FIXTURE_NOW })}
        schedulePort={sched2}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${sc.rcDecline}`) }));
    await waitFor(() =>
      expect(sched2.dump().requests.find((r) => r.id === SPOTTER_REQUEST_ID)!.status).toBe(
        'declined',
      ),
    );
  });
});

describe('pinned row', () => {
  it('is always there: with the unread badge and time, or quiet when there is nothing', async () => {
    const port = createFixturesClientSpotterPort({ now: FIXTURE_NOW });
    let opened = 0;
    const a = render(<ClientSpotterRow port={port} onOpen={() => opened++} />);
    const row = await screen.findByRole('button', { name: new RegExp(cc.spTitle) });
    await waitFor(() => expect(row.textContent).toContain('3'));
    fireEvent.click(row);
    expect(opened).toBe(1);
    a.unmount();
    render(
      <ClientSpotterRow
        port={createFixturesClientSpotterPort({ store: createClientSpotterStore([]) })}
        onOpen={() => undefined}
      />,
    );
    expect(await screen.findByText(cc.spTitle)).toBeTruthy();
    expect(screen.queryByText('3')).toBeNull();
  });
});

describe('My trainer', () => {
  it('has Spotter pinned above the trainer card and opens it', async () => {
    const sched = setupSchedule();
    configureClientSpotter(createFixturesClientSpotterPort({ now: FIXTURE_NOW }));
    let opened = 0;
    render(
      <MyTrainerPage
        schedulePort={sched}
        onBack={() => undefined}
        onChat={() => undefined}
        onSpotter={() => opened++}
        onSharing={() => undefined}
        onProgram={() => undefined}
        onLeft={() => undefined}
      />,
    );
    const row = await screen.findByRole('button', { name: new RegExp(cc.spTitle) });
    const chat = screen.getByRole('button', { name: cc.mtChat });
    // Spotter comes first in the page
    expect(row.compareDocumentPosition(chat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(row);
    expect(opened).toBe(1);
    configureClientSpotter(null);
  });
});
