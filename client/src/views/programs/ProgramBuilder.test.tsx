import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProgramBuilder } from './ProgramBuilder';
import { freshProgram, type Program } from './model';
import { setLocale } from '../../i18n';

const prog = (): Program => ({
  ...freshProgram('P'),
  dayNames: { '1': 'Upper A', '3': 'Lower A' },
  items: [
    {
      id: 'a',
      day: 1,
      position: 0,
      name: 'Barbell Bench Press',
      kind: 'strength',
      sets: 3,
      reps: 8,
      durationMin: null,
      equipment: [],
    },
    {
      id: 'b',
      day: 3,
      position: 0,
      name: 'Barbell Squat',
      kind: 'strength',
      sets: 3,
      reps: 8,
      durationMin: null,
      equipment: [],
    },
  ],
  activities: [{ id: 'x', day: 2, type: 'run', minutes: 20, effort: 'light', when: 'after' }],
});

const mount = (step: 'week' | 'review') =>
  render(
    <ProgramBuilder
      initial={prog()}
      saved
      startStep={step}
      library={[]}
      shell={{ openOverlay: vi.fn() } as never}
      onClose={() => undefined}
      onSaved={() => undefined}
      onDeleted={() => undefined}
    />,
  );

beforeEach(() => {
  setLocale('en');
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe('ProgramBuilder week step (design: Builder-Week)', () => {
  it('shows each training day as a tile with its name, rest days as Rest', () => {
    mount('week');
    expect(screen.getByText('Upper A')).toBeTruthy();
    expect(screen.getByText('Lower A')).toBeTruthy();
    expect(screen.getAllByText('Rest').length).toBe(5);
  });

  it('turns a rest day into a training day from its checkbox', () => {
    mount('week');
    const before = screen.getAllByText('Rest').length;
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getAllByText('Rest').length).toBe(before - 1);
  });
});

describe('ProgramBuilder review', () => {
  it('lists planned activities under their day, rest days included', () => {
    mount('review');
    expect(screen.getByText(/Run · 20 min/)).toBeTruthy();
  });
});
