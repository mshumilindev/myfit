import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';

type Status = 'unknown' | 'unset' | 'ready';
const h = vi.hoisted(() => ({ st: 'ready' as Status }));
vi.mock('../vaultIO', () => ({
  vault: { status: () => h.st, subscribe: () => () => undefined },
}));

import { PrivacyVault } from './PrivacyVault';

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('PrivacyVault', () => {
  it('says it is encrypted, with nothing to press or type', () => {
    h.st = 'ready';
    render(<PrivacyVault />);
    expect(screen.getByText(/Encrypted|Зашифровано/)).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('says it is getting ready while no key is available', () => {
    h.st = 'unset';
    render(<PrivacyVault />);
    expect(screen.getByText(/getting ready|готується/)).toBeTruthy();
  });
  it('renders nothing before the first check', () => {
    h.st = 'unknown';
    const { container } = render(<PrivacyVault />);
    expect(container.textContent).toBe('');
  });
});
