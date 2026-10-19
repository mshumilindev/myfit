import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { freezeClock, NOW, DAY } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  callFn: vi.fn(),
  mem: new Map<string, unknown>(),
  snapshot: { value: null as unknown },
  set: vi.fn(),
  load: vi.fn(),
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  callFn: m.callFn,
  currentUid: () => 'trainer-1',
  getUsername: () => 'Coach Carl',
}));
vi.mock('../offline/offlineCache', () => ({
  offlinePeekNow: (key: string) => (m.mem.has(key) ? { at: 0, data: m.mem.get(key) } : null),
  offlineHydrate: async (
    _key: string,
    apply: (d: unknown) => void,
    o?: { accept?: (d: unknown) => boolean },
  ) => {
    if (m.snapshot.value && (!o?.accept || o.accept(m.snapshot.value))) apply(m.snapshot.value);
  },
  offlineLoad: (key: string, fetch: () => Promise<unknown>, o?: unknown) => {
    m.load(key, o);
    return fetch();
  },
  offlineSet: (key: string, v: unknown) => {
    m.set(key, v);
    m.mem.set(key, v);
    return Promise.resolve();
  },
}));

import { TrainerView } from './TrainerView';

const client = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Ada Lovelace',
  avatar: false,
  lastSessionAt: NOW - 2 * DAY,
  live: false,
  liveStartedAt: null,
  liveSets: 0,
  liveVolumeKg: 0,
  weekSessions: 3,
  weekVolumeKg: 12_500,
  weekDeltaPct: 12.34,
  programName: 'Push Pull',
  programWeek: 2,
  dormantDays: null,
  totalSessions: 41,
  ...over,
});

const LIST = [
  client(),
  client({
    id: 'c2',
    name: 'Bob Marley',
    lastSessionAt: NOW - 30 * DAY,
    dormantDays: 30,
    weekSessions: 0,
    weekVolumeKg: 0,
    weekDeltaPct: -100,
    programName: null,
    totalSessions: undefined,
  }),
  client({
    id: 'c3',
    name: 'Cleo Patra',
    live: true,
    liveStartedAt: NOW - 125_000,
    liveSets: 6,
    liveVolumeKg: 2400,
    weekDeltaPct: null,
    programWeek: null,
    lastSessionAt: null,
  }),
];

