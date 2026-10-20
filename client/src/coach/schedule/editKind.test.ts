import { describe, expect, it } from 'vitest';
import { editKindOf } from './editKind';
import { emptyDoc } from './types';

const base = emptyDoc('c1');
describe('editKindOf', () => {
  it('names a mark, a cancellation, or a plain edit', () => {
    expect(
      editKindOf(base, { ...base, exceptions: [{ slotKey: 'a', status: 'done' }] } as never),
    ).toBe('session-done');
    expect(
      editKindOf(base, { ...base, exceptions: [{ slotKey: 'a', status: 'missed' }] } as never),
    ).toBe('session-missed');
    expect(editKindOf(base, { ...base, cancelled: ['a:1'] })).toBe('session-cancelled');
    expect(editKindOf(base, { ...base, patterns: [] })).toBe('session-edited');
    const had = { ...base, exceptions: [{ slotKey: 'a', status: 'done' }] } as never;
    expect(editKindOf(had, had)).toBe('session-edited');
  });
});
