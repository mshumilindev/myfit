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
    expect(r?.route).toBe('/u/:x');
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

describe('hardening after independent review (SPO-639 G4)', () => {
  it('does not blow up CPU on hostile repeated input', () => {
    const t = Date.now();
    maskStack('a.'.repeat(2000));
    maskText('a.'.repeat(2000), 120);
    expect(Date.now() - t).toBeLessThan(200);
  });
  it('drops origins, and non-identifier function names, from stack frames', () => {
    const s = maskStack(
      'Error: x\n    at https://spotter.app/assets/index-abc.js:3:4\n    at user ivan@mail.com (a.js:1:1)',
    );
    expect(s).not.toMatch(/spotter\.app|ivan|@/);
    expect(s).toContain('index-abc.js');
  });
  it('masks quoted text, braces, phone-like numbers, tlds-less emails and doc paths', () => {
    const out = maskText(
      'bad JSON {"note":"my knee hurts"} users/AbC/workouts/w1 +380 50 123 45 67 ivan@mail ivan [at] mail.com',
      400,
    );
    expect(out).not.toMatch(/knee|AbC|380|123|ivan|@|mail\./);
  });
  it('keeps only a safe route shape and a version-like build', () => {
    const r = sanitizeReport({
      ...base,
      route: '/coach/client/maria-ivanenko/notes',
      build: 'my knee hurts!',
    });
    expect(r?.route).toBe('/coach/:x/:x/:x');
    expect(r?.build).toBe('unknown');
  });
});
