import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncStatus } from './SyncStatus';

afterEach(cleanup);

describe('SyncStatus', () => {
  it('is a polite, non-modal status region', () => {
    render(<SyncStatus state="syncing">Syncing</SyncStatus>);
    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-modal')).toBeNull();
    expect(el.getAttribute('aria-busy')).toBeNull();
    expect(el.textContent).toContain('Syncing');
  });

  it('shows Retry only when asked and calls it', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<SyncStatus state="offline">Offline</SyncStatus>);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(
      <SyncStatus state="offline" onRetry={onRetry} retryLabel="Retry">
        Offline
      </SyncStatus>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('floating is a modifier class only (no scrim element, no spinner)', () => {
    const { container } = render(
      <SyncStatus state="slow" floating>
        Slow
      </SyncStatus>,
    );
    expect(container.querySelector('.uisync--floating')).not.toBeNull();
    expect(container.querySelector('.sp, .server-busy-scrim')).toBeNull();
  });
});
