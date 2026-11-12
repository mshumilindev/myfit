/** Planner's Availability is a module of Planner and starts off: while it is off nothing of it shows and nothing is shared. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { addonsPref, disableAddons } from '../addons/enabledSet';
import { ADDONS } from '../addons/manifest';
import { plannerAvailabilityAvailable } from '../addons/featureGates';
import { buildCoachAvailability } from './coachView';

vi.mock('./sync', () => ({
  usePlans: () => [],
  usePrefs: () => ({
    availability: { 0: [[1080, 1260]] },
    shareAvailability: true,
    defaults: { lead: 60, mode: 'quiet', durationMin: 60 },
  }),
  savePrefs: vi.fn(),
  savePlan: vi.fn(),
  deletePlan: vi.fn(),
}));

import { PlannerPage } from './PlannerPage';

afterEach(cleanup);
beforeEach(() => addonsPref.set(['planner']));

describe('Availability module: manifest and gate', () => {
  it('is a module of Planner and is not a store item of its own', () => {
    const m = ADDONS.find((a) => a.id === 'planner-availability');
    expect(m).toMatchObject({ kind: 'module', parent: 'planner' });
  });

  it('is off until switched on, then on; off again when Planner goes', () => {
    expect(plannerAvailabilityAvailable()).toBe(false);
    addonsPref.set(['planner', 'planner-availability']);
    expect(plannerAvailabilityAvailable()).toBe(true);
    disableAddons(['planner']);
    expect(plannerAvailabilityAvailable()).toBe(false);
  });
});

describe('Availability module off', () => {
  it('shows no Availability row and cannot open the screen', () => {
    render(<PlannerPage onClose={() => {}} />);
    expect(screen.queryByText('My availability')).toBeNull();
    expect(screen.queryByText('Weekly hours')).toBeNull();
  });

  it('shows the row and opens the screen once on', () => {
    addonsPref.set(['planner', 'planner-availability']);
    render(<PlannerPage onClose={() => {}} />);
    fireEvent.click(screen.getAllByText('My availability')[0]);
    expect(screen.getByText('Weekly hours')).toBeTruthy();
  });

  it('closes an open screen when the module is switched off', () => {
    addonsPref.set(['planner', 'planner-availability']);
    render(<PlannerPage onClose={() => {}} />);
    fireEvent.click(screen.getAllByText('My availability')[0]);
    addonsPref.set(['planner']);
    return screen.findByText('No plans yet');
  });
});

describe('Availability module and the trainer view', () => {
  it('the coach view is empty when sharing is off (the boot passes shareAvailability false while the module is off)', () => {
    expect(
      buildCoachAvailability(
        { shareAvailability: false, availability: { 0: [[1, 2]] } },
        [],
        1,
        () => true,
      ),
    ).toBeNull();
  });
});

describe('Planner week blocks are rectangles, not pills', () => {
  it('.pl-g-e uses the smallest radius token', () => {
    const css = readFileSync(`${process.cwd()}/src/planner/planner.css`, 'utf8');
    const block = css.match(/\.pl-g-e \{[^}]*\}/)![0];
    expect(block).toContain('border-radius: var(--r-2)');
  });
});
