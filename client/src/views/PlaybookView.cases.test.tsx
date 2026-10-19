import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PlaybookView } from './PlaybookView';
import { __getStateForTests } from '../store';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import {
  emptyState,
  freezeClock,
  makeShell,
  NOW,
  richState,
  seed,
  stalled,
} from './__fixtures__/viewKit';

function stand(at: 'gym' | 'nowhere') {
  localStorage.removeItem('spotter.lastPos');
  if (at === 'gym')
    localStorage.setItem(
      'spotter.lastPos',
      JSON.stringify({ lat: 1, lng: 1, accuracy: 10, at: NOW }),
    );
}

beforeEach(() => {
  freezeClock();
  setLocale('en');
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe('PlaybookView', () => {
  it('with no finished sessions shows the empty explanation and no repeat strip', () => {
    seed(emptyState());
    render(<PlaybookView shell={makeShell()} />);
    expect(screen.getByText(en.playEmpty)).toBeTruthy();
    expect(screen.queryByText(en.playRepeatTitle)).toBeNull();
  });

  it('learns one play per recurring day with set x rep schemes and the last top weight', () => {
    const { container } = render(<PlaybookView shell={makeShell()} />);
    expect(screen.getByText(en.playbookSubtitle(3))).toBeTruthy();
    const plays = container.querySelectorAll('section.pb-play');
    expect(plays.length).toBe(3);
    const names = [...container.querySelectorAll('.pb-play-name')].map((e) => e.textContent);
    expect(names.sort()).toEqual(['Legs', 'Pull', 'Push']);
    const push = [...plays].find((p) => p.querySelector('.pb-play-name')?.textContent === 'Push')!;
    expect(within(push as HTMLElement).getByText('Barbell Bench Press - Medium Grip')).toBeTruthy();
    expect(push.querySelector('.pb-ex-scheme')?.textContent).toMatch(/^\d+ × \d+/);
    // the latest bench top set of the fixture: 70 + 10 weeks * 1.25 = 82.5 kg
    expect(push.querySelector('.pb-ex-wt')?.textContent).toBe('83 kg');
    expect(push.querySelector('.pb-cover')).toBeTruthy();
  });

  it('shows a dash for bodyweight lifts with no logged weight', () => {
    const { container } = render(<PlaybookView shell={makeShell()} />);
    const pull = [...container.querySelectorAll('section.pb-play')].find(
      (p) => p.querySelector('.pb-play-name')?.textContent === 'Pull',
    )!;
    const rows = [...pull.querySelectorAll('.pb-ex')];
    const pullups = rows.find((r) => r.textContent?.includes('Pullups'))!;
    expect(pullups.querySelector('.pb-ex-wt')?.textContent).toBe('—');
  });

  it('starts a play at once when you stand inside a saved gym and opens that session', async () => {
    stand('gym');
    const shell = makeShell();
    const { container } = render(<PlaybookView shell={shell} />);
    const push = [...container.querySelectorAll('section.pb-play')].find(
      (p) => p.querySelector('.pb-play-name')?.textContent === 'Push',
    )!;
    const before = __getStateForTests().workouts.length;
    fireEvent.click(within(push as HTMLElement).getByRole('button', { name: en.playStart }));
    await waitFor(() => expect(shell.openOverlay).toHaveBeenCalled());
    const after = __getStateForTests();
    expect(after.workouts.length).toBe(before + 1);
    const started = after.workouts.find((w) => w.finishedAt === null)!;
    expect(started.gymId).toBe('g1');
    expect(started.dayName).toBe('Push');
    expect(started.exercises.map((e) => e.name)).toContain('Barbell Bench Press - Medium Grip');
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: started.id });
  });

  it('asks which gym when the position is unknown, then starts there', async () => {
    stand('nowhere');
    const shell = makeShell();
    const { container } = render(<PlaybookView shell={shell} />);
    fireEvent.click(
      within(container.querySelector('section.pb-play') as HTMLElement).getByRole('button', {
        name: en.playStart,
      }),
    );
    expect(await screen.findByText(en.pickGymTitle)).toBeTruthy();
    expect(shell.openOverlay).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByText('Home Rack'));
    await waitFor(() => expect(shell.openOverlay).toHaveBeenCalled());
    expect(__getStateForTests().workouts.find((w) => w.finishedAt === null)?.gymId).toBe('g2');
  });

  it('repeats a recent session: a new live workout with the same exercises', () => {
    const shell = makeShell();
    const { container } = render(<PlaybookView shell={shell} />);
    expect(screen.getByText(en.playRepeatTitle)).toBeTruthy();
    const rows = container.querySelectorAll('.pb-recent-list button');
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);
    const live = __getStateForTests().workouts.find((w) => w.finishedAt === null)!;
    expect(live.exercises.length).toBeGreaterThan(0);
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: live.id });
  });

  it('a muscle chip opens the muscle drawer, whose action opens that muscle history', async () => {
    const shell = makeShell();
    const { container } = render(<PlaybookView shell={shell} />);
    const chip = container.querySelector(
      '.pb-cover-row .chip, .pb-cover-row [role="button"], .pb-cover-row button',
    ) as HTMLElement;
    fireEvent.click(chip);
    // the chip opens the muscle drawer first; its action button leads to the history
    const action = await screen.findByRole('button', { name: /history/i });
    fireEvent.click(action);
    expect(shell.openOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'muscle-history' }),
    );
  });

  it('embedded mode renders only the body (no page chrome, no gym picker host)', () => {
    const { container } = render(<PlaybookView shell={makeShell()} embedded />);
    expect(container.querySelector('.playbook-tab')).toBeNull();
    expect(container.querySelector('.pb-body')).toBeTruthy();
  });

  it('flags lifts a chronic condition asks you to take care with', () => {
    const base = __getStateForTests();
    seed({
      ...base,
      conditions: [
        { id: 'c1', key: 'back_lumbar_disc', severity: 2, share: 'off', createdAt: NOW },
      ],
    });
    const { container } = render(<PlaybookView shell={makeShell()} />);
    const legs = [...container.querySelectorAll('section.pb-play')].find(
      (p) => p.querySelector('.pb-play-name')?.textContent === 'Legs',
    )!;
    expect(legs.querySelectorAll('.pg-care').length).toBeGreaterThan(0);
  });

  it('names unnamed plays from the muscle mix and titles recent rows from the same readout', () => {
    const base = richState();
    seed({ ...base, workouts: base.workouts.map((w) => ({ ...w, dayName: undefined })) });
    const { container } = render(<PlaybookView shell={makeShell()} />);
    const names = [...container.querySelectorAll('.pb-play-name')].map((e) => e.textContent ?? '');
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n.length).toBeGreaterThan(0);
    const titles = [
      ...container.querySelectorAll('.pb-recent-list .list-row, .pb-recent-list button'),
    ];
    expect(titles.length).toBeGreaterThan(0);
  });

  it('offers a plateau swap idea for a stalled core lift', () => {
    seed(stalled(richState()));
    const { container } = render(<PlaybookView shell={makeShell()} />);
    const ideas = [
      ...container.querySelectorAll('.pb-ideas .chip, .pb-ideas > *:not(.pb-ideas-label)'),
    ];
    expect(ideas.length).toBeGreaterThan(0);
  });

  it('shows a range scheme when reps vary and a single number when they do not', () => {
    const base = richState();
    // Make every Push bench set exactly 5 reps so the scheme collapses to "N × 5".
    seed({
      ...base,
      workouts: base.workouts.map((w) => ({
        ...w,
        exercises: w.exercises.map((e) =>
          e.name.startsWith('Barbell Bench')
            ? { ...e, sets: e.sets.map((x) => ({ ...x, reps: 5 })) }
            : e.name.startsWith('Barbell Shoulder')
              ? { ...e, sets: e.sets.map((x, i) => ({ ...x, reps: i % 2 ? 12 : 5 })) }
              : e,
        ),
      })),
    });
    const { container } = render(<PlaybookView shell={makeShell()} />);
    const bench = [...container.querySelectorAll('.pb-ex')].find((r) =>
      r.textContent?.includes('Bench'),
    )!;
    expect(bench.querySelector('.pb-ex-scheme')?.textContent).toMatch(/^\d+ × 5$/);
    const other = [...container.querySelectorAll('.pb-ex-scheme')].map((e) => e.textContent ?? '');
    expect(other).toContain('3 × 5–12');
  });
});