beforeEach(() => {
  freezeClock();
  setLocale('en');
  m.callFn.mockReset();
  m.set.mockReset();
  m.load.mockReset();
  m.mem.clear();
  m.snapshot.value = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function mount(list: unknown = LIST) {
  m.callFn.mockImplementation(async (name: string) => {
    if (name === 'trainerClients') {
      if (list instanceof Error) throw list;
      return { clients: list };
    }
    throw new Error(`unexpected ${name}`);
  });
  const onOpenProfile = vi.fn();
  const onOpenMe = vi.fn();
  const out = render(<TrainerView onOpenProfile={onOpenProfile} onOpenMe={onOpenMe} />);
  return { ...out, onOpenProfile, onOpenMe };
}

describe('TrainerView', () => {
  it('shows a skeleton first, then the summary with the number of clients training now', async () => {
    await mount();
    expect(await screen.findByText(en.trSummary(3, 1))).toBeTruthy();
    expect(screen.getByText(en.trMyClients)).toBeTruthy();
    expect(screen.getByText(en.trFooterNote)).toBeTruthy();
    expect(m.callFn).toHaveBeenCalledWith('trainerClients');
  });

  it('with no clients shows the empty state and Add client opens the form', async () => {
    await mount([]);
    expect(await screen.findByText(en.trEmptyTitle)).toBeTruthy();
    expect(screen.queryByText(en.trFooterNote)).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: en.trAddClient }).pop() as HTMLElement);
    expect(screen.getByPlaceholderText(en.firstName)).toBeTruthy();
  });

  it('a failed first load offers Retry which loads again', async () => {
    await mount(new Error('down'));
    expect(await screen.findByText(en.error)).toBeTruthy();
    m.callFn.mockResolvedValue({ clients: LIST });
    fireEvent.click(screen.getByRole('button', { name: en.retry }));
    expect(await screen.findByText(en.trSummary(3, 1))).toBeTruthy();
  });

  it('lists every client with its status line: live, dormant, last session', async () => {
    const { container } = await mount();
    await screen.findByText(en.trSummary(3, 1));
    const cards = [...container.querySelectorAll('.trainer-client-list .tr-client-card')];
    // first card is the trainer themself
    expect(cards[0].textContent).toContain('Coach Carl');
    expect(cards[0].textContent).toContain(en.roleTrainer);
    expect(cards[1].querySelector('.s')?.textContent).toBe(
      `${en.trLastSession('Sep 24')} · 12.5 t`,
    );
    expect(cards[2].classList.contains('dormant')).toBe(true);
    expect(cards[2].querySelector('.s')?.textContent).toBe(en.trDormantDays(30));
    expect(cards[3].classList.contains('live')).toBe(true);
    expect(cards[3].querySelector('.s')?.textContent).toBe('6 sets · 2.4 t');
    expect(cards[3].textContent).toContain(`${en.stTrainingNow} · 2:05`);
  });

  it('the live clock keeps counting every second', async () => {
    vi.useFakeTimers({
      toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    });
    vi.setSystemTime(NOW);
    const { container } = await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(container.querySelector('.tr-card-photo')?.textContent).toContain('2:05');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(container.querySelector('.tr-card-photo')?.textContent).toContain('2:08');
  });

  it('the week table shows sessions, volume, change vs last week, program and last seen per client', async () => {
    const { container } = await mount();
    await screen.findByText(en.trSummary(3, 1));
    const rows = [...container.querySelectorAll('.trainer-table-row')] as HTMLElement[];
    const cells = (r: HTMLElement) =>
      [...r.querySelectorAll(':scope > span')].map((c) =>
        c.classList.contains('who') ? (c.lastElementChild?.textContent ?? '') : c.textContent,
      );
    expect(cells(rows[0])).toEqual([
      'Ada Lovelace',
      '41',
      '12.5 t',
      '+12.3%',
      'Push Pull · wk 2',
      'Sep 24',
    ]);
    expect(cells(rows[1])).toEqual([
      'Bob Marley',
      '0',
      '0.0 t',
      '-100%',
      'None',
      en.trDormantDays(30),
    ]);
    expect(cells(rows[2])).toEqual(['Cleo Patra', '41', '12.5 t', '—', 'Push Pull', 'Now']);
    expect(rows[0].querySelector('.ok')?.textContent).toBe('+12.3%');
    expect(rows[1].querySelector('.danger')).toBeTruthy();
    expect(rows[2].querySelector('.accent')?.textContent).toBe('Now');
  });

  it('delta text: zero reads 0% and a missing last-session reads Never', async () => {
    const list = [client({ weekDeltaPct: 0.04, lastSessionAt: null })];
    const { container } = await mount(list);
    await screen.findByText(en.trSummary(1, 0));
    const row = container.querySelector('.trainer-table-row') as HTMLElement;
    expect([...row.querySelectorAll(':scope > span')].map((c) => c.textContent)).toContain('0%');
    expect(row.textContent).toContain(en.stNever);
  });

  it('opens a client profile from a card or a table row, and the trainer own profile from the first card', async () => {
    const { container, onOpenProfile, onOpenMe } = await mount();
    await screen.findByText(en.trSummary(3, 1));
    const cards = container.querySelectorAll('.trainer-client-list .tr-client-card');
    fireEvent.click(cards[2]);
    expect(onOpenProfile).toHaveBeenLastCalledWith('c2');
    fireEvent.click(container.querySelectorAll('.trainer-table-row')[2]);
    expect(onOpenProfile).toHaveBeenLastCalledWith('c3');
    fireEvent.click(cards[0]);
    expect(onOpenMe).toHaveBeenCalled();
  });

  it('the preview follows hover/focus: first client by default, then the one you point at', async () => {
    const { container } = await mount();
    await screen.findByText(en.trSummary(3, 1));
    const preview = () => container.querySelector('.trainer-client-preview') as HTMLElement;
    expect(preview().querySelector('h3')?.textContent).toBe('Ada Lovelace');
    expect(preview().querySelector('.cell .v.ok')?.textContent).toBe('ok');
    fireEvent.mouseEnter(container.querySelectorAll('.trainer-client-list .tr-client-card')[2]);
    expect(preview().querySelector('h3')?.textContent).toBe('Bob Marley');
    expect(preview().textContent).toContain(en.trDormantDays(30));
    fireEvent.focus(container.querySelectorAll('.trainer-table-row')[2]);
    expect(preview().classList.contains('live')).toBe(true);
    expect(within(preview()).getByText(en.trLiveNow)).toBeTruthy();
    expect(within(preview()).getByText(en.trLiveReadOnly)).toBeTruthy();
    fireEvent.click(within(preview()).getByRole('button', { name: en.trAssignProgram }));
  });

  it('assign program opens the selected client', async () => {
    const { container, onOpenProfile } = await mount();
    await screen.findByText(en.trSummary(3, 1));
    fireEvent.click(
      within(container.querySelector('.trainer-client-preview') as HTMLElement).getByRole(
        'button',
        { name: en.trAssignProgram },
      ),
    );
    expect(onOpenProfile).toHaveBeenCalledWith('c1');
  });

  it('paints this session copy at once and the sealed snapshot when nothing newer arrived', async () => {
    m.mem.set('trainerClients', [client({ id: 'cached', name: 'Cached Carl' })]);
    m.callFn.mockReturnValue(new Promise(() => undefined));
    render(<TrainerView onOpenProfile={() => undefined} onOpenMe={() => undefined} />);
    expect((await screen.findAllByText('Cached Carl')).length).toBeGreaterThan(0);
    cleanup();
    m.mem.clear();
    m.snapshot.value = [client({ id: 's', name: 'Sealed Sue' })];
    render(<TrainerView onOpenProfile={() => undefined} onOpenMe={() => undefined} />);
    expect((await screen.findAllByText('Sealed Sue')).length).toBeGreaterThan(0);
  });

  it('keeps the list on screen when a later refresh fails', async () => {
    const { container } = await mount();
    await screen.findByText(en.trSummary(3, 1));
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    m.callFn.mockRejectedValue(new Error('offline'));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(container.querySelectorAll('.trainer-table-row').length).toBe(3);
    expect(screen.queryByText(en.error)).toBeNull();
  });

  it('polls every 15 s while visible and not while the tab is hidden; returning refetches once', async () => {
    vi.useFakeTimers({
      toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    });
    vi.setSystemTime(NOW);
    await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const calls = () => m.callFn.mock.calls.filter((c) => c[0] === 'trainerClients').length;
    expect(calls()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(calls()).toBe(2);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(calls()).toBe(2);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(calls()).toBe(3);
  });
});

