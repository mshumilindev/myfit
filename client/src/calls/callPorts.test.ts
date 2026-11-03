import { describe, expect, it } from 'vitest';
import { endReasonFromMediaError, endReasonFromServer } from './callPorts';

describe('endReasonFromServer', () => {
  it('passes the known reasons through and maps anything else to failed', () => {
    for (const r of ['declined', 'missed', 'busy', 'unavailable', 'hangup', 'failed'])
      expect(endReasonFromServer(r)).toBe(r);
    expect(endReasonFromServer('weird')).toBe('failed');
    expect(endReasonFromServer(undefined)).toBe('failed');
  });
});

describe('endReasonFromMediaError', () => {
  it('maps getUserMedia failures to what the person sees', () => {
    expect(endReasonFromMediaError({ name: 'NotAllowedError' })).toBe('permission-denied');
    expect(endReasonFromMediaError({ name: 'SecurityError' })).toBe('permission-denied');
    expect(endReasonFromMediaError({ name: 'NotFoundError' })).toBe('no-device');
    expect(endReasonFromMediaError({ name: 'OverconstrainedError' })).toBe('no-device');
    expect(endReasonFromMediaError({ name: 'AbortError' })).toBe('failed');
    expect(endReasonFromMediaError(null)).toBe('failed');
    expect(endReasonFromMediaError(undefined)).toBe('failed');
  });
});
