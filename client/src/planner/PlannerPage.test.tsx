import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonsPref } from '../addons/enabledSet';

afterEach(cleanup);
// Availability is a module of Planner and starts off: these tests exercise it, so it is switched on.
beforeEach(() => addonsPref.set(['planner', 'planner-availability']));

vi.mock('./sync', () => ({
  usePlans: () => [],
  usePrefs: () => ({
    availability: { 0: [[1080, 1260]] },
    shareAvailability: false,
    defaults: { lead: 60, mode: 'quiet', durationMin: 60 },
  }),
  savePrefs: vi.fn(),
  savePlan: vi.fn(),
  deletePlan: vi.fn(),
}));

import { PlannerPage } from './PlannerPage';

describe('PlannerPage', () => {
  it('shows the empty state with an Add button when there are no plans', () => {
    render(<PlannerPage onClose={() => {}} />);
    expect(screen.getByText('No plans yet')).toBeTruthy();
    expect(screen.getAllByText('Add a plan').length).toBeGreaterThan(0);
  });
});

describe('PlannerPage: availability entry', () => {
  it('has a "My availability" row with a summary that opens the page', () => {
    render(<PlannerPage onClose={() => {}} />);
    expect(screen.getAllByText('1 days a week').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText('My availability')[0]);
    expect(screen.getByText('Weekly hours')).toBeTruthy();
  });
});

describe('PlannerPage: settings entry', () => {
  it('has a Settings row that opens the settings and goes back', () => {
    render(<PlannerPage onClose={() => {}} />);
    fireEvent.click(screen.getAllByText('Settings').at(-1)!);
    expect(screen.getByText('Planner settings')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('No plans yet')).toBeTruthy();
  });
});
