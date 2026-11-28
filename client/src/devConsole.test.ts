import { describe, expect, it } from 'vitest';
import { devConsoleHref } from './devConsole';

describe('devConsoleHref', () => {
  it('is offered only in dev on a local host', () => {
    expect(devConsoleHref(true, 'localhost')).toBe('http://127.0.0.1:5174');
    expect(devConsoleHref(true, '127.0.0.1')).toBe('http://127.0.0.1:5174');
  });
  it('is hidden in production builds and on real hosts', () => {
    expect(devConsoleHref(false, 'localhost')).toBeNull();
    expect(devConsoleHref(true, 'myspotter.fit')).toBeNull();
    expect(devConsoleHref(true, 'spotter-64c3b.web.app')).toBeNull();
  });
});
