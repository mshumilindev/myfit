import { beforeEach, describe, expect, it } from 'vitest';
import { UPDATE_ACKED_KEY, ackedVersion, clearAcked, markAcked, wasAcked } from './updateAcked';

beforeEach(() => localStorage.clear());

describe('updateAcked', () => {
  it('remembers per account and kind; an older version never replaces a newer one', () => {
    expect(wasAcked('u1', 'policy-ack', '2026-11-05')).toBe(false);
    markAcked('u1', 'policy-ack', '2026-11-05');
    markAcked('u1', 'policy-ack', '2026-11-04');
    expect(ackedVersion('u1', 'policy-ack')).toBe('2026-11-05');
    expect(wasAcked('u1', 'policy-ack', '2026-11-05')).toBe(true);
    expect(wasAcked('u1', 'policy-ack', '2026-11-04')).toBe(true);
    expect(wasAcked('u1', 'policy-ack', '2026-11-06')).toBe(false);
    expect(wasAcked('u1', 'terms', '2026-11-05')).toBe(false);
    expect(wasAcked('u2', 'policy-ack', '2026-11-05')).toBe(false);
  });
  it('holds kinds and versions only', () => {
    markAcked('u1', 'policy-ack', '2026-11-05');
    expect(JSON.parse(localStorage.getItem(UPDATE_ACKED_KEY) ?? '')).toEqual({
      u1: { 'policy-ack': '2026-11-05' },
    });
  });
  it('clearAcked removes one account and leaves the others', () => {
    markAcked('u1', 'policy-ack', '2026-11-05');
    markAcked('u2', 'policy-ack', '2026-11-05');
    clearAcked('u1');
    expect(ackedVersion('u1', 'policy-ack')).toBe('');
    expect(ackedVersion('u2', 'policy-ack')).toBe('2026-11-05');
    clearAcked('nobody');
  });
  it('a broken or foreign value is treated as empty, never throws', () => {
    localStorage.setItem(UPDATE_ACKED_KEY, '[1,2');
    expect(ackedVersion('u1', 'policy-ack')).toBe('');
    localStorage.setItem(UPDATE_ACKED_KEY, '[]');
    expect(wasAcked('u1', 'policy-ack', '2026-11-05')).toBe(false);
    markAcked('u1', 'policy-ack', '2026-11-05');
    expect(ackedVersion('u1', 'policy-ack')).toBe('2026-11-05');
  });
});
