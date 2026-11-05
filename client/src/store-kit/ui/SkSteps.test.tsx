// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkSteps, type SkStep } from './SkSteps';

afterEach(cleanup);

const items: SkStep[] = [
  { id: 'a', name: 'Health', state: 'done' },
  { id: 'b', name: 'Injury log', state: 'active', progress: 62 },
  {
    id: 'c',
    name: 'Sleep',
    state: 'pending',
    detail: 'Starts after Injury log',
    status: 'Waiting',
  },
  {
    id: 'd',
    name: 'Cycle',
    state: 'failed',
    detail: 'Could not install. Check your connection.',
    action: <button>Try again</button>,
  },
];

describe('SkSteps', () => {
  it('is an ordered list with one item per step and a state class', () => {
    render(<SkSteps items={items} label="Installing" />);
    const list = screen.getByRole('list', { name: 'Installing' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.getAttribute('data-state'))).toEqual([
      'done',
      'active',
      'pending',
      'failed',
    ]);
    expect(rows[1].className).toContain('sk-step-active');
  });
  it('shows a progressbar and percentage for the active step only', () => {
    render(<SkSteps items={items} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('62');
    expect(screen.getByText('62%')).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getAllByRole('listitem')[1].getAttribute('aria-current')).toBe('step');
  });
  it('clamps progress', () => {
    render(<SkSteps items={[{ id: 'x', name: 'X', state: 'active', progress: 180 }]} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
  it('renders detail, waiting status and the failed action', () => {
    render(<SkSteps items={items} />);
    expect(screen.getByText('Starts after Injury log')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByText('Could not install. Check your connection.')).toBeTruthy();
  });
  it('exposes the state to assistive tech and honours custom words', () => {
    render(<SkSteps items={items.slice(0, 1)} stateLabels={{ done: 'Gotowe' }} />);
    expect(screen.getByText(', Gotowe')).toBeTruthy();
  });
});
