import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../api', () => ({ currentUid: () => 'u1' }));
vi.mock('../legal/signupConsents', () => ({
  prepareDirectGrant: vi.fn(),
  sendConsentDurably: h.send,
}));

import { withdrawAtlas } from './useAtlasAi';

beforeEach(() => h.send.mockReset().mockResolvedValue(true));

describe('withdrawAtlas', () => {
  it('turning Gemini off always queues the Puter withdrawal too, even when the cached records show Puter off', async () => {
    expect(await withdrawAtlas('gemini')).toBe(true);
    expect(h.send.mock.calls.map((c) => c[0].kind)).toEqual(['atlas-ai', 'atlas-puter']);
    expect(h.send.mock.calls.every((c) => c[0].action === 'withdraw')).toBe(true);
  });

  it('withdrawing Puter alone queues only Puter', async () => {
    await withdrawAtlas('puter');
    expect(h.send.mock.calls.map((c) => c[0].kind)).toEqual(['atlas-puter']);
  });
});
