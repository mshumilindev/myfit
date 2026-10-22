import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Workout } from '../types';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { freezeClock, makeShell, NOW } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  callFn: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  callFn: m.callFn,
}));
// The sealed on-device snapshot is a storage boundary: the screen sees `fetch` then `apply`, `onError` on failure.
vi.mock('../offline/offlineCache', () => ({
  offlineRevalidate: (o: {
    fetch: () => Promise<unknown>;
    apply: (d: unknown) => void;
    onError?: (e: unknown) => void;
    accept?: (d: unknown) => boolean;
  }) => {
    m.revalidate(o);
    void o.fetch().then(
      (d) => (o.accept ? o.accept(d) && o.apply(d) : o.apply(d)),
      (e) => o.onError?.(e),
    );
    return () => undefined;
  },
}));

import { TraineeSessionView } from './TraineeSessionView';

const T0 = NOW - 3 * 3600_000;
const set = (id: string, position: number, reps: number, weight: number | null, extra = {}) => ({
  id,
  position,
  reps,
  weight,
  isWarmup: false,
  ...extra,
});

function workout(): Workout {
  return {
    id: 'w1',
    startedAt: T0,
    finishedAt: T0 + 62 * 60_000,
    autoFinished: false,
    gymId: null,
    exercises: [
      {
        id: 'e1',
        name: 'Barbell Bench Press - Medium Grip',
        position: 0,
        sets: [
          set('s1', 0, 10, 40, { isWarmup: true, loggedAt: T0 }),
          set('s2', 1, 8, 80, { loggedAt: T0 + 150_000 }),
          set('s3', 2, 6, 82.5, {
            type: 'drop',
            loggedAt: T0 + 400_000,
            drops: [
              { reps: 6, weight: 70 },
              { reps: 5, weight: 60 },
            ],
          }),
          set('s4', 3, 12, null, { type: 'static-dynamic' }),
          set('s5', 4, 5, 30, { type: 'reverse-drop', drops: [{ reps: 5, weight: 40 }] }),
        ],
      },
      {
        id: 'e2',
        name: 'Pullups',
        position: 1,
        groupId: 'g1',
        groupOrder: 0,
        groupKind: 'superset',
        sets: [set('p1', 0, 8, null), set('p2', 1, 7, null)],
      },
      {
        id: 'e3',
        name: 'Bent Over Barbell Row',
        position: 2,
        groupId: 'g1',
        groupOrder: 1,
        groupKind: 'superset',
        sets: [set('r1', 0, 10, 60)],
      },
      {
        id: 'e4',
        name: 'Barbell Squat',
        position: 3,
        groupId: 'g2',
        groupOrder: 0,
        groupKind: 'circuit',
        sets: [set('c1', 0, 5, 100), set('c2', 1, 5, 100)],
      },
      {
        id: 'e5',
        name: 'Barbell Shoulder Press',
        position: 4,
        groupId: 'g2',
        groupOrder: 1,
        groupKind: 'circuit',
        sets: [set('c3', 0, 8, 40)],
      },
    ],
  } as Workout;
}

beforeEach(() => {
  freezeClock();
  setLocale('en');
  m.callFn.mockReset();
  m.revalidate.mockReset();
});
afterEach(cleanup);

const open = (over: Partial<Parameters<typeof TraineeSessionView>[0]> = {}) => {
  const onClose = vi.fn();
  const out = render(
    <TraineeSessionView
      athleteId="a1"
      workoutId="w1"
      shell={makeShell()}
      onClose={onClose}
      {...over}
    />,
  );
  return { ...out, onClose };
};

