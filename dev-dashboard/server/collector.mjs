/**
 * SPO-639 (W17 B3): collector for the Dev Console. Unit = task: union of the active wf task, `ready-for-cpd/SPO-N`
 * branches and unmerged `SPO-N*` branches. Read-only; git and the file system are injected so it is testable.
 * Output strings are short identifiers/counters only (no free text, no PII) and pass `validateSnapshot`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const SNAPSHOT_V = 1;
const TASK_RE = /^SPO-\d{1,5}$/;
const STATUSES = ['todo', 'doing', 'done', 'blocked'];
const PROTECTED = /^(main|master|HEAD|origin|develop|release\/.*)$/;

/** `ready-for-cpd/SPO-639` | `SPO-639-foo` | `feature/SPO-639` -> `SPO-639`, else null. */
/** @param {string} name */
export function taskOfBranch(name) {
  const m = /(?:^|\/)(SPO-\d{1,5})(?:[-_/].*)?$/.exec(String(name));
  return m ? m[1] : null;
}

/** Deploy marker after prod: only `ready-for-cpd/*` branches whose tip is contained in a deployed SHA of the same task. */
/**
 * @param {{ branches: { name: string, sha: string }[], deployed: { task: string, sha: string }[], isAncestor: (a: string, b: string) => boolean }} o
 */
export function selectBranchesToDelete({ branches, deployed, isAncestor }) {
  const out = [];
  for (const b of branches) {
    if (!b || typeof b.name !== 'string' || PROTECTED.test(b.name)) continue;
    if (!b.name.startsWith('ready-for-cpd/')) continue;
    const task = taskOfBranch(b.name);
    if (!task) continue;
    const dep = deployed.find((d) => d.task === task);
    if (!dep) continue;
    let contained;
    try {
      contained = isAncestor(b.sha, dep.sha) === true;
    } catch {
      contained = false;
    }
    if (contained) out.push(b.name);
  }
  return out.sort();
}

/** @param {string} root @param {string} task @returns {any[]} */
function shardsOf(root, task) {
  const dir = join(root, 'docs/reviews/dash', task);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(readFileSync(join(dir, f), 'utf8')));
    } catch {
      /* a broken shard is skipped; health shows it */
    }
  }
  return out;
}

/** @param {any[]} shards */
function mergeShards(shards) {
  const sum = {
    sessions: shards.length,
    prompts: 0,
    stops: 0,
    unforced: 0,
    nudges: 0,
    tools: 0,
    compactions: 0,
    lastTs: null,
  };
  for (const s of shards) {
    sum.prompts += s.turns?.prompts ?? 0;
    sum.stops += s.turns?.stops ?? 0;
    sum.unforced += s.turns?.unforced ?? 0;
    sum.nudges += s.turns?.nudges ?? 0;
    sum.tools += Object.values(s.counts?.tools ?? {}).reduce(
      (a, b) => a + (typeof b === 'number' ? b : 0),
      0,
    );
    sum.compactions += Array.isArray(s.compactions) ? s.compactions.length : 0;
    if (typeof s.lastTs === 'number' && (sum.lastTs === null || s.lastTs > sum.lastTs))
      sum.lastTs = s.lastTs;
  }
  return sum;
}

/** @param {string} root @param {string} [stateDir] @returns {any} */
function readWf(root, stateDir) {
  try {
    return JSON.parse(
      readFileSync(join(stateDir ?? join(root, '.claude/state'), 'wf.json'), 'utf8'),
    );
  } catch {
    return null;
  }
}

/**
 * @param {{ root: string, stateDir?: string, git: (...args: string[]) => string, now?: number }} o
 */
export function collect({ root, stateDir, git, now = Date.now() }) {
  /** @param {...string} a */
  const safeGit = (...a) => {
    try {
      return git(...a);
    } catch {
      return '';
    }
  };
  const ready = new Map();
  for (const line of safeGit('branch', '-a', '--format=%(refname:short) %(objectname)').split(
    '\n',
  )) {
    const [name, sha] = line.trim().split(' ');
    if (!name) continue;
    const clean = name.replace(/^origin\//, '');
    if (clean.startsWith('ready-for-cpd/')) ready.set(clean, sha ?? '');
  }
  const unmerged = new Set(
    safeGit('branch', '--no-merged', 'origin/main', '--format=%(refname:short)')
      .split('\n')
      .map((n) => taskOfBranch(n.trim()))
      .filter(Boolean),
  );
  const wf = readWf(root, stateDir);
  const ids = new Set();
  if (wf?.task?.id && TASK_RE.test(wf.task.id)) ids.add(wf.task.id);
  for (const name of ready.keys()) {
    const t = taskOfBranch(name);
    if (t) ids.add(t);
  }
  for (const t of unmerged) ids.add(t);

  const tasks = [...ids].sort().map((id) => {
    const isWf = wf?.task?.id === id;
    const items = isWf && Array.isArray(wf.items) ? wf.items : [];
    const counts = Object.fromEntries(
      STATUSES.map((s) => [s, items.filter((/** @type {any} */ i) => i.status === s).length]),
    );
    const done = counts.done;
    const branch = [...ready.keys()].find((n) => taskOfBranch(n) === id) ?? null;
    return {
      id,
      source: isWf ? 'wf' : branch ? 'ready' : 'branch',
      plan: {
        total: items.length,
        ...counts,
        pct: items.length ? Math.round((done / items.length) * 100) : 0,
      },
      blocked: items
        .filter((/** @type {any} */ i) => i.status === 'blocked')
        .map((/** @type {any} */ i) => ({ id: i.id, needs: i.needs })),
      branch,
      capture: mergeShards(shardsOf(root, id)),
    };
  });
  return { v: SNAPSHOT_V, generatedAt: now, tasks, readyBranches: [...ready.keys()].sort() };
}

const SECRET_LIKE =
  /(ghp_|github_pat_|sk-[A-Za-z0-9]|lin_api_|AIza|xox[abp]-|[A-Za-z0-9+/_-]{32,})/;
const EMAIL_LIKE = /\S+@\S+\.\S+/;

/** Returns a list of problems; empty = safe to serve/commit. Every string must be short and free of token/email shapes. */
/** @param {any} snapshot @returns {string[]} */
export function validateSnapshot(snapshot) {
  /** @type {string[]} */
  const problems = [];
  /** @param {any} v @param {string} path @returns {void} */
  const walk = (v, path) => {
    if (typeof v === 'string') {
      if (v.length > 80) problems.push(`${path}: longer than 80 chars`);
      if (EMAIL_LIKE.test(v)) problems.push(`${path}: looks like an email`);
      if (SECRET_LIKE.test(v)) problems.push(`${path}: looks like a token`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(snapshot, '$');
  if (snapshot?.v !== SNAPSHOT_V) problems.push('$.v: unknown schema version');
  for (const t of snapshot?.tasks ?? [])
    if (!TASK_RE.test(t.id)) problems.push(`task id invalid: ${String(t.id).slice(0, 20)}`);
  return problems;
}
