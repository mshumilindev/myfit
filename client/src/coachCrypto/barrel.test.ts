import { describe, expect, it } from 'vitest';
import * as barrel from './index';

/** Symbols that production does not import yet (marked `@internal planned` in their files). They must stay reachable. */
const PLANNED = [
  'CID_LENGTH',
  'isConversationId',
  'computeConversationId',
  'resolveConversationId',
  'PURPOSES',
  'MAX_MESSAGES_PER_EPOCH',
  'BUCKET',
  'MAX_PAYLOAD_BYTES',
  'unpad',
  'PLAN_MAX_BYTES',
  'SCHEDULE_MAX_BYTES',
  'sealedWrite',
  'SECURITY_CODE_DIGITS',
  'securityCode',
] as const;

describe('coachCrypto public barrel', () => {
  it.each(PLANNED)('exports the planned symbol %s', (name) => {
    expect((barrel as Record<string, unknown>)[name]).toBeDefined();
  });

  it('keeps the contract constants in sync with their documented values', () => {
    expect(barrel.CID_LENGTH).toBe(26);
    expect(barrel.SECURITY_CODE_DIGITS).toBe(24);
    expect(barrel.isConversationId('a'.repeat(26))).toBe(true);
    expect(barrel.isConversationId('A'.repeat(26))).toBe(false);
  });

  it('pads and unpads through the barrel', () => {
    const data = new TextEncoder().encode('hello');
    const out = barrel.unpad(barrel.pad(data));
    expect(new TextDecoder().decode(out)).toBe('hello');
  });
});
