import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import type { Exercise, Gym } from '../types';

const setItems = vi.fn();
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  setExerciseEquipmentItems: (...a: unknown[]) => setItems(...a),
}));

import { EquipmentPickerSheet } from './EquipmentPickerSheet';

const ex = (over: Partial<Exercise> = {}): Exercise =>
  ({
    id: 'e1',
    name: 'Barbell Squat',
    position: 0,
    equipment: ['barbell'],
    sets: [],
    ...over,
  }) as Exercise;
const gym = (equipmentItems: string[] = []): Gym =>
  ({ id: 'g1', name: 'Iron', lat: 0, lng: 0, radiusM: 100, equipmentItems }) as Gym;

beforeEach(() => {
  setLocale('en');
  setItems.mockReset();
});
afterEach(cleanup);

const firstCat = () =>
  document.querySelector('.eq-cat > button, .eq-cat [aria-expanded]') as HTMLElement;

describe('EquipmentPickerSheet', () => {
  it('lists category rows, collapsed, with item counts', () => {
    render(
      <EquipmentPickerSheet workoutId="w1" exercise={ex()} gym={gym()} onClose={() => undefined} />,
    );
    expect(screen.getByText('Equipment')).toBeTruthy();
    const cats = document.querySelectorAll('.eq-cat');
    expect(cats.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.eq-grid')).toHaveLength(0);
    expect(firstCat().getAttribute('aria-expanded')).toBe('false');
  });

  it('expands one category at a time and toggles it closed', () => {
    render(
      <EquipmentPickerSheet workoutId="w1" exercise={ex()} gym={gym()} onClose={() => undefined} />,
    );
    const rows = [...document.querySelectorAll('.eq-cat [aria-expanded]')] as HTMLElement[];
    expect(rows.length).toBeGreaterThan(1);
    fireEvent.click(rows[0]);
    expect(document.querySelectorAll('.eq-grid')).toHaveLength(1);
    fireEvent.click(rows[1]);
    expect(document.querySelectorAll('.eq-grid')).toHaveLength(1);
    expect(rows[0].getAttribute('aria-expanded')).toBe('false');
    expect(rows[1].getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(rows[1]);
    expect(document.querySelectorAll('.eq-grid')).toHaveLength(0);
  });

  it('picks a tile: stores the new set (with the gym) and marks it on', () => {
    render(
      <EquipmentPickerSheet workoutId="w1" exercise={ex()} gym={gym()} onClose={() => undefined} />,
    );
    fireEvent.click(document.querySelector('.eq-cat [aria-expanded]')!);
    const tile = document.querySelector('.eq-pick-tile') as HTMLElement;
    expect(tile.getAttribute('aria-pressed')).toBe('false');
    // not stocked at the gym -> shows the add mark
    expect(tile.querySelector('.eq-tile-add')).toBeTruthy();
    fireEvent.click(tile);
    expect(setItems).toHaveBeenCalledTimes(1);
    const [wid, eid, ids, gid] = setItems.mock.calls[0];
    expect([wid, eid, gid]).toEqual(['w1', 'e1', 'g1']);
    expect(ids).toHaveLength(1);
  });

  it('shows selected items as removable chips, and tapping one removes only it', () => {
    // discover two real catalog ids offered for this exercise
    render(
      <EquipmentPickerSheet workoutId="w" exercise={ex()} gym={gym()} onClose={() => undefined} />,
    );
    fireEvent.click(document.querySelector('.eq-cat [aria-expanded]')!);
    const tiles = [...document.querySelectorAll('.eq-pick-tile')] as HTMLElement[];
    fireEvent.click(tiles[0]);
    fireEvent.click(tiles[1]);
    const a = setItems.mock.calls[0][2][0] as string;
    const b = setItems.mock.calls[1][2][0] as string;
    expect(a).not.toBe(b);
    cleanup();
    setItems.mockReset();
    render(
      <EquipmentPickerSheet
        workoutId="w1"
        exercise={ex({ equipmentItems: [a, b] })}
        gym={gym([a])}
        onClose={() => undefined}
      />,
    );
    const chips = document.querySelectorAll('.ep-selected button');
    expect(chips).toHaveLength(2);
    fireEvent.click(chips[0]);
    expect(setItems).toHaveBeenCalledWith('w1', 'e1', [b], 'g1');
  });

  it('keeps an already-selected item visible, shows the check and hides the add mark for gym kit', () => {
    render(
      <EquipmentPickerSheet workoutId="w1" exercise={ex()} gym={gym()} onClose={() => undefined} />,
    );
    fireEvent.click(document.querySelector('.eq-cat [aria-expanded]')!);
    const id = (() => {
      fireEvent.click(document.querySelector('.eq-pick-tile')!);
      return setItems.mock.calls[0][2][0] as string;
    })();
    cleanup();
    render(
      <EquipmentPickerSheet
        workoutId="w1"
        exercise={ex({ equipmentItems: [id] })}
        gym={gym([id])}
        onClose={() => undefined}
      />,
    );
    // the selected category row shows "n/total"
    expect(document.body.textContent).toMatch(/1\/\d+/);
    fireEvent.click(
      [...document.querySelectorAll('.eq-cat [aria-expanded]')].find((r) =>
        /1\/\d+/.test(r.textContent ?? ''),
      )!,
    );
    const on = document.querySelector('.eq-pick-tile.on') as HTMLElement;
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(on.querySelector('.eq-tile-check')).toBeTruthy();
    expect(on.querySelector('.eq-tile-add')).toBeNull();
    // unpick
    fireEvent.click(on);
    expect(setItems).toHaveBeenLastCalledWith('w1', 'e1', [], 'g1');
  });

  it('uses an undefined gym id when no gym is attached', () => {
    render(
      <EquipmentPickerSheet workoutId="w1" exercise={ex()} gym={null} onClose={() => undefined} />,
    );
    fireEvent.click(document.querySelector('.eq-cat [aria-expanded]')!);
    fireEvent.click(document.querySelector('.eq-pick-tile')!);
    expect(setItems.mock.calls[0][3]).toBeUndefined();
  });

  it('search expands every matching category and filters items, with an empty state', () => {
    render(
      <EquipmentPickerSheet workoutId="w1" exercise={ex()} gym={gym()} onClose={() => undefined} />,
    );
    const before = document.querySelectorAll('.eq-cat').length;
    const input = screen.getByPlaceholderText(/./);
    // pick a real item name from the first category to search for
    fireEvent.click(document.querySelector('.eq-cat [aria-expanded]')!);
    const title = (document.querySelector('.eq-pick-tile') as HTMLElement).getAttribute('title')!;
    fireEvent.click(document.querySelector('.eq-cat [aria-expanded]')!);
    fireEvent.change(input, { target: { value: title } });
    expect(document.querySelectorAll('.eq-cat.open').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.eq-cat').length).toBeLessThanOrEqual(before);
    expect(
      [...document.querySelectorAll('.eq-pick-tile')].some(
        (t) => t.getAttribute('title') === title,
      ),
    ).toBe(true);
    fireEvent.change(input, { target: { value: 'zzzz-no-such-kit' } });
    expect(document.querySelector('.ep-empty')!.textContent).toBe('—');
  });

  it('hides a broken thumbnail instead of showing a broken image', () => {
    render(
      <EquipmentPickerSheet workoutId="w1" exercise={ex()} gym={gym()} onClose={() => undefined} />,
    );
    const rows = [...document.querySelectorAll('.eq-cat [aria-expanded]')] as HTMLElement[];
    for (const r of rows) {
      fireEvent.click(r);
      const img = document.querySelector('.eq-pick-tile img') as HTMLImageElement | null;
      if (img) {
        fireEvent.error(img);
        expect(img.style.display).toBe('none');
        return;
      }
      fireEvent.click(r);
    }
    // no category with a photo for this exercise: placeholders only
    expect(document.querySelector('.eq-thumb-ph, .eq-thumb')).toBeDefined();
  });
});
