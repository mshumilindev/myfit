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
  // case-insensitive: local work branches are often lower-case (`spo-608-localhost`)
  const m = /(?:^|\/)(SPO-\d{1,5})(?:[-_/].*)?$/i.exec(String(name));
  return m ? m[1].toUpperCase() : null;
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
    byTool: /** @type {Record<string, number>} */ ({}),
    byHour: /** @type {Record<string, number>} */ ({}),
  };
  for (const s of shards) {
    sum.prompts += s.turns?.prompts ?? 0;
    sum.stops += s.turns?.stops ?? 0;
    sum.unforced += s.turns?.unforced ?? 0;
    sum.nudges += s.turns?.nudges ?? 0;
    for (const [name, n] of Object.entries(s.counts?.tools ?? {}))
      if (typeof n === 'number') sum.byTool[name] = (sum.byTool[name] ?? 0) + n;
    for (const [hour, n] of Object.entries(s.counts?.byHour ?? {}))
      if (typeof n === 'number') sum.byHour[hour] = (sum.byHour[hour] ?? 0) + n;
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

/**
 * Tasks marked Deployed to prod (`scripts/dash-close.mjs SPO-N`, run by the cpd step after the branch is deleted).
 * @param {string} root @param {string} [stateDir] @returns {Set<string>}
 */
export function readClosed(root, stateDir) {
  try {
    const o = JSON.parse(
      readFileSync(join(stateDir ?? join(root, '.claude/state'), 'deployed-prod.json'), 'utf8'),
    );
    return new Set(
      Array.isArray(o.tasks)
        ? o.tasks.filter((/** @type {any} */ x) => typeof x === 'string' && TASK_RE.test(x))
        : [],
    );
  } catch {
    return new Set();
  }
}

/** A tab closes only when the task is Deployed to prod AND no ready-for-cpd branch is left (spec B7). */
/** @param {{ id: string, closed: Set<string>, hasReadyBranch: boolean }} o */
export function isClosed({ id, closed, hasReadyBranch }) {
  return closed.has(id) && !hasReadyBranch;
}

/** @param {string} s */
const kindOfDoc = (s) =>
  /spike/i.test(s)
    ? 'spike'
    : /risk/i.test(s)
      ? 'risk'
      : /plan/i.test(s)
        ? 'plan'
        : /design|canvas/i.test(s)
          ? 'design'
          : /closeout/i.test(s)
            ? 'closeout'
            : /spec|W\d+/i.test(s)
              ? 'spec'
              : 'doc';

/** Documents of a task under docs/specs and docs/plans (names only, no content). @param {string} root @param {string} id */
export function docsOf(root, id) {
  const out = [];
  for (const dir of ['docs/specs', 'docs/plans']) {
    let files;
    try {
      files = readdirSync(join(root, dir));
    } catch {
      continue;
    }
    for (const f of files.sort()) {
      if (!f.endsWith('.md') || !f.startsWith(`${id}-`)) continue;
      out.push({
        name: f.replace(/\.md$/, '').slice(0, 70),
        kind: kindOfDoc(f),
        dir: dir.slice(5),
      });
    }
  }
  return out;
}

/** Risk register counts from `| R<n> |` rows of the task's risk docs: impact H/M/L as marked in the table. @param {string} root @param {string} id */
export function risksOf(root, id) {
  const sum = { total: 0, high: 0, medium: 0, low: 0 };
  let files;
  try {
    files = readdirSync(join(root, 'docs/plans')).filter(
      (f) => f.startsWith(`${id}-`) && /risk/i.test(f),
    );
  } catch {
    return sum;
  }
  const seen = new Set();
  for (const f of files) {
    for (const line of readFileSync(join(root, 'docs/plans', f), 'utf8').split('\n')) {
      const m = /^\|\s*(R\d+)\s*\|(.*)$/.exec(line);
      if (!m || seen.has(m[1])) continue;
      seen.add(m[1]);
      sum.total += 1;
      const cells = m[2].split('|').map((c) => c.replace(/\*/g, '').trim());
      const impact = cells[2];
      if (impact === 'H') sum.high += 1;
      else if (impact === 'M') sum.medium += 1;
      else sum.low += 1;
    }
  }
  return sum;
}

/** Rule files in .claude/rules (names only). @param {string} root */
export function rulesOf(root) {
  try {
    return readdirSync(join(root, '.claude/rules'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
  } catch {
    return [];
  }
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
 * Latest CI runs of main via an injected `gh api` runner (optional: no gh or no network = empty list, never an error).
 * @param {(path: string) => string} gh
 */
export function ciRuns(gh) {
  try {
    const o = JSON.parse(gh('repos/mshumilindev/myfit/actions/runs?branch=main&per_page=8'));
    return (Array.isArray(o.workflow_runs) ? o.workflow_runs : [])
      .slice(0, 8)
      .map((/** @type {any} */ r) => {
        const ms = Date.parse(r.updated_at) - Date.parse(r.run_started_at);
        return {
          name: String(r.name ?? '').slice(0, 40),
          status: String(r.conclusion ?? r.status ?? 'unknown').slice(0, 20),
          sha: String(r.head_sha ?? '').slice(0, 7),
          sec: Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : null,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Jobs of the newest CI run on main (quality gates as CI sees them). Fail-soft like ciRuns.
 * @param {(path: string) => string} gh
 */
export function ciJobs(gh) {
  try {
    const runs =
      JSON.parse(gh('repos/mshumilindev/myfit/actions/runs?branch=main&per_page=8'))
        .workflow_runs ?? [];
    const run = runs.find((/** @type {any} */ r) => r.name === 'CI');
    if (!run) return [];
    const jobs =
      JSON.parse(gh(`repos/mshumilindev/myfit/actions/runs/${Number(run.id)}/jobs?per_page=30`))
        .jobs ?? [];
    return jobs.slice(0, 30).map((/** @type {any} */ j) => {
      const ms = Date.parse(j.completed_at) - Date.parse(j.started_at);
      return {
        name: String(j.name ?? '').slice(0, 40),
        status: String(j.conclusion ?? j.status ?? 'unknown').slice(0, 20),
        sec: Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * @param {{ root: string, stateDir?: string, git: (...args: string[]) => string, gh?: (path: string) => string, linear?: Record<string, { state: string, syncedSecAgo: number | null }>, now?: number }} o
 */
export function collect({ root, stateDir, git, gh, linear = {}, now = Date.now() }) {
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

  const closed = readClosed(root, stateDir);
  const hasReady = (/** @type {string} */ id) =>
    [...ready.keys()].some((n) => taskOfBranch(n) === id);
  const tasks = [...ids]
    .filter((id) => !isClosed({ id, closed, hasReadyBranch: hasReady(id) }))
    .sort()
    .map((id) => {
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
        items: items.map((/** @type {any} */ i) => ({
          id: String(i.id).slice(0, 20),
          status: i.status,
          kind: i.kind,
          text: String(i.text ?? '').slice(0, 70),
        })),
        linear: linear[id] ?? null,
        docs: docsOf(root, id),
        risks: risksOf(root, id),
        blocked: items
          .filter((/** @type {any} */ i) => i.status === 'blocked')
          .map((/** @type {any} */ i) => ({ id: i.id, needs: i.needs })),
        branch,
        capture: mergeShards(shardsOf(root, id)),
      };
    });
  return {
    v: SNAPSHOT_V,
    generatedAt: now,
    tasks,
    readyBranches: [...ready.keys()].sort(),
    ci: gh ? ciRuns(gh) : [],
    jobs: gh ? ciJobs(gh) : [],
    release: {
      unpushed: Number(safeGit('rev-list', '--count', 'origin/main..HEAD')) || 0,
      deployed: [...closed].sort(),
    },
    rules: rulesOf(root),
  };
}

const SECRET_LIKE =
  /(\bghp_|\bgithub_pat_|\bsk-[A-Za-z0-9]{8,}|\blin_api_|\bAIza|\bxox[abp]-|[A-Za-z0-9+/_]{32,})/;
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
