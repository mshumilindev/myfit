/**
 * The Programs page (host of the program editor tool, mode `self`). Ported from the legacy ProgramBuilder tests:
 * week step -> weekday toggles + day cards, review -> activities on rest days. See docs/PROGRAM-EDITOR-TOOL.md
 * ("What changed when the builder moved onto the tool") for the behaviour that was intentionally dropped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setViewport } from '../../coach/testViewport';
import { setLocale } from '../../i18n';
import { pgEn } from '../../i18n/coachProgram.en';
import { freshProgram, type Program } from './model';
import { ProgramPage } from './ProgramPage';

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

const mount = (over: Partial<Parameters<typeof ProgramPage>[0]> = {}) =>
  render(
    <ProgramPage
      initial={prog()}
      saved
      library={[]}
      shell={{ openOverlay: vi.fn() } as never}
      onClose={vi.fn()}
      onSaved={() => undefined}
      onDeleted={() => undefined}
      {...over}
    />,
  );

const toggles = () => screen.getAllByRole('button', { name: /^Train on / });
const tabs = () => screen.getAllByRole('tab');

beforeEach(() => {
  setLocale('en');
  setViewport(1440);
});
afterEach(cleanup);

describe('Programs page: the week (was: builder week step)', () => {
  it('shows each training day as a card with its name, the other weekdays as unpressed toggles', () => {
    mount();
    expect(screen.getByRole('tab', { name: /Upper A/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Lower A/ })).toBeTruthy();
    expect(tabs()).toHaveLength(2);
    const pressed = toggles().filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(toggles()).toHaveLength(7);
    expect(pressed).toHaveLength(2);
    // the other five weekdays are rest days
    expect(toggles().filter((b) => b.getAttribute('aria-pressed') === 'false')).toHaveLength(5);
  });

  it('turns a rest day into a training day from its toggle', () => {
    mount();
    const rest = toggles().filter((b) => b.getAttribute('aria-pressed') === 'false');
    fireEvent.click(rest[0]);
    expect(toggles().filter((b) => b.getAttribute('aria-pressed') === 'false')).toHaveLength(4);
    expect(tabs()).toHaveLength(3);
  });

  it('asks before a day with exercises becomes a rest day; Keep leaves it, Make rest day clears it', () => {
    mount();
    const monday = screen.getByRole('button', { name: 'Train on Monday' });
    fireEvent.click(monday);
    expect(screen.getByText('Make Monday a rest day?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(tabs()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Train on Monday' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make rest day' }));
    expect(tabs()).toHaveLength(1);
    expect(screen.queryByRole('tab', { name: /Upper A/ })).toBeNull();
  });
});

describe('Programs page: review (was: builder review step)', () => {
  it('lists planned activities under their day, rest days included', () => {
    mount();
    expect(screen.getByText(/Run · 20 min/)).toBeTruthy();
  });

  it('says what is missing before the program can be activated, and names the day', () => {
    mount({ initial: { ...prog(), status: 'draft', dayNames: { '1': 'Upper A', '3': '' } } });
    // Wednesday has an exercise but no name
    expect(screen.getAllByText('Name Wednesday').length).toBeGreaterThan(0);
  });
});

describe('Programs page: leaving and read only', () => {
  it('an unchanged program leaves straight away; a changed one asks first (Keep stays)', () => {
    const onClose = vi.fn();
    mount({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /Programs/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Train on Tuesday' }));
    fireEvent.click(screen.getByRole('button', { name: /Programs/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Discard changes?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });

  it("a trainer's program is view only: no weekday toggles, no save, no menu", () => {
    mount({ readOnly: true });
    expect(screen.queryByRole('button', { name: /^Train on / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: /options/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /Upper A/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: pgEn.edUndo })).toBeNull();
  });
});

describe('Programs page on a phone', () => {
  it('is the same page: week toggles, day cards and the editor sheet', () => {
    setViewport(390);
    mount();
    expect(toggles()).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: /Barbell Bench Press/ }));
    expect(screen.getByRole('button', { name: pgEn.edDone })).toBeTruthy();
  });
});
