import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  appendEntry,
  buildEntry,
  checkRegistration,
  journalDirs,
  noteError,
  readJournalDirs,
  readJournalText,
  REQUIRED_EVENTS,
  toolName,
} from '../scripts/lib/journal.mjs';

const ROOT = resolve(__dirname, '..');
// same filesystem as the repo on purpose: O_APPEND behaviour is a property of the filesystem (spec §5 #14)
const BASE = join(ROOT, '.claude/state');
mkdirSync(BASE, { recursive: true });
const work = mkdtempSync(join(BASE, 'jtest-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('buildEntry: whitelist, no PII', () => {
  it('keeps only ids, enums and numbers', () => {
    const e = buildEntry(
      'PostToolUse',
      {
        session_id: 's1',
        tool_name: 'Bash',
        tool_use_id: 'toolu_1',
        tool_input: { command: 'curl -H "Authorization: secret" https://x' },
        transcript_path: '/home/me/.claude/projects/x.jsonl',
        prompt: 'my private text',
        tool_response: { is_error: true },
      },
      { task: 'SPO-639', open: 2, now: 5 },
    ) as Record<string, unknown>;
    expect(Object.keys(e).sort()).toEqual(
      ['agent', 'id', 'ev', 'key', 'ok', 'open', 'sid', 'task', 'tool', 'ts', 'v'].sort(),
    );
    expect(JSON.stringify(e)).not.toMatch(/secret|private|home|curl/);
    expect(e.ok).toBe(false);
  });
  it('reduces MCP tool names and survives hostile or missing input', () => {
    expect(toolName('mcp__claude_ai__send__x')).toBe('mcp__claude_ai');
    expect(toolName('bad name!')).toBe('other');
    for (const input of [null, undefined, 5, 'x', [], { session_id: 5 }, { tool_name: {} }]) {
      const e = buildEntry('Stop', input, { now: 1 }) as { sid: string; ev: string };
      expect(e.sid).toBe('unknown');
      expect(e.ev).toBe('Stop');
    }
  });
  it('is deterministic for the same tool_use_id (dedupe key)', () => {
    const a = buildEntry('PreToolUse', { session_id: 's', tool_use_id: 'u1' }, { now: 1 });
    const b = buildEntry('PreToolUse', { session_id: 's', tool_use_id: 'u1' }, { now: 9 });
    expect(a.id).toBe(b.id);
  });
  it('marks subagents and repeated Stop', () => {
    expect(buildEntry('PreToolUse', { agent_id: 'a1' }, {}).agent).toBe('sub');
    expect(buildEntry('Stop', { stop_hook_active: true }, {}).again).toBe(true);
  });
});

describe('append and fallback', () => {
  it('writes one line and falls back when the primary dir is unusable', () => {
    const blocker = join(work, 'blocker');
    writeFileSync(blocker, 'a file where a directory should be');
    const good = join(work, 'good');
    const e = buildEntry('Stop', { session_id: 'fb' }, { now: 1 });
    const r = appendEntry(e, [join(blocker, 'journal'), good]);
    expect(r.ok).toBe(true);
    expect(r.dir).toBe(good);
    expect(r.failed).toHaveLength(1);
    expect(readFileSync(join(good, 'fb.ndjson'), 'utf8').trim().split('\n')).toHaveLength(1);
  });
  it('reports failure instead of throwing when nothing is writable', () => {
    const blocker = join(work, 'blocker');
    const r = appendEntry(buildEntry('Stop', { session_id: 'x' }, {}), [
      join(blocker, 'a'),
      join(blocker, 'b'),
    ]);
    expect(r.ok).toBe(false);
    expect(noteError('write-failed', [join(blocker, 'a')])).toBe(false);
  });
  it('trims an oversized line instead of dropping the event', () => {
    const big = { ...buildEntry('Stop', { session_id: 'big' }, {}), tool: 'x'.repeat(2000) };
    const dir = join(work, 'big');
    expect(appendEntry(big, [dir]).ok).toBe(true);
    expect(readJournalDirs([dir]).entries).toHaveLength(1);
  });
});

