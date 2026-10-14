import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_HOSTING_ORIGIN, appOrigin, inviteLink, inviteTokenOf } from './inviteLink';
import { parseClientRoute } from './client/routes';

afterEach(() => vi.unstubAllEnvs());

describe('inviteLink', () => {
  it('builds <origin>/#/invite/<token> that the client route accepts', () => {
    const link = inviteLink('abc_DEF-123', 'https://spotter-64c3b.web.app/');
    expect(link).toBe('https://spotter-64c3b.web.app/#/invite/abc_DEF-123');
    const hash = link.slice(link.indexOf('#') + 2);
    expect(parseClientRoute(hash)).toEqual({ page: 'invite', token: 'abc_DEF-123' });
    expect(inviteTokenOf(link)).toBe('abc_DEF-123');
  });
  it('reads VITE_APP_ORIGIN, normalised to an origin', () => {
    vi.stubEnv('VITE_APP_ORIGIN', 'https://app.example.com/some/path?x=1');
    expect(appOrigin()).toBe('https://app.example.com');
    expect(inviteLink('t1')).toBe('https://app.example.com/#/invite/t1');
  });
  it('ignores a malformed or non-http origin', () => {
    vi.stubEnv('VITE_APP_ORIGIN', 'javascript:alert(1)');
    expect(appOrigin()).not.toContain('javascript');
    vi.stubEnv('VITE_APP_ORIGIN', 'not a url');
    expect(appOrigin().startsWith('http')).toBe(true);
  });
  it('falls back to the hosting origin in a production build', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_APP_ORIGIN', '');
    expect(appOrigin()).toBe(FIREBASE_HOSTING_ORIGIN);
  });
  it('refuses tokens the route would not accept and reads none from other text', () => {
    expect(() => inviteLink('a/b')).toThrow();
    expect(() => inviteLink('')).toThrow();
    expect(inviteTokenOf('https://x.y/#/today')).toBeNull();
    expect(inviteTokenOf('https://x.y/#/invite/')).toBeNull();
  });
});
