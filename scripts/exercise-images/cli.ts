#!/usr/bin/env tsx
/**
 * npm run exercise-images -- [command] [flags]
 *
 * Commands (default: generate):
 *   generate      plan → cost summary → generate (+QA) exercise by exercise
 *   status        counts per status, anchor, next pending items
 *   review        rebuild the HTML review page; --import <decisions.json> applies marks
 *   validate      re-run mechanical checks (and --qa vision QA) on generated files
 *   approve       --exercise <id> [--state start|end] — manual approval
 *   reject        --exercise <id> [--state …] [--note "what is wrong"]
 *   set-anchor    --exercise <id> [--state start] — make that image THE athlete
 *   apply         dry-run plan; --write to apply; --revert latest|<file> to undo
 *   pilot         list the pilot exercises (generate with: generate --pilot)
 *
 * Selection flags: --all --pilot --exercise <id|slug>[,..] --muscle <m> --equipment <e>
 *   --category <c> --status <s> --from <n> --limit <n> --states start,end
 * Run flags: --dry-run --confirm-bulk --force --include-config-changes --no-qa --step
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadCatalog } from './catalog';
import { PATHS, REPO_ROOT, loadConfig, type ImageState } from './config';
import { isScoped, selectExercises, type Selection } from './filter';
import { costSummary, plan, run } from './generate';
import { fileHash, short } from './hash';
import {
  STATUSES,
  acquireLock,
  entryKey,
  loadManifest,
  saveManifest,
  summarize,
  type Status,
} from './manifest';
import { PILOT } from './pilot';
import { createProvider, createQaProvider } from './provider';
import { exerciseSummary, mechanicalCheck, parseQa, qaPasses } from './qa';
import { writeReview } from './review';
import { executeApply, planApply, readOverrides, revertApply } from './apply';

const envFile = path.join(REPO_ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { values: f, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    all: { type: 'boolean' },
    pilot: { type: 'boolean' },
    exercise: { type: 'string', multiple: true },
    muscle: { type: 'string', multiple: true },
    equipment: { type: 'string', multiple: true },
    category: { type: 'string', multiple: true },
    status: { type: 'string', multiple: true },
    from: { type: 'string' },
    limit: { type: 'string' },
    states: { type: 'string' },
    state: { type: 'string' },
    note: { type: 'string' },
    'dry-run': { type: 'boolean' },
    'confirm-bulk': { type: 'boolean' },
    force: { type: 'boolean' },
    'include-config-changes': { type: 'boolean' },
    'no-qa': { type: 'boolean' },
    qa: { type: 'boolean' },
    step: { type: 'boolean' },
    write: { type: 'boolean' },
    revert: { type: 'string' },
    import: { type: 'string' },
    'require-manual': { type: 'boolean' },
  },
});

const list = (v: string[] | undefined) =>
  (v ?? [])
    .flatMap((x) => x.split(','))
    .map((x) => x.trim())
    .filter(Boolean);

async function main(): Promise<void> {
  const cmd = positionals[0] ?? 'generate';
  const c = loadConfig();
  const states = (f.states ? list([f.states]) : c.states) as ImageState[];

  if (cmd === 'pilot') {
    for (const [i, p] of PILOT.entries())
      console.log(`${String(i + 1).padStart(2)}. ${p.id} — ${p.why}`);
    console.log('\nGenerate with: npm run exercise-images -- generate --pilot --dry-run');
    return;
  }
  if (cmd === 'status') return status();
  if (cmd === 'review') return review();
  if (cmd === 'apply') return apply();
  if (cmd === 'approve' || cmd === 'reject') return mark(cmd);
  if (cmd === 'set-anchor') return setAnchor();
  if (cmd === 'validate') return validate();
  if (cmd !== 'generate') throw new Error(`unknown command "${cmd}"`);

  // --- generate ---
  const statuses = list(f.status) as Status[];
  for (const s of statuses) if (!STATUSES.includes(s)) throw new Error(`unknown status "${s}"`);
  const sel: Selection = {
    all: f.all,
    pilot: f.pilot ? PILOT.map((p) => p.id) : null,
    exercises: list(f.exercise),
    muscles: list(f.muscle),
    equipment: list(f.equipment),
    categories: list(f.category),
    statuses,
    from: f.from ? Number(f.from) : undefined,
    limit: f.limit ? Number(f.limit) : undefined,
    states,
  };
  if (!isScoped(sel)) {
    throw new Error('say what to generate: --pilot, --exercise, --muscle, --limit … or --all');
  }
  const catalog = loadCatalog();
  const m = loadManifest(PATHS.manifest);
  const exercises = selectExercises(catalog, sel, m);
  const opts = {
    force: f.force,
    includeConfigChanges: f['include-config-changes'],
    retryRejected: statuses.includes('rejected'),
  };
  const planned = plan(exercises, states, m, c, opts);
  const qa = c.qaEnabled && !f['no-qa'];
  const provider = await createProvider(c);
  console.log(costSummary(planned, c, qa, provider.usesReferences));
  if (!m.anchor) {
    console.log(
      '\n⚠ no identity anchor yet — the athlete may differ between exercises. Generate one exercise, ' +
        'pick the best frame, then: npm run exercise-images -- set-anchor --exercise <id>',
    );
  }
  const toRun = planned.filter((p) => p.decision.run);
  if (f['dry-run']) {
    console.log('\nDRY RUN — nothing sent. Plan:');
    for (const p of planned) {
      console.log(
        `  ${p.decision.run ? '▶' : '·'} ${p.exercise.id}:${p.state}  [${p.exercise.paletteKey}]  ` +
          `refs=${p.refs.map((r) => r.role).join('+')}  prompt#${short(p.fingerprint.promptHash)}  — ${p.decision.reason}`,
      );
    }
    const first = toRun[0];
    if (first)
      console.log(`\nFirst prompt (${first.exercise.id}:${first.state}):\n\n${first.basePrompt}`);
    return;
  }
  if (toRun.length === 0) {
    console.log('\nNothing to do — everything selected is up to date.');
    return;
  }
  if (toRun.length > c.bulkThreshold && !f['confirm-bulk']) {
    throw new Error(
      `${toRun.length} images > IMAGE_BULK_THRESHOLD (${c.bulkThreshold}). Re-run with --confirm-bulk after checking the summary.`,
    );
  }
  if (c.provider === 'openai' && !c.apiKey) throw new Error('OPENAI_API_KEY is not set');
  await provider.preflight?.();
  const release = acquireLock(PATHS.lock);
  try {
    await run(planned, m, c, provider, qa ? await createQaProvider(c) : null, {
      ...opts,
      dryRun: false,
      step: !!f.step,
      qa,
    });
  } finally {
    release();
  }
  console.log('\nDone.');
  printCounts(m);
  console.log(`Review: ${path.relative(REPO_ROOT, path.join(PATHS.review, 'index.html'))}`);
}

function printCounts(m: ReturnType<typeof loadManifest>): void {
  const s = summarize(m);
  console.log(
    STATUSES.filter((k) => s[k])
      .map((k) => `${k}: ${s[k]}`)
      .join(' · ') || 'manifest is empty',
  );
}

function status(): void {
  const m = loadManifest(PATHS.manifest);
  printCounts(m);
  console.log(m.anchor ? `anchor: ${m.anchor.path} (from ${m.anchor.from})` : 'anchor: none');
  const review = Object.values(m.entries).filter(
    (e) => (e.status === 'rejected' || e.status === 'generated') && !e.manualApproval,
  );
  if (review.length) {
    console.log(`\nwaiting for manual review (${review.length}):`);
    for (const e of review.slice(0, 20))
      console.log(`  ${e.key}  ${e.status}  ${e.qaIssues[0] ?? e.error ?? ''}`);
  }
}

function review(): void {
  const release = acquireLock(PATHS.lock);
  try {
    const m = loadManifest(PATHS.manifest);
    if (f.import) {
      const marks = JSON.parse(fs.readFileSync(f.import, 'utf8')) as Record<
        string,
        'approved' | { decision: 'rejected'; note?: string }
      >;
      let n = 0;
      for (const [key, v] of Object.entries(marks)) {
        const e = m.entries[key];
        if (!e) continue;
        if (v === 'approved') {
          e.manualApproval = 'approved';
          e.status = 'approved';
        } else {
          e.manualApproval = 'rejected';
          e.status = 'rejected';
          e.retryInstruction = v.note || e.retryInstruction;
        }
        e.updatedAt = new Date().toISOString();
        n++;
      }
      saveManifest(PATHS.manifest, m);
      console.log(`applied ${n} review decisions`);
    }
    console.log(path.relative(REPO_ROOT, writeReview(m)));
  } finally {
    release();
  }
}

function mark(kind: 'approve' | 'reject'): void {
  const ids = list(f.exercise);
  if (!ids.length) throw new Error('--exercise is required');
  const release = acquireLock(PATHS.lock);
  try {
    const m = loadManifest(PATHS.manifest);
    const sts = (f.state ? [f.state] : ['start', 'end', 'hero']) as ImageState[];
    let n = 0;
    for (const id of ids)
      for (const st of sts) {
        const e = m.entries[entryKey(id, st)];
        if (!e) continue;
        e.manualApproval = kind === 'approve' ? 'approved' : 'rejected';
        e.status = kind === 'approve' ? 'approved' : 'rejected';
        if (kind === 'reject' && f.note) e.retryInstruction = f.note;
        e.updatedAt = new Date().toISOString();
        n++;
      }
    saveManifest(PATHS.manifest, m);
    writeReview(m);
    console.log(`${kind === 'approve' ? 'approved' : 'rejected'} ${n} image(s)`);
  } finally {
    release();
  }
}

function setAnchor(): void {
  const [id] = list(f.exercise);
  if (!id) throw new Error('--exercise is required');
  const st = (f.state ?? 'start') as ImageState;
  const release = acquireLock(PATHS.lock);
  try {
    const m = loadManifest(PATHS.manifest);
    const e = m.entries[entryKey(id, st)];
    const src = e?.sourcePath ?? e?.outputPath;
    if (!src) throw new Error(`no generated image for ${id}:${st}`);
    fs.mkdirSync(PATHS.anchorDir, { recursive: true });
    const to = path.join(PATHS.anchorDir, `athlete${path.extname(src)}`);
    fs.copyFileSync(path.join(REPO_ROOT, src), to);
    m.anchor = {
      path: path.relative(REPO_ROOT, to),
      hash: fileHash(to)!,
      from: `${id}:${st}`,
      setAt: new Date().toISOString(),
    };
    saveManifest(PATHS.manifest, m);
    writeReview(m);
    console.log(
      `anchor set from ${id}:${st}. Earlier images were made without it — redo them with --include-config-changes if they drift.`,
    );
  } finally {
    release();
  }
}

async function validate(): Promise<void> {
  const c = loadConfig();
  const release = acquireLock(PATHS.lock);
  try {
    const m = loadManifest(PATHS.manifest);
    const catalog = new Map(loadCatalog().map((e) => [e.id, e]));
    const qaProvider = f.qa ? await createQaProvider(c) : null;
    let bad = 0;
    for (const e of Object.values(m.entries)) {
      if (!e.outputPath) continue;
      const issues = mechanicalCheck(path.join(REPO_ROOT, e.outputPath), {
        w: c.outputSize.w,
        h: c.outputSize.h,
        format: c.outputFormat,
      });
      if (issues.length) {
        bad++;
        e.status = 'failed';
        e.error = `mechanical: ${issues.join('; ')}`;
        console.log(`✗ ${e.key}: ${issues.join('; ')}`);
        continue;
      }
      const ex = catalog.get(e.exerciseId);
      if (qaProvider && ex && e.manualApproval === null) {
        const qa = parseQa(
          await qaProvider.review({
            reference: ex.references[e.state]!,
            generated: path.join(REPO_ROOT, e.sourcePath ?? e.outputPath),
            identity: m.anchor ? path.join(REPO_ROOT, m.anchor.path) : null,
            exerciseSummary: exerciseSummary(ex),
            state: e.state,
          }),
        );
        e.qa = qa;
        e.qaIssues = qa.issues;
        e.qaStatus = qaPasses(qa, c) ? 'passed' : 'failed';
        e.status = e.qaStatus === 'passed' ? 'approved' : 'rejected';
        console.log(`${e.qaStatus === 'passed' ? '✓' : '✗'} ${e.key} QA ${qa.score}`);
      }
    }
    saveManifest(PATHS.manifest, m);
    writeReview(m);
    console.log(
      bad ? `${bad} file(s) failed mechanical checks` : 'all files pass mechanical checks',
    );
  } finally {
    release();
  }
}

function apply(): void {
  if (f.revert) {
    const r = revertApply(f.revert);
    console.log(`restored overrides from ${r.restoredFrom} (${r.count} entries)`);
    return;
  }
  const c = loadConfig();
  const m = loadManifest(PATHS.manifest);
  const current = readOverrides();
  const ids = list(f.exercise);
  const p = planApply(m, current, {
    states: c.states,
    requireManual: !!f['require-manual'],
    only: ids.length ? new Set(ids) : undefined,
  });
  console.log(
    `would apply: ${p.add.length} · unchanged: ${p.unchanged.length} · blocked: ${p.blocked.length}`,
  );
  for (const a of p.add.slice(0, 50)) console.log(`  + ${a.id} → ${a.urls.join(', ')}`);
  for (const b of p.blocked.slice(0, 50)) console.log(`  · ${b.id}: ${b.reason}`);
  if (!f.write) {
    console.log('\nDry run. Re-run with --write to copy files and update the overrides map.');
    return;
  }
  if (!p.add.length) return;
  const backup = executeApply(p, current);
  console.log(
    `\napplied ${p.add.length}. Undo with: npm run exercise-images -- apply --revert latest`,
  );
  console.log(`backup: ${path.relative(REPO_ROOT, backup)}`);
}

main().catch((e: unknown) => {
  console.error(`\n✖ ${(e as Error).message}`);
  process.exitCode = 1;
});
