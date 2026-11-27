/**
 * SPO-639 (WF-A): `wf` core + CLI. Contracts: done needs evidence, journal never holds text/evidence,
 * status stays ≤12 lines, stall hints change of approach (never stop).
 */
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs without type declarations
import {
  emptyState,
  progress,
  reduce,
  renderStatus,
  STALL_AFTER,
  toJournalEntry,
  validateEvent,
} from '../scripts/lib/wf-core.mjs';
// @ts-expect-error — plain .mjs without type declarations
import { run } from '../scripts/wf.mjs';
// @ts-expect-error — plain .mjs without type declarations
import { decideStop, FRESH_MS } from '../scripts/lib/wf-stop.mjs';

const T = 1_000;
const started = () => reduce(emptyState(), { type: 'start', ts: T, task: 'SPO-1', title: 'x' });
const withItems = () =>
  ['a', 'b', 'c'].reduce(
    (s, id) => reduce(s, { type: 'add', ts: T, item: id, kind: 'ac', text: `secret ${id}` }),
    started(),
  );

describe('wf-core', () => {
  it('rejects done without evidence', () => {
    expect(() => reduce(withItems(), { type: 'done', ts: T, item: 'a', evidence: '  ' })).toThrow(
      /evidence/,
    );
    expect(() => validateEvent({ type: 'done', ts: T, item: 'a' })).toThrow(/evidence/);
  });

  it('computes progress and rounds', () => {
    let s = withItems();
    s = reduce(s, { type: 'done', ts: T, item: 'a', evidence: 'vitest' });
    expect(progress(s)).toEqual({ done: 1, total: 3, pct: 33, left: 67 });
    expect(progress(emptyState())).toEqual({ done: 0, total: 0, pct: 0, left: 0 });
  });

  it('does not mutate the input state', () => {
    const s = withItems();
    const copy = JSON.stringify(s);
    reduce(s, { type: 'doing', ts: T, item: 'a' });
    expect(JSON.stringify(s)).toBe(copy);
  });

  it('block does not touch other items and unblock restores todo', () => {
    let s = withItems();
    s = reduce(s, { type: 'block', ts: T, item: 'b', needs: 'design' });
    expect(s.items.map((i: { status: string }) => i.status)).toEqual(['todo', 'blocked', 'todo']);
    s = reduce(s, { type: 'unblock', ts: T, item: 'b' });
    expect(s.items[1].status).toBe('todo');
  });

  it('rejects unknown items, duplicates and bad categories', () => {
    expect(() => reduce(withItems(), { type: 'doing', ts: T, item: 'zzz' })).toThrow(
      /unknown item/,
    );
    expect(() => reduce(withItems(), { type: 'add', ts: T, item: 'a', kind: 'ac' })).toThrow(
      /exists/,
    );
    expect(() => validateEvent({ type: 'block', ts: T, item: 'a', needs: 'nope' })).toThrow(
      /category/,
    );
    expect(() => validateEvent({ type: 'add', ts: T, item: 'a', kind: 'weird' })).toThrow(/kind/);
  });

  it('status is ≤12 lines, deterministic and lists the owner queue', () => {
    let s = withItems();
    s = reduce(s, { type: 'doing', ts: T, item: 'a' });
    s = reduce(s, { type: 'block', ts: T, item: 'b', needs: 'cpd' });
    const out = renderStatus(s);
    expect(out.split('\n').length).toBeLessThanOrEqual(12);
    expect(out).toContain('чекає на мене (1): b[cpd]');
    expect(out).toContain('в роботі:    a');
    expect(renderStatus(s)).toBe(out);
  });

  it('stall hints to change approach, not to stop', () => {
    let s = withItems();
    for (let i = 0; i < STALL_AFTER; i += 1) s = reduce(s, { type: 'heartbeat', ts: T });
    const out = renderStatus(s);
    expect(out).toMatch(/змінити підхід/);
    expect(out).not.toMatch(/зупин(ити|ись)\s*$/m);
    s = reduce(s, { type: 'done', ts: T, item: 'a', evidence: 'x' });
    expect(s.stall).toBe(0);
  });

  it('journal entries carry no free text and no evidence', () => {
    const e = toJournalEntry({
      type: 'done',
      ts: T,
      item: 'a',
      evidence: 'secret',
      text: 'secret',
      reason: 'secret',
    });
    expect(Object.keys(e).sort()).toEqual(['item', 'ts', 'type']);
  });
});

