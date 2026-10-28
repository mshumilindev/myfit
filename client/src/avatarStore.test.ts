import { describe, expect, it } from 'vitest';
import { isStoredFresh, shouldReplaceStored } from './avatarStore';

// SPO-336 F2: the revision is the server's `updatedAt` (only grows), so a copy at the asked revision OR NEWER is current,
// and a write never puts an older revision over a newer one (two screens with different revisions must not undo each other).
describe('avatar cache revisions', () => {
  it('unknown revision (0): whatever is stored is used', () => {
    expect(isStoredFresh({ rev: 9 }, 0)).toBe(true);
  });
  it('stored revision equal or newer than asked: fresh; older: stale', () => {
    expect(isStoredFresh({ rev: 5 }, 5)).toBe(true);
    expect(isStoredFresh({ rev: 8 }, 5)).toBe(true);
    expect(isStoredFresh({ rev: 4 }, 5)).toBe(false);
  });
  it('a write replaces an equal or older record, never a newer one', () => {
    expect(shouldReplaceStored(undefined, 3)).toBe(true);
    expect(shouldReplaceStored({ rev: 3 }, 3)).toBe(true);
    expect(shouldReplaceStored({ rev: 2 }, 3)).toBe(true);
    expect(shouldReplaceStored({ rev: 9 }, 3)).toBe(false);
  });
  it('an unknown revision (0) never replaces a stored copy', () => {
    expect(shouldReplaceStored({ rev: 4 }, 0)).toBe(false);
    expect(shouldReplaceStored(undefined, 0)).toBe(true);
  });
});
