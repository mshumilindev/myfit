import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./sync', () => ({
  usePlans: () => [],
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