describe('wf CLI', () => {
  it('start → add → doing → done → status, journal without PII', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-'));
    const go = (...a: string[]) => run(a, { dir, now: T });
    expect(go('start', 'SPO-9', 'demo').code).toBe(0);
    expect(go('add', 'a1', '--kind', 'ac', '--text', 'secret text').code).toBe(0);
    expect(go('doing', 'a1').code).toBe(0);
    const rejected = go('done', 'a1');
    expect(rejected.code).toBe(2);
    const ok = go('done', 'a1', '--evidence', 'vitest run');
    expect(ok.code).toBe(0);
    expect(ok.out).toContain('1/1 (100%)');
    const journal = readFileSync(join(dir, 'wf-events.jsonl'), 'utf8');
    expect(journal).not.toContain('secret');
    expect(journal).not.toContain('vitest run');
    expect(journal.trim().split('\n')).toHaveLength(4);
  });

  it('status without state is a clear message; unknown command is rejected', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-'));
    expect(run(['status'], { dir }).out).toMatch(/немає активної задачі/);
    expect(run(['nope'], { dir }).code).toBe(2);
    expect(run(['start'], { dir }).code).toBe(2);
  });
});

describe('wf hardening (verifier findings)', () => {
  const fresh = () => mkdtempSync(join(tmpdir(), 'wf-'));

  it('rejects ids that are not short identifiers (no free text in the journal)', () => {
    for (const bad of [' ', 'has space', 'x'.repeat(41), 'Іван Петренко']) {
      expect(() => validateEvent({ type: 'add', ts: T, item: bad, kind: 'ac' })).toThrow(/id/);
    }
    expect(() => validateEvent({ type: 'start', ts: T, task: 'a b' })).toThrow(/id/);
    expect(() => validateEvent({ type: 'add', ts: T, item: 'A.1-x_2', kind: 'ac' })).not.toThrow();
  });

  it('refuses invalid transitions', () => {
    let s = withItems();
    s = reduce(s, { type: 'done', ts: T, item: 'a', evidence: 'x' });
    expect(() => reduce(s, { type: 'doing', ts: T, item: 'a' })).toThrow(/transition/);
    expect(() => reduce(s, { type: 'unblock', ts: T, item: 'a' })).toThrow(/transition/);
    s = reduce(s, { type: 'block', ts: T, item: 'b', needs: 'cpd' });
    expect(() => reduce(s, { type: 'done', ts: T, item: 'b', evidence: 'x' })).toThrow(
      /transition/,
    );
    expect(() => reduce(withItems(), { type: 'unblock', ts: T, item: 'c' })).toThrow(/transition/);
  });

  it('corrupt or wrongly shaped state is a clean rejection, not a crash', () => {
    for (const body of ['{bad', 'null', '{"task":{"id":"T"},"items":"x"}', '{}']) {
      const dir = fresh();
      writeFileSync(join(dir, 'wf.json'), body);
      for (const argv of [['status'], ['add', 'X']]) {
        const r = run(argv, { dir, now: T });
        expect(r.code).toBe(2);
        expect(r.out).toMatch(/стан пошкоджено/);
      }
    }
  });

  it('start over an unfinished task needs --force', () => {
    const dir = fresh();
    run(['start', 'SPO-1'], { dir, now: T });
    run(['add', 'a'], { dir, now: T });
    expect(run(['start', 'SPO-2'], { dir, now: T }).code).toBe(2);
    expect(run(['start', 'SPO-2', '--force'], { dir, now: T }).code).toBe(0);
    expect(run(['start', 'SPO-3'], { dir, now: T }).code).toBe(0); // nothing open: fine
  });

  it('accepts values that start with dashes via --flag=value', () => {
    const dir = fresh();
    run(['start', 'S'], { dir, now: T });
    run(['add', 'a'], { dir, now: T });
    expect(run(['done', 'a', '--evidence=--abc'], { dir, now: T }).code).toBe(0);
  });

  it('writes the state atomically (no temp file left behind)', () => {
    const dir = fresh();
    run(['start', 'S'], { dir, now: T });
    expect(readdirSync(dir).sort()).toEqual(['wf-events.jsonl', 'wf.json']);
  });
});

