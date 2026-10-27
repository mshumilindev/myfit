import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SyncStateIcon, type SyncIconState } from './SyncStateIcon';

afterEach(cleanup);

const STATES: SyncIconState[] = [
  'synced',
  'syncing',
  'saving',
  'slow',
  'offline',
  'stale',
  'failed',
  'locked',
];

describe('SyncStateIcon', () => {
  it('renders every state with its own data-state and a name', () => {
    for (const s of STATES) {
      const { unmount } = render(<SyncStateIcon state={s} label={s} />);
      const el = screen.getByRole('img', { name: s });
      expect(el.getAttribute('data-state')).toBe(s);
      unmount();
    }
  });

  it('is decorative without a label', () => {
    const { container } = render(<SyncStateIcon state="offline" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).toBeNull();
  });

  it('puts the queued count into the name and shows a badge; zero hides it', () => {
    const { rerender } = render(<SyncStateIcon state="offline" label="Offline" count={3} />);
    expect(screen.getByRole('img', { name: 'Offline · 3' })).toBeTruthy();
    expect(document.querySelector('.uibadge')?.textContent).toBe('3');
    rerender(<SyncStateIcon state="offline" label="Offline" count={0} />);
    expect(document.querySelector('.uibadge')).toBeNull();
  });

  it('danger tone only for failed', () => {
    const { container, rerender } = render(<SyncStateIcon state="failed" label="x" />);
    expect((container.firstChild as HTMLElement).className).toContain('uit--danger');
    rerender(<SyncStateIcon state="offline" label="x" />);
    expect((container.firstChild as HTMLElement).className).toContain('uit--neutral');
  });

  it('draws one calligraphy line: 13 path pieces, no loose strokes', () => {
    const { container } = render(<SyncStateIcon state="synced" label="x" />);
    expect(container.querySelectorAll('svg path')).toHaveLength(13);
    expect(container.querySelectorAll('svg line')).toHaveLength(0);
  });

  it('tooltip: absent by default, shows the name on tap and hides on blur', () => {
    const { container, rerender } = render(<SyncStateIcon state="slow" label="Slow" />);
    expect(container.querySelector('.uisi-tip')).toBeNull();
    rerender(<SyncStateIcon state="slow" label="Slow" tooltip />);
    const host = container.firstChild as HTMLElement;
    expect(container.querySelector('.uisi-tip')?.textContent).toBe('Slow');
    expect(host.className).not.toContain('is-tip');
    fireEvent.click(host);
    expect(host.className).toContain('is-tip');
    fireEvent.blur(host);
    expect(host.className).not.toContain('is-tip');
  });

  it('tooltip needs a label', () => {
    const { container } = render(<SyncStateIcon state="slow" tooltip />);
    expect(container.querySelector('.uisi-tip')).toBeNull();
  });
});
