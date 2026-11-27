import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  utimesSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildEntry, readJournalDirs } from '../scripts/lib/journal.mjs';
import {
  buildShard,
  loadTranscript,
  parseTranscript,
  reconcile,
  validateShard,
  writeShard,
} from '../scripts/lib/capture-rollup.mjs';

const ROOT = resolve(__dirname, '..');
const BASE = join(ROOT, '.claude/state');
mkdirSync(BASE, { recursive: true });
const work = mkdtempSync(join(BASE, 'rtest-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const T0 = Date.parse('2026-11-28T00:00:00Z');
const line = (o: unknown) => JSON.stringify(o);
const assistant = (id: string, minutes: number, side = false) =>
  line({
    type: 'assistant',
    isSidechain: side,
    timestamp: new Date(T0 + minutes * 60000).toISOString(),
    message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command: 'SECRET' } }] },
  });
const user = (text: string) =>
  line({ type: 'user', message: { content: [{ type: 'text', text }] } });
const toolResult = () =>
  line({ type: 'user', toolUseResult: {}, message: { content: [{ type: 'tool_result' }] } });
const pre = (key: string, n: number, extra = {}) =>
  buildEntry(
    'PreToolUse',
    { session_id: 's1', tool_name: 'Bash', tool_use_id: key, ...extra },
    { now: T0 + n * 60000, task: 'SPO-639' },
  );

describe('parseTranscript', () => {
  it('reads tool ids and prompts, ignores the unfinished last line and tool results', () => {
    const text = [
      user('hello'),
      assistant('toolu_a', 1),
      toolResult(),
      assistant('toolu_b', 2, true),
      '{"type":"assis',
    ].join('\n');
    const t = parseTranscript(text);
    expect(t.tools.map((x: { id: string }) => x.id)).toEqual(['toolu_a', 'toolu_b']);
    expect(t.prompts).toBe(1);
  });
  it('dedupes repeated tool ids and never keeps command text', () => {
    const t = parseTranscript([assistant('toolu_a', 1), assistant('toolu_a', 1), ''].join('\n'));
    expect(t.tools).toHaveLength(1);
    expect(JSON.stringify(t)).not.toContain('SECRET');
  });
  it('flags an unknown format instead of reporting zero events as healthy', () => {
    const t = parseTranscript(['{"foo":1}', '{"bar":2}', ''].join('\n'));
    expect(t.unreadable).toBe(true);
    expect(reconcile([pre('k', 1)], t).state).toBe('transcript_unreadable');
  });
  it('survives garbage', () => {
    expect(parseTranscript('}{\n\u0000\n[]\n').tools).toEqual([]);
    expect(loadTranscript('/nonexistent').transcript).toBeNull();
  });
});

describe('reconcile', () => {
  const tr = parseTranscript(
    [assistant('toolu_a', 1), assistant('toolu_b', 2), assistant('toolu_c', 3, true), ''].join(
      '\n',
    ),
  );
  it('ok when the journal has every tool call', () => {
    expect(reconcile([pre('toolu_a', 1), pre('toolu_b', 2), pre('toolu_c', 3)], tr).state).toBe(
      'ok',
    );
  });
  it('gap with backfill for missing calls, and backfill is idempotent', () => {
    const r1 = reconcile([pre('toolu_a', 1)], tr);
    expect(r1.state).toBe('gap');
    expect(r1.missing).toBe(2);
    expect(r1.backfill.map((b: { key: string }) => b.key)).toEqual(['toolu_b', 'toolu_c']);
    expect(r1.backfill[1].agent).toBe('sub');
    const merged = [pre('toolu_a', 1), ...r1.backfill];
    expect(reconcile(merged, tr).state).toBe('ok');
    const s1 = buildShard([...merged, ...r1.backfill], r1);
    const s2 = buildShard(merged, r1);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });
  it('gives no verdict while the transcript is still being written', () => {
    expect(reconcile([], tr, { settled: false }).state).toBe('unsettled');
  });
  it('falls back to counts when the journal has no tool_use_id', () => {
    const noKey = buildEntry('PreToolUse', { session_id: 's1', tool_name: 'Bash' }, { now: T0 });
    expect(reconcile([noKey], tr)).toMatchObject({ state: 'gap', missing: 2 });
  });
  it('a transcript file that was just touched is not settled', () => {
    const f = join(work, 'tr.jsonl');
    writeFileSync(f, `${assistant('toolu_a', 1)}\n`);
    expect(loadTranscript(f).settled).toBe(false);
    utimesSync(f, new Date(Date.now() - 60000), new Date(Date.now() - 60000));
    expect(loadTranscript(f).settled).toBe(true);
  });
});

