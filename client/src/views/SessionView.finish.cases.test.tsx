import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { COACH_DEFAULT } from '../atlas/types';
import { emptyCycleState } from '../cycle/cycleState';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Exercise, SetEntry, Workout } from '../types';
import { SessionView } from './SessionView';
import { cardBlob, drawShareCard } from '../data/shareCard';

// Wednesday 14 Oct 2026, 18:00 local — fixed wall clock, only Date is faked so timers/userEvent keep running.
const NOW = new Date(2026, 9, 14, 18, 0).getTime();
const MIN = 60000;

const shell = (): Shell => ({
  openOverlay: vi.fn(),
  replaceOverlay: vi.fn(),
  goTab: vi.fn(),
  goPlaybook: vi.fn(),
  openStart: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
  signOut: vi.fn(),
  queueLength: 0,
});
const set = (id: string, o: Partial<SetEntry> = {}): SetEntry => ({
  id,
  reps: 8,
  weight: 80,
  isWarmup: false,
  position: Number(id.replace(/\D/g, '')) || 0,
  ...o,
});
const ex = (id: string, name: string, sets: SetEntry[], o: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  kind: 'strength',
  position: 0,
  sets,
  ...o,
});
const wk = (id: string, exercises: Exercise[], o: Partial<Workout> = {}): Workout => ({
  id,
  startedAt: NOW - 30 * MIN,
  finishedAt: null,
  autoFinished: false,
  exercises,
  ...o,
});
function seed(workouts: Workout[], extra: Record<string, unknown> = {}) {
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts,
    activities: [],
    sleeps: [],
    gyms: [],
    queue: [],
    coach: { ...COACH_DEFAULT },
    cycle: emptyCycleState(),
    ...extra,
  });
}
const mine = (id = 'open') => __getStateForTests().workouts.find((w) => w.id === id)!;
function mount(id = 'open', sh: Shell = shell(), extra: { past?: boolean } = {}) {
  const onClose = vi.fn();
  const r = render(<SessionView workoutId={id} shell={sh} onClose={onClose} {...extra} />);
  return { ...r, onClose, sh };
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// The share card is drawn on a canvas (no canvas in jsdom): stub the drawing, keep everything else real.
vi.mock('../data/shareCard', async (orig) => ({
  ...(await orig<typeof import('../data/shareCard')>()),
  drawShareCard: vi.fn(),
  cardBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

const DAY = 86400000;
const prev = (): Workout => ({
  id: 'prev',
  startedAt: NOW - 3 * DAY,
  finishedAt: NOW - 3 * DAY + 3600000,
  autoFinished: false,
  exercises: [
    ex('pe', 'Bench press', [
      set('p1', { weight: 60, loggedAt: NOW - 3 * DAY + 600000 }),
      set('p2', { weight: 60, loggedAt: NOW - 3 * DAY + 900000 }),
    ]),
  ],
});
const liveTwo = (): Workout =>
  wk('open', [
    ex('bench', 'Bench press', [
      set('s1', { loggedAt: NOW - 20 * MIN }),
      set('s2', { loggedAt: NOW - 15 * MIN }),
    ]),
  ]);
const clickFinish = async (container: HTMLElement) => {
  await userEvent.click(container.querySelector('.focus-finish') as HTMLElement);
};

describe('SessionView · finishing a session', () => {
  it('keeps Finish disabled until something is logged', () => {
    seed([wk('open', [ex('bench', 'Bench press', [])])]);
    const { container } = mount();
    expect((container.querySelector('.focus-finish') as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks first, and "Keep going" leaves the session running', async () => {
    seed([liveTwo()]);
    const { container } = mount();
    await clickFinish(container);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Finish this session?');
    expect(dialog.textContent).toContain('2 sets');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep going' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mine().finishedAt).toBeNull();
  });

  it('warns about an exercise with no sets that would be dropped', async () => {
    const w = liveTwo();
    w.exercises.push(ex('row', 'Cable row', [], { position: 1 }));
    seed([w]);
    const { container } = mount();
    await clickFinish(container);
    expect(screen.getByRole('alertdialog').textContent).toContain('Cable row');
  });

  it('finishes: stamps the end time, drops empty exercises and shows the recap with totals', async () => {
    const w = liveTwo();
    w.exercises.push(ex('row', 'Cable row', [], { position: 1 }));
    seed([w, prev()]);
    const { container } = mount();
    await clickFinish(container);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Finish' }),
    );
    expect(mine().finishedAt).toBe(NOW);
    expect(mine().exercises.map((e) => e.name)).toEqual(['Bench press']);
    expect(screen.getByText('Session saved')).toBeTruthy();
    expect(screen.getByText('Done.')).toBeTruthy();
    const cells = [...container.querySelectorAll('.stat-grid .cell')].map((c) => c.textContent);
    expect(cells).toEqual(['0:30Duration', '2Sets', '1.3 tMoved']);
    // 2 x 80 x 8 = 1280 kg vs last time 2 x 60 x 8 = 960 kg -> +33 %
    const rows = [...container.querySelectorAll('.compare-row')].map((r) => r.textContent);
    expect(rows.map((r) => r!.replace(/\s/g, ' '))).toEqual([
      'Bench press1 280 kg+33%',
      'Session volume1.3 t+33%',
    ]);
    expect(container.querySelector('.pr-panel')!.textContent).toContain(
      'Bench press · 80.0 kg × 8',
    );
  });

  it('shows no comparison for a first-ever session', async () => {
    seed([liveTwo()]);
    const { container } = mount();
    await clickFinish(container);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Finish' }),
    );
    expect(container.querySelector('.compare-row')).toBeNull();
    expect(screen.queryByText('Compared to last session')).toBeNull();
  });

  it('Done closes the screen; Edit session returns to the (now finished) workout', async () => {
    seed([liveTwo()]);
    const { container, onClose } = mount();
    await clickFinish(container);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Finish' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit session' }));
    expect(screen.queryByText('Session saved')).toBeNull();
    expect(container.querySelector('.session-live')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Done on the recap closes the screen', async () => {
    seed([liveTwo()]);
    const { container, onClose } = mount();
    await clickFinish(container);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Finish' }),
    );
    const done = within(container.querySelector('.summary-actions') as HTMLElement).getByRole(
      'button',
      { name: 'Done' },
    );
    await userEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shares the recap: draws the card, saves it, copies it', async () => {
    seed([liveTwo(), prev()]);
    const { container, sh } = mount();
    await clickFinish(container);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Finish' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Share workout/ }));
    const sheet = document.querySelector('.share-sheet') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect(vi.mocked(drawShareCard).mock.calls.at(-1)![2]).toBe('story');
    const model = vi.mocked(drawShareCard).mock.calls.at(-1)![1];
    expect(model).toMatchObject({
      heroValue: '1.3 t',
      title: 'Chest',
      gym: null,
      autoFinished: false,
    });
    expect(model.muscles).toEqual([
      { name: 'Chest', count: 2 },
      { name: 'Shoulders', count: 1 },
      { name: 'Triceps', count: 1 },
    ]);
    expect(model.stats.map((s) => s.value)).toEqual(['0:30', '2', '1']);
    expect(model.record).toEqual({ name: 'New record', detail: 'Bench press · 80.0 kg × 8' });
    expect(model.top).toEqual([{ name: 'Bench press', detail: '80 × 8' }]);
    // format toggle redraws square
    await userEvent.click(within(sheet).getByRole('tab', { name: /Square/i }));
    expect(vi.mocked(drawShareCard)).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      'square',
    );
    // save image downloads a blob
    const create = vi.fn(() => 'blob:x');
    URL.createObjectURL = create;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save image' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(cardBlob).toHaveBeenCalled();
    // copy falls back to a download when the clipboard cannot take images
    click.mockClear();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    // with a clipboard that takes images the copy is toasted instead
    const write = vi.fn(async () => undefined);
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(public items: unknown) {}
      },
    );
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(sh.toast).toHaveBeenCalledWith({ kind: 'ok', icon: 'copy', text: 'Copied' });
    // the native share sheet gets the PNG file when the browser can share files
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(
      (share.mock.calls[0] as unknown as [{ files: File[]; title: string }])[0].files[0].name,
    ).toBe('workout.png');
  });

  it('discarding a live session confirms, deletes it and closes', async () => {
    seed([liveTwo()]);
    const { container, onClose } = mount();
    await userEvent.click(container.querySelector('.focus-discard') as HTMLElement);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Discard session');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep' }));
    expect(__getStateForTests().workouts).toHaveLength(1);
    await userEvent.click(container.querySelector('.focus-discard') as HTMLElement);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(__getStateForTests().workouts.find((x) => x.id === 'open')).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