describe('wf hardening, round 2', () => {
  const fresh = () => mkdtempSync(join(tmpdir(), 'wf-'));

  it('deeply invalid state files are rejected cleanly', () => {
    const bodies = [
      '{"task":{"id":"T"},"items":[null]}',
      '{"task":{"id":"T"},"items":[1,"x"]}',
      '{"task":{"id":"T"},"items":[{"id":"a","status":"weird"}]}',
      '{"task":{"id":"T"},"items":[],"stall":"zz"}',
    ];
    for (const body of bodies) {
      const dir = fresh();
      writeFileSync(join(dir, 'wf.json'), body);
      expect(run(['status'], { dir, now: T }).code).toBe(2);
      expect(run(['add', 'x'], { dir, now: T }).code).toBe(2);
    }
  });

  it('mutating commands need an active task and write nothing otherwise', () => {
    const dir = fresh();
    for (const argv of [['add', 'q'], ['heartbeat'], ['doing', 'q']]) {
      expect(run(argv, { dir, now: T }).code).toBe(2);
    }
    expect(readdirSync(dir)).toEqual([]);
  });

  it('flags without a value never become booleans in the state; --force may precede the id', () => {
    const dir = fresh();
    run(['start', 'S'], { dir, now: T });
    run(['add', 'a', '--text'], { dir, now: T });
    expect(JSON.parse(readFileSync(join(dir, 'wf.json'), 'utf8')).items[0].text).toBe('');
    run(['add', 'b'], { dir, now: T });
    expect(run(['start', '--force', 'OTHER'], { dir, now: T }).code).toBe(0);
  });

  it('parallel invocations lose no updates (state and journal agree)', async () => {
    const dir = fresh();
    run(['start', 'S'], { dir, now: T });
    const cli = join(__dirname, '..', 'scripts', 'wf.mjs');
    const exec = promisify(execFile);
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        exec('node', [cli, 'add', `i${i}`], { env: { ...process.env, WF_STATE_DIR: dir } }),
      ),
    );
    const items = JSON.parse(readFileSync(join(dir, 'wf.json'), 'utf8')).items;
    expect(items).toHaveLength(12);
    expect(readFileSync(join(dir, 'wf-events.jsonl'), 'utf8').trim().split('\n')).toHaveLength(13);
    expect(readdirSync(dir).sort()).toEqual(['wf-events.jsonl', 'wf.json']);
  }, 30000);

  it('stall hint says to change approach and never to stop', () => {
    let s = withItems();
    for (let i = 0; i < STALL_AFTER; i += 1) s = reduce(s, { type: 'heartbeat', ts: T });
    expect(renderStatus(s)).toContain('не зупинятись');
  });
});

describe('wf hardening, round 3', () => {
  it('rejects negative stall, duplicate ids, bad task id and blocked item without a category', () => {
    const bodies = [
      '{"task":{"id":"T"},"items":[],"stall":-5}',
      '{"task":{"id":"T"},"items":[{"id":"a","status":"todo"},{"id":"a","status":"todo"}]}',
      '{"task":{"id":"bad id"},"items":[]}',
      '{"task":{"id":"T"},"items":[{"id":"a","status":"blocked"}]}',
    ];
    for (const body of bodies) {
      const dir = mkdtempSync(join(tmpdir(), 'wf-'));
      writeFileSync(join(dir, 'wf.json'), body);
      expect(run(['status'], { dir, now: T }).code).toBe(2);
    }
  });
});

describe('wf verify gate (SPO-642, D+)', () => {
  it('an item added with --verify closes only with a PASS verdict file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-'));
    const file = (name: string, body: unknown) => {
      const f = join(dir, name);
      writeFileSync(f, JSON.stringify(body));
      return f;
    };
    run(['start', 'S'], { dir, now: T });
    run(['add', 'a', '--verify'], { dir, now: T });
    expect(run(['done', 'a', '--evidence', 'x'], { dir, now: T }).code).toBe(2);
    const fail = file('f.json', { verdict: 'FAIL', verifiers: ['verify-ac'] });
    expect(run(['done', 'a', '--evidence', 'x', '--verdict', fail], { dir, now: T }).code).toBe(2);
    const empty = file('e.json', { verdict: 'PASS', verifiers: [] });
    expect(run(['done', 'a', '--evidence', 'x', '--verdict', empty], { dir, now: T }).code).toBe(2);
    const pass = file('p.json', { verdict: 'PASS', verifiers: ['verify-ac', 'verify-tests'] });
    expect(run(['done', 'a', '--evidence', 'x', '--verdict', pass], { dir, now: T }).code).toBe(0);
    expect(
      run(['done', 'a', '--evidence', 'x', '--verdict', '/nope.json'], { dir, now: T }).code,
    ).toBe(2);
  });

  it('items without --verify are unaffected', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-'));
    run(['start', 'S'], { dir, now: T });
    run(['add', 'a'], { dir, now: T });
    expect(run(['done', 'a', '--evidence', 'x'], { dir, now: T }).code).toBe(0);
  });
});

