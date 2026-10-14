import { describe, expect, it } from 'vitest';
import { coachKeySigPayload, signKeySigPayload } from '../../functions/src/coach/service';

// The same literals are asserted in client/src/coach/data/firestore/adapters.test.ts.
describe('signature payload parity (client trust.ts)', () => {
  it('signs the exact strings the client verifies', () => {
    expect(coachKeySigPayload('u1', 'fp', 5, 'k1')).toBe('coachkey|1|k1|u1|fp|5');
    expect(signKeySigPayload('s1', 'u1', 'k1', 'PUB')).toBe('signkey|1|s1|u1|k1|PUB');
  });
});
