import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AtlasClientsBlock, type AtlasClientsProps } from './AtlasClientsBlock';
import { CORE_DEFAULTS, type AtlasOpts } from './layout';
import type { RosterClient } from './clientRoster';
import type { MyTrainer } from './myTrainer';
import { __getStateForTests } from '../store';
import { clearChat, pushChat } from '../atlas/chatLog';
import { setLocale } from '../i18n';
import {
  DAY,
  NOW,
  coachOn,
  emptyState,
  richState,
  seed,
  stalled,
} from './__fixtures__/widgetHarness';
import type { LiveSession } from '../types';

let mockRoster: RosterClient[] | null = null;
let mockTrainer: MyTrainer | null = null;
vi.mock('./myTrainer', async (orig) => ({
  ...(await orig<typeof import('./myTrainer')>()),
  useMyTrainer: () => mockTrainer,
}));
vi.mock('./clientRoster', async (orig) => ({
  ...(await orig<typeof import('./clientRoster')>()),
  useClientRoster: () => mockRoster,
}));

const client = (i: number, over: Partial<RosterClient> = {}): RosterClient => ({
  id: `c${i}`,
  name: `Client${i} Surname`,
  avatar: false,
  lastSessionAt: NOW - i * DAY,
  dormantDays: null,
  ...over,
});

const handlers = () => ({
  onOpenCoach: vi.fn(),
  onOpenClient: vi.fn(),
  onWatch: vi.fn(),
  onAllClients: vi.fn(),
});
type H = ReturnType<typeof handlers>;

function view(opts: Partial<AtlasOpts>, withClients = false, h: H = handlers()) {
  const props: AtlasClientsProps = {
    opts: { ...CORE_DEFAULTS.atlas, ...opts },
    withClients,
    ...h,
  };
  return { h, ...render(<AtlasClientsBlock {...props} />) };
}

const live = (id: string, mins: number, over: Partial<LiveSession> = {}): LiveSession => ({
  id,
  athleteName: id,
  trainerId: 't',
  startedAt: NOW - mins * 60_000,
  updatedAt: NOW - 30_000,
  gymName: 'Iron Yard',
  exerciseCount: 4,
  ...over,
});

function wideColumn(px: number) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => px,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  clearChat();
  mockRoster = null;
  mockTrainer = null;
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
});

