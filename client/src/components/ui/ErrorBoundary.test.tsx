import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(cleanup);

let broken = true;
function Maybe() {
  if (broken) throw new Error('boom');
  return <p>fine</p>;
}

const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

describe('ErrorBoundary', () => {
  it('shows the failure card instead of unmounting, and retry re-renders the children', () => {
    const spy = quiet();
    broken = true;
    const onRetry = vi.fn(() => {
      broken = false;
    });
    render(
      <ErrorBoundary title="Failed" body="calm" retryLabel="Retry" onRetry={onRetry}>
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByText('fine')).toBeTruthy();
    spy.mockRestore();
  });

  it('a new resetKey clears the error', () => {
    const spy = quiet();
    broken = true;
    const { rerender } = render(
      <ErrorBoundary title="Failed" retryLabel="Retry" resetKey="a">
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    broken = false;
    rerender(
      <ErrorBoundary title="Failed" retryLabel="Retry" resetKey="b">
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
    spy.mockRestore();
  });

  it('reports the error to onError', () => {
    const spy = quiet();
    broken = true;
    const onError = vi.fn();
    render(
      <ErrorBoundary title="Failed" onError={onError}>
        <Maybe />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