describe('TrainerView: add client', () => {
  async function openForm() {
    const out = await mount([]);
    await screen.findByText(en.trEmptyTitle);
    fireEvent.click(screen.getAllByRole('button', { name: en.trAddClient })[0]);
    return out;
  }
  const save = () => screen.getByRole('button', { name: en.save }) as HTMLButtonElement;

  it('Save needs a first name and a username of at least two characters', async () => {
    await openForm();
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(en.firstName), { target: { value: 'A' } });
    fireEvent.change(screen.getByPlaceholderText(en.username), { target: { value: 'ada' } });
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(en.firstName), { target: { value: 'Ada' } });
    expect(save().disabled).toBe(false);
    fireEvent.change(screen.getByPlaceholderText(en.username), { target: { value: ' a ' } });
    expect(save().disabled).toBe(true);
  });

  it('creates the client, shows the invite link, copies it, and refreshes the list', async () => {
    await openForm();
    fireEvent.change(screen.getByPlaceholderText(en.firstName), { target: { value: ' Dan ' } });
    fireEvent.change(screen.getByPlaceholderText(en.lastName), { target: { value: 'Smith ' } });
    fireEvent.change(screen.getByPlaceholderText(en.username), { target: { value: ' dan ' } });
    const created = client({ id: 'new', name: 'Dan Smith' });
    m.callFn.mockImplementation(async (name: string) => {
      if (name === 'trainerCreateClient')
        return { client: created, invite: { token: 'tok123', expiresAt: NOW + 7 * DAY } };
      return { clients: [created] };
    });
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    fireEvent.click(save());
    expect(await screen.findByText(en.adminReadyToClaim('Dan Smith'))).toBeTruthy();
    expect(m.callFn).toHaveBeenCalledWith('trainerCreateClient', {
      name: 'Dan Smith',
      firstName: 'Dan',
      lastName: 'Smith',
      username: 'dan',
    });
    expect(m.set).toHaveBeenCalledWith('trainerClients', [created]);
    expect(m.load).toHaveBeenLastCalledWith('trainerClients', { force: true });
    expect(screen.getByText(/#\/join\/tok123$/)).toBeTruthy();
    expect(screen.getByText(en.adminExpires('Oct 3'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.adminCopy) }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: new RegExp(en.adminCopied) })).toBeTruthy(),
    );
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/#\/join\/tok123$/));
    fireEvent.click(screen.getByRole('button', { name: en.adminDone }));
    await waitFor(() => expect(screen.queryByText(en.adminReadyToClaim('Dan Smith'))).toBeNull());
  });

  it('a rejected create shows the server message and keeps the form', async () => {
    await openForm();
    fireEvent.change(screen.getByPlaceholderText(en.firstName), { target: { value: 'Dan' } });
    fireEvent.change(screen.getByPlaceholderText(en.username), { target: { value: 'dan' } });
    m.callFn.mockRejectedValue(new Error('Username taken'));
    fireEvent.click(save());
    expect(await screen.findByText('Username taken')).toBeTruthy();
    expect(save().disabled).toBe(false);
  });

  it('a non-Error rejection falls back to the generic error text', async () => {
    await openForm();
    fireEvent.change(screen.getByPlaceholderText(en.firstName), { target: { value: 'Dan' } });
    fireEvent.change(screen.getByPlaceholderText(en.username), { target: { value: 'dan' } });
    m.callFn.mockRejectedValue('boom');
    fireEvent.click(save());
    expect(await screen.findByText(en.error)).toBeTruthy();
  });

  it('Cancel closes the form', async () => {
    await openForm();
    fireEvent.click(screen.getAllByRole('button', { name: en.cancel }).pop() as HTMLElement);
    await waitFor(() => expect(screen.queryByPlaceholderText(en.firstName)).toBeNull());
  });
});