describe('buildShard', () => {
  const stop = (n: number, open: number, blocked: number, again = false) =>
    buildEntry(
      'Stop',
      { session_id: 's1', stop_hook_active: again },
      { now: T0 + n * 60000, open, blocked, task: 'SPO-639', nonce: n },
    );
  const prompt = (n: number) =>
    buildEntry(
      'UserPromptSubmit',
      { session_id: 's1' },
      { now: T0 + n * 60000, task: 'SPO-639', nonce: n },
    );
  it('classifies stops, counts nudges, compactions and guard blocks', () => {
    const entries = [
      prompt(0),
      pre('k1', 1),
      stop(5, 3, 0),
      prompt(25), // unforced stop, owner nudged after 20 min
      stop(30, 0, 2),
      prompt(40), // legit blocker
      buildEntry('PreCompact', { session_id: 's1', trigger: 'auto' }, { now: T0 + 45 * 60000 }),
      buildEntry('GuardBlock', { session_id: 's1' }, { now: T0 + 46 * 60000, cat: 'pkill' }),
      stop(50, 0, 0),
      stop(51, 0, 0, true),
    ];
    const s = buildShard(entries);
    expect(s.turns).toMatchObject({ prompts: 3, unforced: 1, nudges: 1 });
    expect(s.stops.map((x: { kind: string }) => x.kind)).toEqual(['unforced', 'legit', 'done']);
    expect(s.stops[0].idleMs).toBe(20 * 60000);
    expect(s.compactions).toHaveLength(1);
    expect(s.counts.guard).toEqual({ pkill: 1 });
    expect(s.task).toBe('SPO-639');
  });
  it('a repeated Stop (stop_hook_active) does not count as a second stop', () => {
    expect(buildShard([prompt(0), stop(5, 1, 0), stop(6, 1, 0, true)]).turns.stops).toBe(1);
  });
  it('is stable for shuffled input and duplicate lines', () => {
    const a = [prompt(0), pre('k1', 1), pre('k2', 2), stop(3, 0, 0)];
    const b = [stop(3, 0, 0), pre('k2', 2), pre('k1', 1), pre('k1', 1), prompt(0)];
    expect(JSON.stringify(buildShard(a))).toBe(JSON.stringify(buildShard(b)));
  });
  it('rejects PII-shaped content', () => {
    const bad = buildShard([pre('k1', 1)]);
    (bad as unknown as { task: string }).task = 'me@example.com /home/user';
    expect(validateShard(bad).length).toBeGreaterThan(0);
    expect(writeShard(work, bad)).toMatchObject({ ok: false });
    expect(validateShard(buildShard([pre('k1', 1)]))).toEqual([]);
  });
});

describe('writeShard is idempotent', () => {
  it('second write changes nothing', () => {
    const s = buildShard([pre('k1', 1)]);
    expect(writeShard(work, s).written).toBe(true);
    expect(writeShard(work, s).written).toBe(false);
    expect(existsSync(join(work, 'docs/reviews/dash/SPO-639/s1.json'))).toBe(true);
  });
});

