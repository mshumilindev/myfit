// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkOfflineBar } from './SkOfflineBar';

afterEach(cleanup);

describe('SkOfflineBar', () => {
  it('is a polite status, never an alert', () => {
    render(<SkOfflineBar title="You are offline.">Installed items work.</SkOfflineBar>);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('renders title bold and the message', () => {
    render(<SkOfflineBar title="You are offline.">Adding needs internet.</SkOfflineBar>);
    expect(screen.getByText('You are offline.').tagName).toBe('B');
    expect(screen.getByRole('status').textContent).toContain('Adding needs internet.');
  });
  it('accepts a custom icon and works without a title', () => {
    render(<SkOfflineBar icon={<span data-testid="ic" />}>Offline</SkOfflineBar>);
    expect(screen.getByTestId('ic')).toBeTruthy();
    expect(screen.getByRole('status').querySelector('b')).toBeNull();
  });
});
