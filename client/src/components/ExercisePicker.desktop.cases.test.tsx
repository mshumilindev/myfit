import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LOCALES, setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { FAMILIES } from '../picker';
import type { Gym, Workout } from '../types';
import { ExercisePicker, type ExercisePickerProps } from './ExercisePicker';

const en = () => LOCALES.en;
const NOW = new Date(2026, 8, 15, 12, 0).getTime();

function mql(desktop: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: desktop && q.includes('min-width'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never;
}
const workout = (over: Partial<Workout> = {}): Workout => ({
  id: 'cur',
  startedAt: NOW - 600000,
  finishedAt: null,
  autoFinished: false,
  exercises: [],
  ...over,
});
const gym = (inventory?: string[]): Gym =>
  ({ id: 'g1', name: 'Iron', lat: 0, lng: 0, radiusM: 100, inventory }) as Gym;

function setup(over: Partial<ExercisePickerProps> = {}) {
  const props = {
    workout: workout(),
    gym: null,
    onPick: vi.fn(),
    onMarker: vi.fn(),
    onCardio: vi.fn(),
    onCreate: vi.fn(),
    onClose: vi.fn(),
    ...over,
  } as ExercisePickerProps &
    Record<'onPick' | 'onMarker' | 'onCardio' | 'onCreate' | 'onClose', ReturnType<typeof vi.fn>>;
  const view = render(<ExercisePicker {...props} />);
  return { ...props, ...view };
}

beforeEach(() => {
  setLocale('en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  __replaceStateForTests({ ...__getStateForTests(), workouts: [] } as never);
  mql(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ExercisePicker · desktop modal', () => {
  it('renders a labelled modal in the body with the family rail, a grid and a live preview', () => {
    setup();
    const dlg = screen.getByRole('dialog', { name: en().addExercise });
    expect(dlg.parentElement!.parentElement).toBe(document.body);
    expect(within(dlg).getByRole('navigation', { name: en().pickMuscleGroups })).toBeTruthy();
    expect(dlg.querySelectorAll('.xp-rail-group')).toHaveLength(FAMILIES.length);
    expect(dlg.querySelectorAll('.xp-grid .xp-card').length).toBeGreaterThan(0);
    expect(dlg.querySelector('.xp-preview .xp-detail.compact')).toBeTruthy();
  });

  it('warm-up uses its own label', () => {
    setup({ warmup: true });
    expect(screen.getByRole('dialog', { name: en().wuPickTitle })).toBeTruthy();
  });

  it('the rail opens a family and reveals its sub-muscles', () => {
    setup();
    fireEvent.click(document.querySelectorAll('.xp-rail-fam')[3]); // arms
    const open = document.querySelectorAll('.xp-rail-group')[3];
    expect(open.querySelectorAll('.xp-rail-sub').length).toBeGreaterThan(1);
    fireEvent.click(open.querySelectorAll('.xp-rail-sub')[1]);
    expect(document.querySelector('.xp-ghead-title b .sep')).toBeTruthy();
  });

  it('hovering a card previews it; the info button too; Enter adds the previewed exercise', () => {
    const p = setup();
    const cards = document.querySelectorAll('.xp-grid .xp-card');
    fireEvent.mouseEnter(cards[2]);
    const previewName = () => document.querySelector('.xp-preview .xp-detail-name')!.textContent;
    expect(previewName()).toBe(cards[2].querySelector('.xp-card-name')!.textContent);
    expect(cards[2].classList.contains('sel')).toBe(true);
    fireEvent.click(cards[4].querySelector('.xp-info') as HTMLElement);
    expect(previewName()).toBe(cards[4].querySelector('.xp-card-name')!.textContent);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(p.onPick).toHaveBeenCalledTimes(1);
    expect(p.onPick.mock.calls[0][0].name).toBe(previewName());
  });

  it('arrow keys walk the grid; they stop at both ends', () => {
    setup();
    const cards = () => [...document.querySelectorAll('.xp-grid .xp-card')];
    const sel = () => cards().findIndex((c) => c.classList.contains('sel'));
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const start = sel();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(sel()).toBe(start + 1);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(sel()).toBe(0);
  });

  it('"/" focuses the search; Escape clears typed text first, then closes', () => {
    const p = setup();
    const input = screen.getByPlaceholderText(en().pickSearch) as HTMLInputElement;
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'squat' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(p.onClose).not.toHaveBeenCalled();
    input.blur();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it('typing shows results, arrow keys walk them and Enter in the box adds the highlighted one', () => {
    const p = setup();
    const input = screen.getByPlaceholderText(en().pickSearch);
    fireEvent.change(input, { target: { value: 'squat' } });
    expect(document.querySelector('.xp-results')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const hi = document.querySelector('.xp-row.sel .xp-row-name')!.textContent;
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(p.onPick.mock.calls[0][0].name).toBe(hi);
  });

  it('the close button and a backdrop press close; a press inside does not', () => {
    const p = setup();
    fireEvent.mouseDown(document.querySelector('.xp-modal') as HTMLElement);
    expect(p.onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.querySelector('.xp-modal-back') as HTMLElement);
    expect(p.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: en().cancel }));
    expect(p.onClose).toHaveBeenCalledTimes(2);
  });

  it('the equipment chip in the group header opens the filter', () => {
    setup({ gym: gym(['barbell']) });
    fireEvent.click(screen.getByRole('button', { name: en().pickEquipAll }));
    expect(document.querySelector('.xp-equip-sheet')).toBeTruthy();
  });

  it('pages the grid with a Show more button', () => {
    setup();
    const before = document.querySelectorAll('.xp-grid .xp-card').length;
    fireEvent.click(screen.getByRole('button', { name: /Show \d+ more/ }));
    expect(document.querySelectorAll('.xp-grid .xp-card').length).toBeGreaterThan(before);
  });
});
