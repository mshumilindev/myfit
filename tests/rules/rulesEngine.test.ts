/**
 * The rules interpreter itself (tests/rules/engine/rulesEngine.ts): parses the real firestore.rules and behaves like
 * the rules language for the constructs the file uses. If this file is red, the logic suite below it proves nothing.
 */
import { describe, expect, it } from 'vitest';
import { callRulesFn, decide, parseRules } from './engine/rulesEngine';
import { RULES_SOURCE as SRC } from './engine/rulesSource';

const mini = (body: string) =>
  parseRules(`rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
${body}
} }`);
const U = { uid: 'u1', token: { role: 'member' } };

describe('rules engine', () => {
  it('parses the real firestore.rules: every function and match block', () => {
    const r = parseRules(SRC);
    expect(r.fns.size).toBeGreaterThan(15);
    for (const f of [
      'sealedCk',
      'sealedCkPlan',
      'sealedCkSchedule',
      'validCk',
      'inConv',
      'activeConv',
      'isActiveCoachOf',
    ])
      expect(r.fns.has(f), f).toBe(true);
    expect(r.patterns).toContain(
      '/databases/{database}/documents/conversations/{cid}/keyring/{epoch}',
    );
    expect(r.patterns).toContain('/databases/{database}/documents/programs/{programId}');
  });

  it('default deny, path matching and nested wildcards', () => {
    const r = mini(
      `match /a/{x} { allow read: if true; match /b/{y} { allow write: if x == 'ok' && y == '1'; } }`,
    );
    const c = { auth: U, db: {} };
    expect(decide(r, 'get', 'a/1', c).allowed).toBe(true);
    expect(decide(r, 'create', 'a/1', c).allowed).toBe(false);
    expect(decide(r, 'create', 'a/ok/b/1', { ...c, data: {} }).allowed).toBe(true);
    expect(decide(r, 'create', 'a/ok/b/2', { ...c, data: {} }).allowed).toBe(false);
    expect(decide(r, 'get', 'zzz/1', c).allowed).toBe(false);
  });

  it('operators: && || ! comparisons in is ?: and error semantics', () => {
    const r = mini(`
      function f(d) { return d.n > 2 && d.s.size() < 4 && d.k in ['a','b'] && !(d.k == 'c'); }
      function g(d) { return d.missing == 1 || d.n == 3; }
      function h(d) { return d.missing == 1 && false; }
      function t(d) { return d.n is int ? 'int' : 'no'; }
      match /x/{id} { allow get: if true; }`);
    const c = { auth: U, db: {} };
    expect(callRulesFn(r, 'f', [{ n: 3, s: 'abc', k: 'a' }], c)).toBe(true);
    expect(callRulesFn(r, 'f', [{ n: 3, s: 'abcd', k: 'a' }], c)).toBe(false);
    expect(callRulesFn(r, 'f', [{ n: 3, s: 'abc', k: 'z' }], c)).toBe(false);
    // `||`: an error on the left does not matter when the right is true; `&&` with false on the right still errors
    expect(callRulesFn(r, 'g', [{ n: 3 }], c)).toBe(true);
    expect(String(callRulesFn(r, 'g', [{ n: 4 }], c))).toMatch(/^error/);
    expect(callRulesFn(r, 'h', [{}], c)).toBe(false);
    expect(callRulesFn(r, 't', [{ n: 3 }], c)).toBe('int');
    expect(callRulesFn(r, 't', [{ n: 3.5 }], c)).toBe('no');
  });

  it('keys().hasOnly / hasAll / hasAny, diff().affectedKeys(), get(k, default), int()', () => {
    const r = mini(`
      function only(d) { return d.keys().hasOnly(['a','b']); }
      function all(d) { return d.keys().hasAll(['a','b']); }
      function aff(a, b) { return a.diff(b).affectedKeys().hasOnly(['b']); }
      function dflt(d) { return d.get('z', 7) == 7; }
      function num(s) { return int(s) == 12; }
      match /x/{id} { allow get: if true; }`);
    const c = { auth: U, db: {} };
    expect(callRulesFn(r, 'only', [{ a: 1 }], c)).toBe(true);
    expect(callRulesFn(r, 'only', [{ a: 1, c: 1 }], c)).toBe(false);
    expect(callRulesFn(r, 'all', [{ a: 1 }], c)).toBe(false);
    expect(
      callRulesFn(
        r,
        'aff',
        [
          { a: 1, b: 2 },
          { a: 1, b: 3 },
        ],
        c,
      ),
    ).toBe(true);
    expect(
      callRulesFn(
        r,
        'aff',
        [
          { a: 1, b: 2 },
          { a: 2, b: 2 },
        ],
        c,
      ),
    ).toBe(false);
    expect(
      callRulesFn(
        r,
        'aff',
        [
          { a: 1, b: { x: 1 } },
          { a: 1, b: { x: 1 } },
        ],
        c,
      ),
    ).toBe(true);
    expect(callRulesFn(r, 'dflt', [{}], c)).toBe(true);
    expect(callRulesFn(r, 'num', ['12'], c)).toBe(true);
  });

  it('get() / exists() with $(...) path interpolation; a missing document is an error, not a pass', () => {
    const r = mini(`
      match /p/{id} {
        allow get: if get(/databases/$(database)/documents/q/$(id)).data.ok == true;
        allow list: if exists(/databases/$(database)/documents/q/$(id));
      }`);
    const db = { 'q/1': { ok: true }, 'q/2': { ok: false } };
    const c = { auth: U, db };
    expect(decide(r, 'get', 'p/1', c).allowed).toBe(true);
    expect(decide(r, 'get', 'p/2', c).allowed).toBe(false);
    const gone = decide(r, 'get', 'p/3', c);
    expect(gone.allowed).toBe(false);
    expect(gone.tried[0].error).toMatch(/no document/);
    expect(decide(r, 'list', 'p/3', c).allowed).toBe(false);
    expect(decide(r, 'list', 'p/2', c).allowed).toBe(true);
  });

  it('request.auth, request.time and resource', () => {
    const r = mini(`match /x/{id} {
      allow get: if request.auth != null && request.auth.uid == id;
      allow update: if resource != null && resource.data.n == 1 && request.resource.data.n == 2 && request.time.toMillis() > 5;
      allow create: if request.resource.data.n == 1;
    }`);
    expect(decide(r, 'get', 'x/u1', { auth: U, db: {} }).allowed).toBe(true);
    expect(decide(r, 'get', 'x/u1', { auth: null, db: {} }).allowed).toBe(false);
    expect(
      decide(r, 'update', 'x/a', { auth: U, db: { 'x/a': { n: 1 } }, data: { n: 2 }, time: 10 })
        .allowed,
    ).toBe(true);
    expect(
      decide(r, 'update', 'x/a', { auth: U, db: { 'x/a': { n: 1 } }, data: { n: 2 }, time: 1 })
        .allowed,
    ).toBe(false);
    // create: no existing resource
    expect(decide(r, 'create', 'x/b', { auth: U, db: {}, data: { n: 1 } }).allowed).toBe(true);
  });
});
