/**
 * SPO-639 (WF-A): `wf` core + CLI. Contracts: done needs evidence, journal never holds text/evidence,
 * status stays ≤12 lines, stall hints change of approach (never stop).
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
