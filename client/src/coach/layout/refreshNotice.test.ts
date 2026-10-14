import { describe, expect, it } from 'vitest';
import { refreshNotice, STALE_AFTER_MS } from './refreshNotice';

const NOW = Date.UTC(2026, 9, 7, 9, 5);
const base = { status: 'stale', error: null, updatedAt: NOW - 60_000 } as const;

describe('refreshNotice (F6)', () => {
  it('a healthy refresh of fresh data is silent', () => {
    expect(refreshNotice(base, NOW)).toBe('none');
    expect(refreshNotice({ ...base, status: 'ready' }, NOW)).toBe('none');
    expect(refreshNotice({ ...base, status: 'loading', updatedAt: null }, NOW)).toBe('none');
  });
  it('old data that is still refreshing is quiet', () => {
    expect(refreshNotice({ ...base, updatedAt: NOW - STALE_AFTER_MS - 1 }, NOW)).toBe('quiet');
    expect(refreshNotice({ ...base, updatedAt: NOW - STALE_AFTER_MS }, NOW)).toBe('none');
  });
  it('a failing refresh and offline are always shown', () => {
    expect(refreshNotice({ ...base, error: 'timeout' }, NOW)).toBe('failing');
    expect(refreshNotice({ ...base, status: 'offline', error: 'offline' }, NOW)).toBe('offline');
  });
});
