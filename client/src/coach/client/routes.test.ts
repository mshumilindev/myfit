import { describe, expect, it } from 'vitest';
import { clientHash, isClientHead, parseClientRoute } from './routes';

describe('client routes', () => {
  it('parses and round-trips', () => {
    for (const hash of [
      '#/invite/abc_DEF-12',
      '#/team-invite/abc_DEF-12',
      '#/trainer',
      '#/trainer/chat',
      '#/trainer/log',
      '#/trainer/spotter',
    ]) {
      const r = parseClientRoute(hash.slice(2));
      expect(r).not.toBeNull();
      expect(clientHash(r!)).toBe(hash);
    }
  });
  it('rejects anything else', () => {
    for (const s of [
      'invite',
      'invite/',
      'team-invite',
      'team-invite/a b',
      'invite/a b',
      'invite/' + 'x'.repeat(65),
      'trainer/other',
      'coach',
    ]) {
      expect(parseClientRoute(s), s).toBeNull();
    }
    expect(isClientHead('trainer')).toBe(true);
    expect(isClientHead('team-invite')).toBe(true);
    expect(isClientHead('c')).toBe(false);
  });
});
