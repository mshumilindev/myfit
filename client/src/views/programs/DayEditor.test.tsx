import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { DayEditor } from './DayEditor';
import { freshProgram, type Program } from './model';
import { setLocale } from '../../i18n';

let latest: Program;

function program(withWarmupItems: boolean): Program {
  return {
    ...freshProgram('P'),
    dayNames: { '1': 'Upper' },
    items: [
      {
        id: 'wu',
        day: 1,
        position: 0,
        name: 'Warm-up',
        kind: 'warmup',
        sets: 1,
        reps: 0,
        durationMin: null,
        equipment: [],
        ...(withWarmupItems
          ? {
              warmupItems: [
                { id: 'a', name: 'Band Pull Apart', exerciseId: 'Band_Pull_Apart', reps: 15 },
                { id: 'b', name: 'Cat Stretch', exerciseId: 'Cat_Stretch', durationSec: 30 },
              ],
            }
          : {}),
      },
      {
        id: 'l1',
        day: 1,
        position: 1,
        name: 'Barbell Bench Press',
        kind: 'strength',
        sets: 3,
        reps: 8,
        durationMin: null,
        equipment: ['barbell'],
      },
    ],
  };
}

function Harness({ initial }: { initial: Program }) {
  const [p, setP] = useState(initial);
  useEffect(() => {
    latest = p;
  });
  return (
    <DayEditor
      program={p}
      day={1}
      update={(fn) => setP((cur) => fn(cur))}
      shell={{ openOverlay: vi.fn() } as never}
      desktop={false}
      prev={null}
      next={null}
    />
  );
}

const warmItems = () => latest.items.find((i) => i.id === 'wu')!.warmupItems;

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

describe('DayEditor warm-up', () => {
  it('an old program day (warm-up marker, no exercises) still renders as a generic warm-up', () => {
    render(<Harness initial={program(false)} />);
    expect(screen.getByText('marker · nothing to log')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add exercise' })[0]).toBeTruthy();
    expect(screen.getAllByText('Barbell Bench Press').length).toBeGreaterThan(0);
  });

  it('adds an exercise from the whole database as a reference with a target', () => {
    render(<Harness initial={program(false)} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add exercise' })[0]);
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: 'lateral raise' } });
    fireEvent.click(screen.getAllByText(/Lateral Raise/)[0]);
    const items = warmItems()!;
    expect(items).toHaveLength(1);
    expect(items[0].name).toMatch(/Lateral Raise/);
    expect(items[0].exerciseId).toBeTruthy();
    expect(items[0].reps).toBe(12);
    // the warm-up stays a marker: no sets, no extra lift
    expect(latest.items.filter((i) => i.kind === 'strength')).toHaveLength(1);
  });

  it('shows simple target lines (name + target, no tick, no Log); edits through the drawer, removes', () => {
    render(<Harness initial={program(true)} />);
    expect(screen.queryByText('marker · nothing to log')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log' })).toBeNull();
    expect(screen.getByText('15 reps')).toBeTruthy();
    expect(screen.getByText('30 s')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Band Pull Apart' }));
    const input = screen.getByRole('textbox', { name: 'Reps' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(warmItems()![0].reps).toBe(20);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Cat Stretch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from warm-up' }));
    expect(warmItems()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Band Pull Apart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from warm-up' }));
    expect(warmItems()).toBeUndefined();
  });
});
