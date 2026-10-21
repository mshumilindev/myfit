import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import type { LiveSession } from '../types';
import { TrainerLiveBanner } from './TrainerLiveBanner';

// Wednesday 14 Oct 2026, 18:00:00 local.
const NOW = new Date(2026, 9, 14, 18, 0, 0).getTime();
const MIN = 60000;

const live = (o: Partial<LiveSession> = {}): LiveSession => ({
  id: 'u1',
  workoutId: 'w1',
  athleteName: 'Anna Kowalska',
  trainerId: 't1',
  startedAt: NOW - 25 * MIN,
  updatedAt: NOW - 5000,
  exerciseCount: 3,
  ...o,
});
const shell = () =>
  ({ openOverlay: vi.fn() }) as unknown as Shell & { openOverlay: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TrainerLiveBanner', () => {
  it('renders nothing when nobody is training', () => {
    const { container } = render(<TrainerLiveBanner trainees={[]} shell={shell()} />);
    expect(container.innerHTML).toBe('');
    cleanup();
    // a finished session older than the 5 min linger is dropped too
    const old = live({ finishedAt: NOW - 6 * MIN });
    const r = render(<TrainerLiveBanner trainees={[old]} shell={shell()} />);
    expect(r.container.innerHTML).toBe('');
  });

  it('shows a live athlete: initials, start clock, exercises, timer and the previous session', () => {
    const { container } = render(
      <TrainerLiveBanner
        trainees={[
          live({
            gymName: 'Smartfit',
            lastName: 'Push day',
            lastSets: 18,
            lastTonnageKg: 9500,
            lastAt: new Date(2026, 9, 11).getTime(),
          }),
        ]}
        shell={shell()}
      />,
    );
    expect(screen.getByText('Your athletes')).toBeTruthy();
    expect(screen.getByText('1 training now')).toBeTruthy();
    expect(container.querySelector('.trlive-ava-lg')!.textContent).toBe('AK');
    expect(container.querySelector('.trlive-lbl')!.textContent).toBe('Training now · Smartfit');
    expect(container.querySelector('.trlive-since')!.textContent).toBe(
      'Started 17:35 · 3 exercises in',
    );
    expect(container.querySelector('.trlive-timer')!.textContent).toBe('25:00');
    const last = container.querySelector('.trlive-last')!.textContent!;
    expect(last).toContain('Last Push day · 18 sets · 9.5 t');
    expect(last).toContain('Oct 11');
    expect(last).toContain('View');
  });

  it('ticks the timer every second', () => {
    const { container } = render(<TrainerLiveBanner trainees={[live()]} shell={shell()} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.querySelector('.trlive-timer')!.textContent).toBe('25:03');
  });

  it('says reconnecting and mutes the timer when the heartbeat is older than 90 s', () => {
    const { container } = render(
      <TrainerLiveBanner trainees={[live({ updatedAt: NOW - 120_000 })]} shell={shell()} />,
    );
    expect(container.querySelector('.trlive-lbl')!.textContent).toBe('Connection lost');
    expect(container.querySelector('.trlive-since')!.textContent).toBe('reconnecting…');
    expect(container.querySelector('.trlive-timer')!.className).toContain('muted');
    // a lost connection is not "finished": the athlete still counts as training
    expect(screen.getByText('1 training now')).toBeTruthy();
  });

  it('shows the first-session note when there is no previous workout', () => {
    render(<TrainerLiveBanner trainees={[live({ athleteName: 'Madonna' })]} shell={shell()} />);
    expect(screen.getByText('First tracked session')).toBeTruthy();
    expect(document.querySelector('.trlive-ava-lg')!.textContent).toBe('MA');
  });

  it('falls back to a dash when the last session has sets but no name, and no date when missing', () => {
    render(
      <TrainerLiveBanner trainees={[live({ lastSets: 4, lastTonnageKg: 800 })]} shell={shell()} />,
    );
    const last = document.querySelector('.trlive-last')!.textContent!;
    expect(last).toContain('Last — · 4 sets · 0.8 t');
  });

  it('keeps a just-finished session with its final totals and opens the recap', () => {
    const sh = shell();
    const { container } = render(
      <TrainerLiveBanner
        trainees={[live({ finishedAt: NOW - MIN, finalSets: 20, finalTonnageKg: 12000 })]}
        shell={sh}
      />,
    );
    expect(container.querySelector('.trlive-lbl')!.textContent).toBe('Finished');
    expect(container.querySelector('.trlive-timer')!.textContent).toBe('24:00');
    const last = container.querySelector('.trlive-last')!;
    expect(last.textContent).toContain('20 sets · 12.0 t');
    expect(last.textContent).toContain('View recap');
    expect(screen.queryByText(/training now/)).toBeNull();
    fireEvent.click(last);
    expect(sh.openOverlay).toHaveBeenCalledWith({
      screen: 'trainee-session',
      athleteId: 'u1',
      workoutId: 'w1',
      athleteName: 'Anna Kowalska',
    });
  });

  it('finished sessions without totals fall back to the exercise count, and without a workout open the profile', () => {
    const sh = shell();
    render(
      <TrainerLiveBanner
        trainees={[live({ workoutId: undefined, finishedAt: NOW - MIN, exerciseCount: 5 })]}
        shell={sh}
      />,
    );
    expect(document.querySelector('.trlive-last')!.textContent).toContain('5 sets · 0.0 t');
    fireEvent.click(document.querySelector('.trlive-row')!);
    expect(sh.openOverlay).toHaveBeenCalledWith({ screen: 'profile', userId: 'u1' });
  });

  it('opens the profile from the avatar button and from a live session', () => {
    const sh = shell();
    render(<TrainerLiveBanner trainees={[live()]} shell={sh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    expect(sh.openOverlay).toHaveBeenLastCalledWith({ screen: 'profile', userId: 'u1' });
    fireEvent.click(document.querySelector('.trlive-last')!);
    expect(sh.openOverlay).toHaveBeenLastCalledWith({ screen: 'profile', userId: 'u1' });
  });

  it('puts the freshest live athlete big and the rest as rows, finished ones last', () => {
    const sh = shell();
    const trainees = [
      live({ id: 'old', athleteName: 'Bob Old', startedAt: NOW - 50 * MIN }),
      live({
        id: 'fin',
        athleteName: 'Cara Done',
        finishedAt: NOW - 2 * MIN,
        startedAt: NOW - 5 * MIN,
      }),
      live({ id: 'new', athleteName: 'Dan New', startedAt: NOW - 10 * MIN, gymName: 'Iron' }),
    ];
    const { container } = render(<TrainerLiveBanner trainees={trainees} shell={sh} />);
    expect(container.querySelector('.trlive-name')!.textContent).toBe('Dan New');
    expect(screen.getByText('2 training now')).toBeTruthy();
    expect(screen.getByText('Also training')).toBeTruthy();
    const rows = [...container.querySelectorAll('.trlive-crow')];
    expect(rows.map((r) => r.querySelector('.trlive-cname')!.textContent)).toEqual([
      'Bob Old',
      'Cara Done',
    ]);
    expect(rows[0].querySelector('.trlive-csub')!.textContent).toBe('Training now');
    expect(rows[1].querySelector('.trlive-csub')!.textContent).toBe('Finished');
    expect(rows[0].querySelector('.trlive-ctimer')!.textContent).toBe('50:00');
    fireEvent.click(rows[1]);
    expect(sh.openOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'trainee-session', athleteId: 'fin' }),
    );
  });

  it('shows an offline compact row with gym name and muted timer, and counts both as still training', () => {
    const trainees = [
      live({
        id: 'a',
        athleteName: 'Eve Away',
        updatedAt: NOW - 200_000,
        gymName: 'Iron',
        startedAt: NOW - 10 * MIN,
      }),
      live({
        id: 'b',
        athleteName: 'Fay Away',
        updatedAt: NOW - 200_000,
        startedAt: NOW - 20 * MIN,
      }),
    ];
    const { container } = render(<TrainerLiveBanner trainees={trainees} shell={shell()} />);
    expect(screen.getByText('2 training now')).toBeTruthy();
    const row = container.querySelector('.trlive-crow') as HTMLElement;
    expect(row.querySelector('.trlive-csub')!.textContent).toBe('Connection lost');
    expect(row.querySelector('.trlive-ctimer')!.className).toContain('muted');
  });

  it('survives an empty athlete name', () => {
    render(<TrainerLiveBanner trainees={[live({ athleteName: '   ' })]} shell={shell()} />);
    expect(document.querySelector('.trlive-ava-lg')!.textContent).toBe('·');
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
