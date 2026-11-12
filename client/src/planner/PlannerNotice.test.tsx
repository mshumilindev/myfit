import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ v: 'on' as string }));
vi.mock('../push', () => ({ pushState: () => state.v }));
import { PlannerNotice } from './PlannerNotice';

afterEach(() => {
  cleanup();
  state.v = 'on';
});

describe('PlannerNotice', () => {
  it('says nothing when reminders can ring', () => {
    const { container } = render(<PlannerNotice />);
    expect(container.textContent).toBe('');
  });
  it('blocked notifications', () => {
    state.v = 'denied';
    render(<PlannerNotice />);
    expect(screen.getByText('Notifications are off')).toBeTruthy();
    expect(document.querySelector('.uibanner svg, [class*="banner"] svg')).toBeTruthy();
  });
  it('no banner for an iPhone that is not on the Home Screen', () => {
    state.v = 'needs-install';
    const { container } = render(<PlannerNotice />);
    expect(container.textContent).toBe('');
  });
});
