import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./sync', () => ({
  usePlans: () => [],
  usePrefs: () => ({ availability: { 0: [[1080, 1260]] }, shareAvailability: false }),
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
