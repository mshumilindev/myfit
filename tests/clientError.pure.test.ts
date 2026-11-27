import { describe, expect, it } from 'vitest';
import { maskStack, maskText, sanitizeReport } from '../functions/src/clientErrorPure';

const base = {
  kind: 'error',
  message: 'x',
  stack: '',
  build: 'b1',
  locale: 'en',
  route: '/today',
  online: true,
};

describe('client error report sanitising (SPO-639 G1)', () => {
  it('masks emails, long tokens, long numbers and url parameters', () => {
    const out = maskText(
      'fail for a.b@mail.com token ABCDEFGHIJKLMNOPQRSTUVWXYZ12 id 1234567 at /p?uid=secret#h',
      200,
    );
    expect(out).not.toMatch(/mail\.com|ABCDEFGH|1234567|secret/);
    expect(out).toContain('<email>');
    expect(out).toContain('<token>');
    expect(out).toContain('<n>');
  });
  it('keeps only function and file names in a stack', () => {
    const s = maskStack(
      'Error: boom user@x.io\n    at doThing (https://app.example/assets/index-abc.js:10:5)',
    );
    expect(s).toBe('doThing index-abc.js');
  });
  it('rejects non-objects, unknown kinds and oversized bodies', () => {
    expect(sanitizeReport(null)).toBeNull();
    expect(sanitizeReport({ ...base, kind: 'weird' })).toBeNull();
    expect(sanitizeReport({ ...base, message: 'a'.repeat(5000) })).toBeNull();
  });
  it('drops query and hash from the route and normalises locale', () => {
    const r = sanitizeReport({
      ...base,
      route: '/u/x?token=abcdefghijklmnopqrstuvwxyz',
      locale: 'zz9',
    });
    expect(r?.route).toBe('/u/x');
    expect(r?.locale).toBe('xx');
  });
  it('never keeps unknown fields such as uid or email', () => {
    const r = sanitizeReport({ ...base, uid: 'u1', email: 'a@b.co' });
    expect(Object.keys(r ?? {}).sort()).toEqual([
      'build',
      'kind',
      'locale',
      'message',
      'online',
      'route',
      'stack',
    ]);
  });
});