describe('tolerant reader', () => {
  it('skips a truncated tail and counts it, keeps the rest', () => {
    const good = JSON.stringify(buildEntry('Stop', { session_id: 's' }, { now: 2 }));
    const early = JSON.stringify(
      buildEntry('PreToolUse', { session_id: 's', tool_use_id: 'a' }, { now: 1 }),
    );
    const r = readJournalText(`${good}\n${early}\n{"v":1,"ev":"Sto`);
    expect(r.bad).toBe(1);
    expect(r.entries.map((x: { ts: number }) => x.ts)).toEqual([1, 2]);
  });
  it('keeps unknown event kinds and extra fields (forward compatible)', () => {
    const r = readJournalText(
      `${JSON.stringify({ v: 9, ev: 'Future', ts: 3, id: 'z', extra: 1 })}\n`,
    );
    expect(r.entries[0]).toMatchObject({ ev: 'Future', extra: 1 });
  });
  it('is stable for shuffled lines and merges duplicate ids across directories', () => {
    const l = [1, 2, 3].map((n) =>
      JSON.stringify(buildEntry('Stop', { session_id: 's', tool_use_id: `k${n}` }, { now: n })),
    );
    const a = join(work, 'ra');
    const b = join(work, 'rb');
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(join(a, 's.ndjson'), `${[l[2], l[0], l[1]].join('\n')}\n`);
    writeFileSync(join(b, 's.ndjson'), `${l[0]}\n`);
    const r = readJournalDirs([a, b]);
    expect(r.entries.map((x: { ts: number }) => x.ts)).toEqual([1, 2, 3]);
  });
});

describe('chaos: concurrent writers', () => {
  it('20 processes x 200 events give exactly 4000 valid lines in one file', async () => {
    const dir = join(work, 'chaos');
    const lib = join(ROOT, 'scripts/lib/journal.mjs');
    const code = `import('${lib}').then(m=>{for(let i=0;i<200;i++){const e=m.buildEntry('PostToolUse',{session_id:'chaos',tool_name:'Bash',tool_use_id:'u'+process.pid+'_'+i},{now:Date.now(),nonce:i});m.appendEntry(e,['${dir}'])}})`;
    await Promise.all(
      Array.from(
        { length: 20 },
        () =>
          new Promise<void>((res, rej) => {
            const p = spawn(process.execPath, ['-e', code]);
            p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`exit ${c}`))));
          }),
      ),
    );
    const text = readFileSync(join(dir, 'chaos.ndjson'), 'utf8');
    const r = readJournalText(text);
    expect(r.bad).toBe(0);
    expect(r.entries).toHaveLength(4000);
    expect(new Set(r.entries.map((x: { id: string }) => x.id)).size).toBe(4000);
  }, 60000);
});

describe('recorder CLI is fail-open and silent', () => {
  const run = (event: string, stdin: string, env: Record<string, string> = {}) =>
    spawnSync(process.execPath, [join(ROOT, 'scripts/journal-hook.mjs'), event], {
      input: stdin,
      encoding: 'utf8',
      env: { ...process.env, WF_STATE_DIR: join(work, 'cli'), ...env },
    });
  it('exits 0 with empty stdout on garbage input and still records', () => {
    for (const ev of ['PreToolUse', 'PostToolUse', 'Stop', 'Notification']) {
      const r = run(ev, '}{ not json');
      expect(r.status).toBe(0);
      expect(r.stdout).toBe('');
    }
    expect(readdirSync(join(work, 'cli/journal')).length).toBeGreaterThan(0);
  });
  it('exits 0 even when the state dir cannot be created', () => {
    const blocker = join(work, 'blocker');
    const r = run('PreToolUse', '{}', { WF_STATE_DIR: join(blocker, 'deep') });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
  it('records within a realistic time budget (process start included)', () => {
    const times: number[] = [];
    for (let i = 0; i < 12; i++) {
      const t = Date.now();
      run('PostToolUse', JSON.stringify({ session_id: 'perf', tool_name: 'Read' }));
      times.push(Date.now() - t);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length * 0.9)]).toBeLessThan(600); // soft: catches regressions, not noise
  });
});

describe('registration check', () => {
  const rec = (matcher?: string) => ({
    ...(matcher === undefined ? {} : { matcher }),
    hooks: [
      { type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/scripts/journal-hook.mjs" X || true' },
    ],
  });
  const full = () =>
    Object.fromEntries(
      REQUIRED_EVENTS.map((ev) => [ev, [rec(ev.endsWith('ToolUse') ? '*' : undefined)]]),
    );
  it('passes when every event has the recorder', () => {
    expect(checkRegistration([{ hooks: full() }]).ok).toBe(true);
  });
  it('flags a missing event, a Bash-only matcher and disabled hooks', () => {
    const h = full() as Record<string, unknown[]>;
    delete h.Stop;
    h.PreToolUse = [rec('Bash')];
    const r = checkRegistration([{ hooks: h, disableAllHooks: true }]);
    expect(r.missing).toEqual(['Stop']);
    expect(r.badMatcher).toEqual(['PreToolUse']);
    expect(r.disabled).toBe(true);
  });
  it('adds hooks from several settings files', () => {
    const h = full() as Record<string, unknown[]>;
    const local = { hooks: { Stop: h.Stop } };
    delete h.Stop;
    expect(checkRegistration([{ hooks: h }, local]).ok).toBe(true);
  });
  it('journalDirs puts the state dir first', () => {
    expect(journalDirs({ stateDir: '/s', home: '/h', tmp: '/t' })[0]).toBe('/s/journal');
  });
});
