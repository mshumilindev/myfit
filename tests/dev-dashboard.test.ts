import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM without types
import { checkRequest, safeStaticPath } from '../dev-dashboard/server/guard.mjs';
// @ts-expect-error plain ESM without types
import { createDashServer } from '../dev-dashboard/server/server.mjs';
// @ts-expect-error plain ESM without types
import {
  collect,
  selectBranchesToDelete,
  taskOfBranch,
  validateSnapshot,
} from '../dev-dashboard/server/collector.mjs';

const ROOT = resolve(__dirname, '..');
const BASE = join(ROOT, '.claude/state');
mkdirSync(BASE, { recursive: true });
const work = mkdtempSync(join(BASE, 'dash-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const ok = { method: 'GET', headers: { host: '127.0.0.1:5174' }, remote: '127.0.0.1' };

describe('request guard', () => {
  it('accepts loopback GET on our host', () => {
    expect(checkRequest(ok, 5174).ok).toBe(true);
    expect(
      checkRequest({ ...ok, headers: { host: 'localhost:5174' }, remote: '::1' }, 5174).ok,
    ).toBe(true);
    expect(
      checkRequest(
        { ...ok, headers: { host: '127.0.0.1:5174', origin: 'http://127.0.0.1:5174' } },
        5174,
      ).ok,
    ).toBe(true);
  });
  it('rejects writes, foreign hosts (DNS rebinding), foreign origins and non-loopback sockets', () => {
    expect(checkRequest({ ...ok, method: 'POST' }, 5174)).toMatchObject({ ok: false, status: 405 });
    expect(checkRequest({ ...ok, method: 'DELETE' }, 5174).ok).toBe(false);
    expect(checkRequest({ ...ok, headers: { host: 'evil.example:5174' } }, 5174)).toMatchObject({
      status: 403,
      why: 'host',
    });
    expect(checkRequest({ ...ok, headers: { host: '127.0.0.1:9999' } }, 5174).ok).toBe(false);
    expect(
      checkRequest(
        { ...ok, headers: { host: '127.0.0.1:5174', origin: 'https://evil.example' } },
        5174,
      ),
    ).toMatchObject({ why: 'origin' });
    expect(checkRequest({ ...ok, remote: '192.168.1.5' }, 5174)).toMatchObject({
      status: 403,
      why: 'remote',
    });
    expect(checkRequest({ ...ok, remote: undefined }, 5174).ok).toBe(false);
  });
  it('static paths cannot leave the UI root or reach vite-style internals', () => {
    expect(safeStaticPath('/')).toBe('index.html');
    expect(safeStaticPath('/app.js?x=1')).toBe('app.js');
    for (const bad of [
      '/../secret',
      '/a/../../x',
      '/%2e%2e/x',
      '/@fs/etc/passwd',
      '/a\\b',
      '/%00',
      '/%E0%A4%A',
    ]) {
      expect(safeStaticPath(bad)).toBeNull();
    }
  });
});

describe('server', () => {
  const uiRoot = join(work, 'ui');
  mkdirSync(uiRoot, { recursive: true });
  writeFileSync(join(uiRoot, 'index.html'), '<p>hi</p>');
  writeFileSync(join(work, 'secret.txt'), 'nope');
  const port = 5200 + Math.floor(Math.random() * 400);
  const server = createDashServer({ uiRoot, port, collect: () => ({ v: 1, tasks: [] }) });
  const get = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
    new Promise<{ status: number; body: string; headers: Record<string, unknown> }>((res, rej) => {
      const r = request(
        {
          host: '127.0.0.1',
          port,
          path,
          method,
          headers: { host: `127.0.0.1:${port}`, ...headers },
        },
        (m) => {
          let b = '';
          m.on('data', (c) => (b += c));
          m.on('end', () => res({ status: m.statusCode ?? 0, body: b, headers: m.headers }));
        },
      );
      r.on('error', rej);
      r.end();
    });
  it('serves UI and API read-only with hardening headers', async () => {
    await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
    try {
      expect((await get('/')).body).toContain('hi');
      const snap = await get('/api/snapshot');
      expect(JSON.parse(snap.body)).toEqual({ v: 1, tasks: [] });
      expect(snap.headers['cache-control']).toBe('no-store');
      expect(snap.headers['x-content-type-options']).toBe('nosniff');
      expect(String(snap.headers['content-security-policy'])).toContain("default-src 'self'");
      expect((await get('/api/health')).status).toBe(200);
      expect((await get('/api/nope')).status).toBe(404);
      expect((await get('/', {}, 'POST')).status).toBe(405);
      expect((await get('/', { host: 'evil.example' })).status).toBe(403);
      expect((await get('/', { origin: 'https://evil.example' })).status).toBe(403);
      expect((await get('/%2e%2e/secret.txt')).status).toBe(404);
      expect((await get('/@fs/etc/passwd')).status).toBe(404);
      expect((await get('/missing.js')).status).toBe(404);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

describe('collector', () => {
  const root = join(work, 'repo');
  mkdirSync(join(root, 'docs/reviews/dash/SPO-639'), { recursive: true });
  mkdirSync(join(root, '.claude/state'), { recursive: true });
  writeFileSync(
    join(root, '.claude/state/wf.json'),
    JSON.stringify({
      task: { id: 'SPO-639' },
      items: [
        { id: 'A', status: 'done' },
        { id: 'B', status: 'blocked', needs: 'cpd' },
        { id: 'C', status: 'todo' },
        { id: 'D', status: 'doing' },
      ],
    }),
  );
  writeFileSync(
    join(root, 'docs/reviews/dash/SPO-639/s1.json'),
    JSON.stringify({
      lastTs: 50,
      turns: { prompts: 3, stops: 2, unforced: 1, nudges: 1 },
      counts: { tools: { Bash: 4, Read: 1 } },
      compactions: [{ ts: 1 }],
    }),
  );
  writeFileSync(join(root, 'docs/reviews/dash/SPO-639/broken.json'), '{nope');
  const git = (...a: string[]) => {
    if (a[0] === 'branch' && a.includes('--no-merged')) return 'SPO-700-foo\nmain\nfeature/SPO-701';
    if (a[0] === 'branch')
      return 'ready-for-cpd/SPO-650 abc123\norigin/ready-for-cpd/SPO-651 def456\nmain 000';
    return '';
  };
  it('unit = task: wf task ∪ ready branches ∪ unmerged branches, with plan and capture numbers', () => {
    const snap = collect({ root, git, now: 1000 });
    expect(snap.tasks.map((t: { id: string }) => t.id)).toEqual([
      'SPO-639',
      'SPO-650',
      'SPO-651',
      'SPO-700',
      'SPO-701',
    ]);
    const t = snap.tasks[0];
    expect(t.plan).toMatchObject({ total: 4, done: 1, blocked: 1, todo: 1, doing: 1, pct: 25 });
    expect(t.blocked).toEqual([{ id: 'B', needs: 'cpd' }]);
    expect(t.capture.byTool).toEqual({ Bash: 4, Read: 1 });
    expect(t.items).toHaveLength(4);
    expect(t.docs).toEqual([]);
    expect(t.risks.total).toBe(0);
    expect(snap.rules).toEqual([]);
    expect(t.capture).toMatchObject({
      sessions: 1,
      prompts: 3,
      unforced: 1,
      nudges: 1,
      tools: 5,
      compactions: 1,
      lastTs: 50,
    });
    expect(snap.readyBranches).toEqual(['ready-for-cpd/SPO-650', 'ready-for-cpd/SPO-651']);
    expect(validateSnapshot(snap)).toEqual([]);
  });
  it('survives git failing and a missing wf state', () => {
    const snap = collect({
      root: join(work, 'empty'),
      git: () => {
        throw new Error('no git');
      },
    });
    expect(snap.tasks).toEqual([]);
  });
  it('rejects tokens, emails and long text; accepts clean data', () => {
    const base = { v: 1, tasks: [] };
    expect(validateSnapshot({ ...base, x: 'ghp_' + 'a'.repeat(30) }).length).toBeGreaterThan(0);
    expect(validateSnapshot({ ...base, x: 'a'.repeat(40) }).length).toBeGreaterThan(0);
    expect(validateSnapshot({ ...base, x: 'me@example.com' }).length).toBeGreaterThan(0);
    expect(validateSnapshot({ ...base, x: 'z'.repeat(81) }).length).toBeGreaterThan(0);
    expect(validateSnapshot({ ...base, tasks: [{ id: 'bad' }] }).length).toBeGreaterThan(0);
    expect(validateSnapshot({ v: 2, tasks: [] })).toContain('$.v: unknown schema version');
    expect(
      validateSnapshot({ ...base, rules: ['risk-assessment', 'sk-' + 'a'.repeat(10)] }).length,
    ).toBe(1); // a real key shape, not the word risk-assessment
    expect(
      validateSnapshot({ ...base, docs: ['SPO-639-G-error-monitoring-spike-with-long-name'] }),
    ).toEqual([]); // kebab-case names are not tokens
    expect(validateSnapshot(base)).toEqual([]);
  });
  it('taskOfBranch', () => {
    expect(taskOfBranch('ready-for-cpd/SPO-639')).toBe('SPO-639');
    expect(taskOfBranch('feature/SPO-12-x')).toBe('SPO-12');
    expect(taskOfBranch('main')).toBeNull();
  });
});

describe('selectBranchesToDelete', () => {
  const branches = [
    { name: 'ready-for-cpd/SPO-1', sha: 'a' },
    { name: 'ready-for-cpd/SPO-2', sha: 'b' },
    { name: 'main', sha: 'c' },
    { name: 'SPO-1-feature', sha: 'd' },
    { name: 'ready-for-cpd/SPO-3', sha: 'e' },
  ];
  const deployed = [
    { task: 'SPO-1', sha: 'X' },
    { task: 'SPO-3', sha: 'Y' },
  ];
  it('deletes only ready branches of deployed tasks whose tip is contained in the deployed SHA', () => {
    const isAncestor = (s: string, d: string) =>
      (s === 'a' && d === 'X') || (s === 'e' && d === 'WRONG');
    expect(selectBranchesToDelete({ branches, deployed, isAncestor })).toEqual([
      'ready-for-cpd/SPO-1',
    ]);
  });
  it('never touches main or others, and a throwing check means keep', () => {
    expect(selectBranchesToDelete({ branches, deployed, isAncestor: () => true })).toEqual([
      'ready-for-cpd/SPO-1',
      'ready-for-cpd/SPO-3',
    ]);
    expect(
      selectBranchesToDelete({
        branches,
        deployed,
        isAncestor: () => {
          throw new Error('x');
        },
      }),
    ).toEqual([]);
  });
});

describe('tab closing (B7)', () => {
  it('closes only when deployed AND no ready branch is left', async () => {
    // @ts-expect-error plain ESM without types
    const { isClosed, readClosed } = await import('../dev-dashboard/server/collector.mjs');
    const closed = new Set(['SPO-1']);
    expect(isClosed({ id: 'SPO-1', closed, hasReadyBranch: false })).toBe(true);
    expect(isClosed({ id: 'SPO-1', closed, hasReadyBranch: true })).toBe(false);
    expect(isClosed({ id: 'SPO-2', closed, hasReadyBranch: false })).toBe(false);
    expect(readClosed(join(work, 'nothing')).size).toBe(0);
  });
  it('dash-close writes a valid list the collector drops tasks by, and rejects junk ids', () => {
    const state = join(work, 'closestate');
    const run = (id: string) =>
      spawnSync(process.execPath, [join(ROOT, 'scripts/dash-close.mjs'), id], {
        encoding: 'utf8',
        env: { ...process.env, WF_STATE_DIR: state },
      });
    expect(run('../etc').status).toBe(2);
    expect(run('SPO-639').status).toBe(0);
    expect(run('SPO-639').status).toBe(0); // idempotent
    const root = join(work, 'closeroot');
    mkdirSync(join(root, 'docs'), { recursive: true });
    const snap = collect({
      root,
      stateDir: state,
      git: (...a: string[]) => (a.includes('--no-merged') ? 'SPO-639-x\nSPO-640-y' : ''),
    });
    expect(snap.tasks.map((t: { id: string }) => t.id)).toEqual(['SPO-640']);
  });
});

describe('dev-all runner (B6)', () => {
  it('stops everything when the client dies, keeps the client when the console dies', async () => {
    // @ts-expect-error plain ESM without types
    const { runAll, childSpecs } = await import('../scripts/dev-all.mjs');
    expect(childSpecs().map((c: { name: string }) => c.name)).toEqual(['client', 'dev-console']);
    expect(childSpecs()[0].args).toContain('--strictPort');
    const node = (code: string) => ({ cmd: process.execPath, args: ['-e', code] });
    const logs: string[] = [];
    const sleeper = 'setTimeout(()=>{},30000)';
    const code1 = await runAll(
      [
        { name: 'client', ...node('process.exit(3)'), essential: true },
        { name: 'dev-console', ...node(sleeper), essential: false },
      ],
      { log: (s: string) => logs.push(s) },
    );
    expect(code1).toBe(3); // client died → console was terminated, no hang
    const code2 = await runAll(
      [
        { name: 'client', ...node('setTimeout(()=>process.exit(0),700)'), essential: true },
        { name: 'dev-console', ...node('process.exit(1)'), essential: false },
      ],
      { log: (s: string) => logs.push(s) },
    );
    expect(code2).toBe(0);
    expect(logs.join('\n')).toContain('the client keeps running');
  }, 20000);
});

describe('task data for the tabs (W18)', () => {
  it('reads documents, risk impact counts, plan items and rule names without content', async () => {
    // @ts-expect-error plain ESM without types
    const { docsOf, risksOf, rulesOf } = await import('../dev-dashboard/server/collector.mjs');
    const root = join(work, 'tabs');
    mkdirSync(join(root, 'docs/plans'), { recursive: true });
    mkdirSync(join(root, 'docs/specs'), { recursive: true });
    mkdirSync(join(root, '.claude/rules'), { recursive: true });
    writeFileSync(join(root, 'docs/specs/SPO-9-spike.md'), 'x');
    writeFileSync(join(root, 'docs/plans/SPO-9-dev-plan.md'), 'x');
    writeFileSync(join(root, 'docs/plans/SPO-10-other.md'), 'x');
    writeFileSync(
      join(root, 'docs/plans/SPO-9-risk.md'),
      '| R1 | a | L | **H** | m |\n| R2 | b | M | M | m |\n| R3 | c | M | L | m |\n| R1 | dup | L | H | m |\n',
    );
    writeFileSync(join(root, '.claude/rules/tests.md'), 'x');
    expect(docsOf(root, 'SPO-9').map((d: { kind: string }) => d.kind)).toEqual([
      'spike',
      'plan',
      'risk',
    ]);
    expect(docsOf(root, 'SPO-9')).toHaveLength(3);
    expect(risksOf(root, 'SPO-9')).toEqual({ total: 3, high: 1, medium: 1, low: 1 });
    expect(rulesOf(root)).toEqual(['tests']);
    expect(risksOf(root, 'SPO-77')).toEqual({ total: 0, high: 0, medium: 0, low: 0 });
  });
});
