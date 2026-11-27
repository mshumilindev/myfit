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
  it('never keeps unknown fields such as uid or email', () => {
    const r = sanitizeReport({ ...base, uid: 'u1', email: 'a@b.co' });
    expect(Object.keys(r ?? {}).sort()).toEqual([
      'build',
      'kind',
      'locale',
      'message',
      'online',
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
  it('accepts only a version-like build', () => {
    expect(sanitizeReport({ ...base, build: 'my knee hurts!' })?.build).toBe('unknown');
    expect(sanitizeReport({ ...base, build: '1.2.3-rc.1' })?.build).toBe('1.2.3-rc.1');
  });
});

describe('stack lines must be real engine frames (SPO-639 G4 round 2)', () => {
  it('drops free text that merely ends in a file name', () => {
    expect(maskStack('x\nMaria main.js')).toBe('');
    expect(maskStack('Ivan Petrov foo.js')).toBe('');
    expect(maskStack('Error: my\nnote\nPetrov_Ivan.ts')).toBe('');
    expect(maskStack('weight_80kg_bench ivan_petrov.js')).toBe('');
  });
  it('keeps V8 and Firefox/Safari frames', () => {
    expect(maskStack('    at run (https://a.io/assets/app-1.js:3:4)')).toBe('run app-1.js');
    expect(maskStack('    at https://a.io/assets/app-1.js:3:4')).toBe('<anon> app-1.js');
    expect(maskStack('run@https://a.io/assets/app-1.js:3:4')).toBe('run app-1.js');
  });
});