describe('TraineeSessionView', () => {
  it('asks the audited function for exactly this athlete and workout, with a loading placeholder first', async () => {
    let release!: (v: unknown) => void;
    m.callFn.mockReturnValue(new Promise((r) => (release = r)));
    open();
    expect(screen.getByText('…')).toBeTruthy();
    expect(m.callFn).toHaveBeenCalledWith('athleteWorkout', { id: 'a1', workoutId: 'w1' });
    expect(m.revalidate.mock.calls[0][0].key).toBe('athleteWorkout.a1.w1');
    release({ workout: workout() });
    await waitFor(() => expect(screen.queryByText('…')).toBeNull());
  });

  it('shows the athlete name, a one-line summary and read-only exercise cards', async () => {
    m.callFn.mockResolvedValue({ workout: workout() });
    const { container, onClose } = open({ athleteName: 'Ada L.' });
    expect(await screen.findByText('Ada L.')).toBeTruthy();
    const sub = container.querySelector('.uipagehead-sub, [class*="sub"]')?.textContent ?? '';
    expect(sub).toBe(`Sep 26 · 11 ${en.sets} · 4.5 t · 5 ${en.exercises} · 1:02`);
    expect(sub).toContain(`5 ${en.exercises}`);
    expect(screen.getByText('Barbell Bench Press - Medium Grip')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalled();
  });

  it('falls back to "View recap" when the athlete has no name', async () => {
    m.callFn.mockResolvedValue({ workout: workout() });
    open();
    expect(await screen.findByText(en.trLiveViewRecap)).toBeTruthy();
  });

  it('labels each set kind and shows bodyweight as BW and rests between logged sets', async () => {
    m.callFn.mockResolvedValue({ workout: workout() });
    const { container } = open();
    await screen.findByText('Barbell Bench Press - Medium Grip');
    const card = container.querySelector('.exercise-card') as HTMLElement;
    const kinds = [...card.querySelectorAll('.set-main .kind')].map((k) => k.textContent);
    expect(kinds).toEqual([en.warmup, en.working, en.dropWord, en.setSDShort, en.reverseWord]);
    expect(within(card).getByText(en.bodyweightShort)).toBeTruthy();
    const rests = [...card.querySelectorAll('.set-rest')].map((r) => r.textContent);
    // 150 s and 250 s between logs, less the 30 s of work each set is credited with
    expect(rests).toEqual([en.restLabel('2:00'), en.restLabel('3:40')]);
  });

  it('expands drop sets into their parts with a foot line', async () => {
    m.callFn.mockResolvedValue({ workout: workout() });
    const { container } = open();
    await screen.findByText('Barbell Bench Press - Medium Grip');
    const card = container.querySelector('.exercise-card') as HTMLElement;
    const drops = [...card.querySelectorAll('.drop-row')].map((d) => d.textContent);
    expect(drops[0]).toBe(`670${en.dropN(1)}`);
    expect(drops[1]).toBe(`560${en.dropN(2)}`);
    const feet = [...card.querySelectorAll('.set-foot span:first-child')].map((f) => f.textContent);
    expect(feet[0]).toBe(en.dropsFoot(3, 6 + 6 + 5));
    expect(feet[1]).toBe(en.dropsFoot(2, 10));
  });

  it('renders a superset with round-numbered rows, and a circuit as a rounds summary', async () => {
    m.callFn.mockResolvedValue({ workout: workout() });
    const { container } = open();
    await screen.findByText('Barbell Bench Press - Medium Grip');
    const ss = container.querySelector('.ss-block') as HTMLElement;
    expect(within(ss).getByText(en.supersetTag('A'))).toBeTruthy();
    expect(within(ss).getByText(en.circuitNRounds(2))).toBeTruthy();
    const idx = [...ss.querySelectorAll('.idx')].map((i) => i.textContent);
    expect(idx).toEqual(['R1', 'R2', 'R1']);
    const circ = container.querySelector('.circuit-block') as HTMLElement;
    expect(within(circ).getByText(en.circuitTitle('B'))).toBeTruthy();
    expect(circ.querySelector('.cb-meta')?.textContent).toBe(
      `${en.circuitNExercises(2)} · ${en.circuitNRounds(2)}`,
    );
    const plates = [...circ.querySelectorAll('.rplate-v')].map((p) => p.textContent);
    expect(plates).toEqual(['5×100', '5×100', '8×40', '—']);
    const counts = [...circ.querySelectorAll('.cb-scount')].map((p) => p.textContent);
    expect(counts).toEqual([en.circuitNRoundsShort(2, 2), en.circuitNRoundsShort(1, 2)]);
  });

  it('shows the error message when the call fails and nothing is cached', async () => {
    m.callFn.mockRejectedValue(new Error('Not your athlete'));
    open();
    expect(await screen.findByText('Not your athlete')).toBeTruthy();
  });

  it('a failed refresh keeps the recap already on screen', async () => {
    m.callFn.mockResolvedValueOnce({ workout: workout() });
    const { rerender } = open();
    await screen.findByText('Barbell Bench Press - Medium Grip');
    m.callFn.mockRejectedValueOnce(new Error('offline'));
    rerender(
      <TraineeSessionView
        athleteId="a1"
        workoutId="w1"
        athleteName="Ada"
        shell={makeShell()}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText('Barbell Bench Press - Medium Grip')).toBeTruthy();
    expect(screen.queryByText('offline')).toBeNull();
  });

  it('rejects malformed answers instead of rendering them', async () => {
    m.callFn.mockResolvedValue({ workout: { id: 'w1' } });
    open();
    await waitFor(() => expect(m.callFn).toHaveBeenCalled());
    expect(screen.getByText('…')).toBeTruthy();
  });

  it('opening another workout shows its loading state rather than the previous recap', async () => {
    m.callFn.mockResolvedValueOnce({ workout: workout() });
    const { rerender } = open();
    await screen.findByText('Barbell Bench Press - Medium Grip');
    m.callFn.mockReturnValueOnce(new Promise(() => undefined));
    rerender(
      <TraineeSessionView
        athleteId="a1"
        workoutId="w2"
        shell={makeShell()}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByText('Barbell Bench Press - Medium Grip')).toBeNull();
    expect(screen.getByText('…')).toBeTruthy();
  });

  it('a session still in progress has no duration in the header', async () => {
    m.callFn.mockResolvedValue({ workout: { ...workout(), finishedAt: null } });
    const { container } = open();
    await screen.findByText('Barbell Bench Press - Medium Grip');
    expect(container.querySelector('[class*="sub"]')?.textContent).toMatch(/exercises$/);
  });
});
