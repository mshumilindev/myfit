import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FailedState } from './FailedState';

afterEach(cleanup);

describe('FailedState', () => {
  it('is an alert with the title and optional body', () => {
    const { container, rerender } = render(<FailedState title="Could not load" />);
    expect(screen.getByRole('alert').textContent).toContain('Could not load');
    expect(container.querySelector('.uifailed-s')).toBeNull();
    rerender(<FailedState title="Could not load" body="Check your connection" />);
    expect(screen.getByText('Check your connection').className).toBe('uifailed-s');
  });

  it('renders no button without onRetry', () => {
    render(<FailedState title="x" retryLabel="Retry" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('retry button fires onRetry', () => {
    const onRetry = vi.fn();
    render(<FailedState title="x" retryLabel="Retry" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom icon', () => {
    const { container } = render(<FailedState title="x" icon="cloud-slash" />);
    expect(container.querySelector('.uifailed-i')).not.toBeNull();
  });
});