describe('wf stop hook decision (WF-C)', () => {
  const now = 10_000_000_000;
  const st = (items: { id: string; status: string }[]) => ({ task: { id: 'SPO-1' }, items });
  it('blocks while open items without blocker exist and names the next one', () => {
    const d = decideStop({
      state: st([
        { id: 'a', status: 'done' },
        { id: 'b', status: 'todo' },
      ]),
      mtimeMs: now,
      now,
    });
    expect(d.block).toBe(true);
    expect(d.reason).toContain('b');
  });
  it('prefers the item in progress as next', () => {
    const d = decideStop({
      state: st([
        { id: 'a', status: 'todo' },
        { id: 'b', status: 'doing' },
      ]),
      mtimeMs: now,
      now,
    });
    expect(d.reason).toContain('Далі: b');
  });
  it.each([
    [
      'nothing open',
      st([
        { id: 'a', status: 'done' },
        { id: 'b', status: 'blocked' },
      ]),
    ],
    ['no task', { task: null, items: [] }],
  ])('lets the turn end: %s', (_n, state) => {
    expect(decideStop({ state, mtimeMs: now, now }).block).toBe(false);
  });
  it('blocks on a tool-liftable (access) or reason-less blocker, lets a justified one end the turn', () => {
    const mk = (extra: object) =>
      st([{ id: 'a', status: 'blocked', ...extra } as { id: string; status: string }]);
    const d = decideStop({ state: mk({ needs: 'access', reason: 'x' }), mtimeMs: now, now });
    expect(d.block).toBe(true);
    expect(d.reason).toContain('wf unblock a');
    expect(decideStop({ state: mk({ needs: 'legal', reason: '' }), mtimeMs: now, now }).block).toBe(
      true,
    );
    expect(
      decideStop({ state: mk({ needs: 'legal', reason: 'потрібен юрист' }), mtimeMs: now, now })
        .block,
    ).toBe(false);
  });
  it('never traps: stop_hook_active, stale state, missing state', () => {
    const open = st([{ id: 'a', status: 'todo' }]);
    expect(
      decideStop({ input: { stop_hook_active: true }, state: open, mtimeMs: now, now }).block,
    ).toBe(false);
    expect(decideStop({ state: open, mtimeMs: now - FRESH_MS - 1, now }).block).toBe(false);
    expect(decideStop({ state: undefined, now }).block).toBe(false);
  });
});

describe('wf verify gate, mutation-survivor guards', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-'));
    run(['start', 'S'], { dir, now: T });
    run(['add', '--verify', 'a'], { dir, now: T }); // flag BEFORE the id must not swallow it
    return dir;
  };

  it('--verify before the id still adds the item with the gate on', () => {
    const dir = setup();
    const state = JSON.parse(readFileSync(join(dir, 'wf.json'), 'utf8'));
    expect(state.items.map((i: { id: string; verify?: boolean }) => [i.id, i.verify])).toEqual([
      ['a', true],
    ]);
  });

  it.each([
    ['missing file', () => '/definitely/not/here.json'],
    [
      'broken JSON',
      (dir: string) => {
        const f = join(dir, 'broken.json');
        writeFileSync(f, '{nope');
        return f;
      },
    ],
  ])('open verify item stays open with %s (not an invalid-transition fluke)', (_n, make) => {
    const dir = setup();
    const r = run(['done', 'a', '--evidence', 'x', '--verdict', make(dir)], { dir, now: T });
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/PASS/);
    const state = JSON.parse(readFileSync(join(dir, 'wf.json'), 'utf8'));
    expect(state.items[0].status).toBe('todo');
  });

  it('state with a non-boolean verify flag is rejected', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-'));
    writeFileSync(
      join(dir, 'wf.json'),
      '{"task":{"id":"T"},"items":[{"id":"a","status":"todo","verify":"x"}]}',
    );
    expect(run(['status'], { dir, now: T }).code).toBe(2);
  });
});

describe('wf report (SPO-643)', () => {
  it('renders checklist, progress and the owner queue for the Linear comment', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-'));
    run(['start', 'S'], { dir, now: T });
    run(['add', 'a', '--text', 'first'], { dir, now: T });
    run(['add', 'b'], { dir, now: T });
    run(['done', 'a', '--evidence', 'x'], { dir, now: T });
    run(['block', 'b', '--needs', 'cpd', '--reason', 'push'], { dir, now: T });
    const r = run(['report', '--at', '02:15'], { dir, now: T });
    expect(r.code).toBe(0);
    expect(r.out).toContain('**Прогрес 02:15 · 1/2 (50%) · лишилось 50%**');
    expect(r.out).toContain('- [x] a first');
    expect(r.out).toContain('- [ ] b — _чекає на мене: cpd_');
    expect(r.out).toContain('**Чекає на мене (1):** b [cpd] push');
  });
  it('is rejected without an active task', () => {
    expect(run(['report'], { dir: mkdtempSync(join(tmpdir(), 'wf-')) }).code).toBe(2);
  });
});