describe('recorder end to end', () => {
  const env = (name: string) => ({
    ...process.env,
    WF_STATE_DIR: join(work, name, 'state'),
    DASH_ROOT: join(work, name, 'dash'),
  });
  const run = (name: string, event: string, input: object) =>
    spawnSync(process.execPath, [join(ROOT, 'scripts/journal-hook.mjs'), event], {
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: env(name),
    });
  it('a Stop writes a shard that reconciles the transcript and backfills a lost event', () => {
    const f = join(work, 'e2e.jsonl');
    writeFileSync(f, [assistant('toolu_a', 1), assistant('toolu_b', 2), ''].join('\n'));
    utimesSync(f, new Date(Date.now() - 60000), new Date(Date.now() - 60000));
    run('e2e', 'PreToolUse', { session_id: 's9', tool_name: 'Bash', tool_use_id: 'toolu_a' }); // toolu_b is "lost"
    const r = run('e2e', 'Stop', { session_id: 's9', transcript_path: f });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    const shard = JSON.parse(
      readFileSync(join(work, 'e2e/dash/docs/reviews/dash/untasked/s9.json'), 'utf8'),
    );
    expect(shard.health).toMatchObject({ capture: 'gap', missing: 1 });
    expect(shard.counts.tools.Bash).toBe(2); // 1 live + 1 backfilled
    expect(JSON.stringify(shard)).not.toMatch(/SECRET|transcript|\.jsonl/);
  });
  it('a session killed without Stop still leaves a shard (rollup about every 4 KB)', () => {
    for (let i = 0; i < 60; i++)
      run('kill', 'PreToolUse', { session_id: 'k1', tool_name: 'Bash', tool_use_id: `toolu_${i}` });
    const dir = join(work, 'kill/dash/docs/reviews/dash/untasked');
    expect(readdirSync(dir)).toContain('k1.json');
    const shard = JSON.parse(readFileSync(join(dir, 'k1.json'), 'utf8'));
    expect(shard.counts.events.PreToolUse).toBeGreaterThan(10);
    expect(readJournalDirs([join(work, 'kill/state/journal')]).entries.length).toBe(60);
  }, 60000);
});

describe('degradation block and cpd freshness', () => {
  it('blocks a degraded recorder at most once per session', async () => {
    const { decideDegraded } = await import('../scripts/lib/wf-stop.mjs');
    const d = ['немає рекордера для: Stop'];
    expect(decideDegraded({ input: { session_id: 'a' }, degraded: d }).block).toBe(true);
    expect(decideDegraded({ input: { session_id: 'a' }, degraded: d, warnedSid: 'a' }).block).toBe(
      false,
    );
    expect(
      decideDegraded({ input: { session_id: 'a', stop_hook_active: true }, degraded: d }).block,
    ).toBe(false);
    expect(decideDegraded({ input: { session_id: 'b' }, degraded: d, warnedSid: 'a' }).block).toBe(
      true,
    );
    expect(decideDegraded({ input: {}, degraded: [] }).block).toBe(false);
  });
  it('judges shard freshness by event time', async () => {
    const { captureFreshness, renderPreflight } = await import('../scripts/lib/cpd-preflight.mjs');
    expect(captureFreshness({ journalTs: undefined, shardTs: 1 }).stale).toBe(false);
    expect(captureFreshness({ journalTs: 10 * 60000, shardTs: undefined }).stale).toBe(true);
    expect(captureFreshness({ journalTs: 10 * 60000, shardTs: 9 * 60000 }).stale).toBe(false);
    const f = captureFreshness({ journalTs: 20 * 60000, shardTs: 1000 });
    expect(f.stale).toBe(true);
    expect(renderPreflight({ branches: [], unpushed: 0, dirty: 0, capture: f })).toContain(
      'шарди запису застарілі',
    );
  });
  it('the real stop hook stays silent and exits 0 on a clean state', () => {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts/wf-stop-hook.mjs')], {
      input: JSON.stringify({ session_id: 'z' }),
      encoding: 'utf8',
      env: { ...process.env, WF_STATE_DIR: join(work, 'nostate') },
    });
    expect(r.status).toBe(0);
  });
});