describe('Atlas block alone (no clients)', () => {
  it('Atlas off: the compact row invites, and tapping it opens the Atlas setup', () => {
    const { h } = view({ atlasView: 'compact' });
    expect(screen.getByText('Atlas')).toBeTruthy();
    const row = screen.getByRole('button');
    fireEvent.click(row);
    expect(h.onOpenCoach).toHaveBeenCalledTimes(1);
  });

  it('Atlas on, compact: names him with the temper and shows the latest note', () => {
    seed(coachOn(richState(), { readAt: NOW + 1, keepTemper: true }));
    view({ atlasView: 'compact' });
    expect(document.querySelector('.tac-solo-temper')!.textContent).toBe(' · Neutral');
    expect(document.querySelector('.tac-solo-line')!.textContent!.length).toBeGreaterThan(0);
    expect(document.querySelector('.tac-count')).toBeNull();
  });

  it('softens to Bro while an injury is open, unless the temper is kept', () => {
    seed(coachOn(richState(), { readAt: NOW + 1 }));
    view({ atlasView: 'compact' });
    expect(document.querySelector('.tac-solo-temper')!.textContent).toBe(' · Bro');
  });

  it('shows an unread count (9+ past nine) and a matching accessible name', () => {
    seed(coachOn(richState(), { readAt: 0 }));
    view({ atlasView: 'compact' });
    const count = document.querySelector('.tac-count')!.textContent!;
    expect(count).toMatch(/^(\d|9\+)$/);
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/unread|new/i);
  });

  it('"auto" renders nothing while there is nothing unread, and the compact row once there is', () => {
    seed(coachOn(richState(), { readAt: NOW + 1 }));
    const { container, unmount } = view({ atlasView: 'auto' });
    expect(container.innerHTML).toBe('');
    unmount();
    seed(coachOn(richState(), { readAt: 0 }));
    view({ atlasView: 'auto' });
    expect(document.querySelector('.tac-solo')).toBeTruthy();
  });

  it('"auto" with Atlas off also renders nothing', () => {
    const { container } = view({ atlasView: 'auto' });
    expect(container.innerHTML).toBe('');
  });

  it('note of the day: kicker, note text, Reply opens the chat, Got it marks everything read', () => {
    seed(coachOn(richState(), { readAt: 0 }));
    const { h } = view({ atlasView: 'note' });
    expect(screen.getByText('Note of the day')).toBeTruthy();
    expect(document.querySelector('.tac-note-text')!.textContent!.length).toBeGreaterThan(5);
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(h.onOpenCoach).toHaveBeenCalledTimes(1);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    });
    expect(__getStateForTests().coach.readAt).toBe(NOW);
    expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();
  });

  it('note view with nothing to say: "all caught up"', () => {
    seed(coachOn(emptyState(), { readAt: NOW + 1 }));
    view({ atlasView: 'note' });
    expect(screen.getByText('All caught up — nothing new from Atlas today.')).toBeTruthy();
  });

  it('quick chat: last Atlas message, its follow-ups as chips, an ask field; every part opens the chat', () => {
    seed(coachOn(richState(), { readAt: NOW + 1 }));
    pushChat({ id: 'm1', at: NOW - 600_000, from: 'me', text: 'How is my bench?' });
    pushChat({
      id: 'm2',
      at: NOW - 540_000,
      from: 'atlas',
      text: 'Bench is up 5 kg in six weeks.',
      chips: ['Show the trend', 'Plan deload', 'What about squat?', 'fourth is cut'],
    });
    const { h } = view({ atlasView: 'chat' });
    expect(screen.getByText('Bench is up 5 kg in six weeks.')).toBeTruthy();
    const chips = Array.from(document.querySelectorAll('.tac-replies button')).map(
      (b) => b.textContent,
    );
    expect(chips).toEqual(['Show the trend', 'Plan deload', 'What about squat?']);
    expect(screen.getByText('online')).toBeTruthy();
    fireEvent.click(screen.getByText('Plan deload'));
    fireEvent.click(screen.getByText('Ask Atlas…'));
    for (const b of screen.getAllByRole('button', { name: 'Open chat with Atlas' }))
      fireEvent.click(b);
    expect(h.onOpenCoach.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('quick chat without a conversation falls back to the newest note, then to starter questions', () => {
    seed(coachOn(richState(), { readAt: NOW + 1 }));
    view({ atlasView: 'chat' });
    expect(document.querySelector('.tac-bubble')!.textContent!.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.tac-replies button')).toHaveLength(3);
    cleanup();
    seed(coachOn(emptyState(), { readAt: NOW + 1 }));
    view({ atlasView: 'chat' });
    // nothing logged: his intro note is what he last wrote
    expect(document.querySelector('.tac-bubble')!.textContent).toBe(
      'Atlas. Nothing logged. Train first, talk later.',
    );
    expect(document.querySelector('.tac-bubble-time')!.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it('pending and notice messages are not shown as the last answer', () => {
    seed(coachOn(richState(), { readAt: NOW + 1 }));
    pushChat({ id: 'a', at: NOW - 900_000, from: 'atlas', text: 'Real answer.' });
    pushChat({ id: 'b', at: NOW - 800_000, from: 'atlas', text: 'quota notice', notice: true });
    pushChat({ id: 'c', at: NOW - 700_000, from: 'atlas', text: '…', pending: true });
    view({ atlasView: 'chat' });
    expect(document.querySelector('.tac-bubble')!.textContent).toBe('Real answer.');
  });

  it('stalled lifter: the note card carries the numbers as tags', () => {
    seed(coachOn(stalled(richState()), { readAt: 0 }));
    view({ atlasView: 'note' });
    expect(document.querySelectorAll('.tac-note, .tac-tags').length).toBeGreaterThan(0);
  });
});

describe('Atlas next to my trainer', () => {
  const trainer: MyTrainer = { id: 't1', name: 'Olena Koval', avatar: false };

  it('Atlas on as a note keeps his card and shows the trainer tile under it', () => {
    seed(coachOn(richState(), { readAt: 0 }));
    mockTrainer = trainer;
    view({ atlasView: 'note' });
    expect(document.querySelector('.tac-note')).toBeTruthy();
    expect(screen.getByText('Olena Koval')).toBeTruthy();
    expect(document.querySelector('.tac-duo')).toBeNull();
  });

  it('tapping Atlas in the pair opens him; the trainer tile is information only without the coach feature', () => {
    mockTrainer = trainer;
    const { h } = view({ atlasView: 'compact' });
    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }));
    expect(h.onOpenCoach).toHaveBeenCalled();
    const tile = document.querySelector('.tac-trainer')!;
    if (tile.tagName === 'BUTTON') {
      fireEvent.click(tile);
      expect(window.location.hash).toBe('#/trainer/chat');
    }
  });
});

describe('Together: one stories strip', () => {
  it('Atlas first, a divider, then clients by ring; tapping opens each', () => {
    mockRoster = [
      client(1, { lastSessionAt: NOW - 2 * 3_600_000 }),
      client(2, { lastSessionAt: NOW - 10 * DAY }),
      client(3, { lastSessionAt: NOW - 45 * DAY, dormantDays: 45 }),
      client(4, { lastSessionAt: null }),
    ];
    const { h } = view({ layout: 'together' }, true);
    expect(screen.getByRole('button', { name: /Atlas/ })).toBeTruthy();
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual(
      expect.arrayContaining([
        'Client1 Surname',
        'Client2 Surname',
        'Client3 Surname',
        'Client4 Surname',
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Client3 Surname' }));
    expect(h.onOpenClient).toHaveBeenCalledWith('c3');
    // the dormant client is marked
    expect(
      within(screen.getByRole('button', { name: 'Client3 Surname' })).queryByText('!'),
    ).toBeTruthy();
  });

  it('shows at most twelve clients and "+N more" opens the Clients area', () => {
    mockRoster = Array.from({ length: 15 }, (_, i) => client(i + 1));
    const { h } = view({ layout: 'together' }, true);
    expect(screen.getAllByRole('button', { name: /^Client\d+ Surname$/ })).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    expect(h.onAllClients).toHaveBeenCalledTimes(1);
  });

  it('live clients lead, the others by most recent session; hide-inactive drops 30+ day silence', () => {
    mockRoster = [
      client(1, { lastSessionAt: NOW - 5 * DAY }),
      client(2, { lastSessionAt: NOW - 40 * DAY }),
      client(3, { lastSessionAt: NOW - 1 * DAY }),
    ];
    seed({ ...richState(), liveTrainees: [live('c1', 20)] });
    view({ layout: 'together', hideInactive: true });
    cleanup();
    seed({ ...richState(), liveTrainees: [live('c1', 20)] });
    view({ layout: 'together', hideInactive: true }, true);
    const order = screen
      .getAllByRole('button', { name: /^Client\d+ Surname$/ })
      .map((b) => b.getAttribute('aria-label'));
    expect(order).toEqual(['Client1 Surname', 'Client3 Surname']);
  });

  it('with a trainer: the Atlas | Trainer pair on top and the strip without a second Atlas bubble', () => {
    mockRoster = [client(1)];
    mockTrainer = { id: 't1', name: 'Olena Koval', avatar: false };
    view({ layout: 'together' }, true);
    expect(document.querySelector('.tac-duo')).toBeTruthy();
    expect(document.querySelectorAll('.tac-strip button[aria-label="Atlas"]')).toHaveLength(0);
  });

  it('an empty roster for a coach shows Atlas alone', () => {
    mockRoster = [];
    view({ layout: 'together', atlasView: 'compact' }, true);
    expect(document.querySelector('.tac-solo')).toBeTruthy();
  });
});

describe('Split: Atlas, then the clients', () => {
  const roster = (n: number) => Array.from({ length: n }, (_, i) => client(i + 1));

  it('phone stories: four bubbles and "More"; the header counts everyone; All opens the area', () => {
    mockRoster = roster(7);
    const { h } = view({ layout: 'split', clientsView: 'stories', atlasView: 'compact' }, true);
    expect(screen.getByText('Clients · 7')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Client\d+ Surname$/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    expect(h.onAllClients).toHaveBeenCalledTimes(2);
  });

  it('a live client gets a "Live now" card with minutes, exercises and gym; Watch opens the session', () => {
    mockRoster = roster(3);
    const s = live('c2', 25);
    seed({ ...richState(), liveTrainees: [s] });
    const { h } = view({ layout: 'split', clientsView: 'stories', atlasView: 'compact' }, true);
    expect(screen.getByText('Live now')).toBeTruthy();
    expect(document.querySelector('.tac-live-sub')!.textContent).toBe(
      '25 min · 4 exercises in · Iron Yard',
    );
    fireEvent.click(
      within(document.querySelector('.tac-live') as HTMLElement).getByRole('button', {
        name: 'Watch',
      }),
    );
    expect(h.onWatch).toHaveBeenCalledWith(s);
    // the live client is not repeated among the stories
    expect(screen.getAllByRole('button', { name: /^Client\d+ Surname$/ })).toHaveLength(2);
  });

  it('a session that stopped sending heartbeats is not live', () => {
    mockRoster = roster(2);
    seed({ ...richState(), liveTrainees: [live('c1', 60, { updatedAt: NOW - 30 * 60_000 })] });
    view({ layout: 'split', clientsView: 'stories', atlasView: 'compact' }, true);
    expect(screen.queryByText('Live now')).toBeNull();
  });

  it('list view: status lines, live/alert stats, Watch row, row opens the client, All N clients', () => {
    mockRoster = [
      client(1, { lastSessionAt: NOW - 3_600_000, weekSessions: 3 }),
      client(2, { lastSessionAt: NOW - 3 * DAY }),
      client(3, { lastSessionAt: NOW - 50 * DAY, dormantDays: 50 }),
      client(4, { lastSessionAt: null }),
      client(5, { lastSessionAt: NOW - 600_000 }),
    ];
    seed({ ...richState(), liveTrainees: [live('c5', 10)] });
    const { h } = view({ layout: 'split', clientsView: 'list', atlasView: 'compact' }, true);
    expect(screen.getByText('Trained today · 3 in 7 days')).toBeTruthy();
    expect(screen.getByText('Last session 3 d ago')).toBeTruthy();
    expect(screen.getByText('Last session 50 d ago')).toBeTruthy();
    expect(screen.getByText('No sessions yet')).toBeTruthy();
    expect(screen.getByText('Training now · 10 min · Iron Yard')).toBeTruthy();
    expect(screen.getByText('● 1 live')).toBeTruthy();
    expect(screen.getByText('● 1 alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Watch' }));
    expect(h.onWatch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Client2 Surname' }));
    expect(h.onOpenClient).toHaveBeenCalledWith('c2');
    fireEvent.click(screen.getByRole('button', { name: 'All 5 clients' }));
    expect(h.onAllClients).toHaveBeenCalledTimes(1);
  });

  it('clients first puts the clients before Atlas', () => {
    mockRoster = roster(2);
    view({ layout: 'split', order: 'clients', atlasView: 'compact' }, true);
    const root = document.querySelector('.tac-split')!;
    expect(root.classList.contains('is-clients-first')).toBe(true);
    expect(root.firstElementChild!.classList.contains('tac-clients')).toBe(true);
  });

  it('wide main column: a tile grid (five tiles then "+N more"), live-first cards, Watch/open per tile', () => {
    wideColumn(900);
    mockRoster = roster(8);
    const s = live('c8', 5);
    seed({ ...richState(), liveTrainees: [s] });
    const { h } = view({ layout: 'split', clientsView: 'stories', atlasView: 'compact' }, true);
    expect(document.querySelector('.tac-split')!.classList.contains('is-wide')).toBe(true);
    expect(document.querySelectorAll('.tac-tile')).toHaveLength(5);
    expect(screen.getByRole('button', { name: '+2 more' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All clients' }));
    fireEvent.click(screen.getByRole('button', { name: '+2 more' }));
    expect(h.onAllClients).toHaveBeenCalledTimes(2);
    fireEvent.click(document.querySelector('.tac-tile')!);
    expect(h.onOpenClient).toHaveBeenCalledWith('c1');
  });

  it('wide grid: a live client without live-first is a tile that opens the live session', () => {
    wideColumn(900);
    mockRoster = roster(3);
    const s = live('c2', 5);
    seed({ ...richState(), liveTrainees: [s] });
    const { h } = view({ layout: 'split', liveFirst: false, atlasView: 'compact' }, true);
    const tiles = Array.from(document.querySelectorAll<HTMLElement>('.tac-tile'));
    const liveTile = tiles.find((t) => t.textContent!.includes('Client2'))!;
    fireEvent.click(liveTile);
    expect(h.onWatch).toHaveBeenCalledWith(s);
  });

  it('wide + note view adds the quick replies and the ask field under the note', () => {
    wideColumn(900);
    seed(coachOn(richState(), { readAt: 0 }));
    mockRoster = roster(2);
    const { h } = view({ layout: 'split', atlasView: 'note' }, true);
    expect(document.querySelector('.tac-rule')).toBeTruthy();
    fireEvent.click(screen.getByText('Ask Atlas…'));
    expect(h.onOpenCoach).toHaveBeenCalledTimes(1);
  });

  it('wide + note view with nothing new still offers the ask field', () => {
    wideColumn(900);
    seed(coachOn(emptyState(), { readAt: NOW + 1 }));
    mockRoster = roster(2);
    view({ layout: 'split', atlasView: 'note' }, true);
    expect(screen.getByText('All caught up — nothing new from Atlas today.')).toBeTruthy();
    expect(screen.getByText('Ask Atlas…')).toBeTruthy();
  });

  it('split with a trainer uses the pair next to the clients', () => {
    mockRoster = roster(2);
    mockTrainer = { id: 't1', name: 'Olena Koval', avatar: false };
    view({ layout: 'split', atlasView: 'compact' }, true);
    expect(document.querySelector('.tac-duo')).toBeTruthy();
    expect(document.querySelector('.tac-clients')).toBeTruthy();
  });

  it('hide-inactive removes silent clients from the count and the list', () => {
    mockRoster = [
      client(1),
      client(2, { lastSessionAt: NOW - 60 * DAY, dormantDays: 60 }),
      client(3, { lastSessionAt: null }),
    ];
    view({ layout: 'split', clientsView: 'list', hideInactive: true, atlasView: 'compact' }, true);
    expect(document.querySelector('.tac-sec-head span')!.textContent).toBe('Clients · 1');
    expect(screen.queryByText('Client2 Surname')).toBeNull();
    expect(screen.queryByText('Client3 Surname')).toBeNull();
  });
});

describe('locales', () => {
  it('renders the Atlas row in Ukrainian', () => {
    setLocale('uk');
    seed(coachOn(richState(), { readAt: 0 }));
    view({ atlasView: 'compact' });
    expect(document.querySelector('.tac-solo-name')!.textContent).toContain('Atlas');
  });
});
