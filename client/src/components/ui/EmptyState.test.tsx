import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

afterEach(cleanup);

describe('EmptyState', () => {
  it('title is an h4 by default and the root is left-aligned', () => {
    const { container } = render(<EmptyState icon="barbell" title="No workouts" />);
    expect(screen.getByRole('heading', { level: 4, name: 'No workouts' })).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toBe('uiempty');
  });

  it.each([
    ['h2', 2],
    ['h3', 3],
  ] as const)('titleAs %s renders that heading level', (as, level) => {
    render(<EmptyState icon="barbell" title="T" titleAs={as} />);
    expect(screen.getByRole('heading', { level })).toBeTruthy();
  });

  it('centered adds the center modifier', () => {
    const { container } = render(<EmptyState icon="barbell" title="T" centered />);
    expect((container.firstChild as HTMLElement).className).toBe('uiempty uiempty--center');
  });

  it('renders body only when given and children as the action', () => {
    const { container, rerender } = render(<EmptyState icon="barbell" title="T" />);
    expect(container.querySelector('.uiempty-s')).toBeNull();
    rerender(
      <EmptyState icon="barbell" title="T" body="Nothing yet">
        <button type="button">Add</button>
      </EmptyState>,
    );
    expect(screen.getByText('Nothing yet').tagName).toBe('P');
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });

  it('draws the icon', () => {
    const { container } = render(<EmptyState icon="barbell" title="T" />);
    expect(container.querySelector('.uiempty-i')).not.toBeNull();
  });
});
