/**
 * The runner. Works EXERCISE BY EXERCISE (start, then end conditioned on the
 * freshly generated start + the identity anchor), saving the manifest and
 * refreshing the review page after each one — so you can watch the library
 * grow and stop the moment the athlete drifts. Concurrency > 1 runs several
 * exercises side by side; a pair is never split across lanes.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import type { CatalogExercise } from './catalog';
import {
  PATHS,
  REPO_ROOT,
  generationConfigKey,
  type ImageState,
  type PipelineConfig,
} from './config';
import { fileHash, sha256, stableStringify } from './hash';
import {
  decide,
  entryKey,
  saveManifest,
  type Entry,
  type Fingerprint,
  type Manifest,
  type WorkOptions,
} from './manifest';
import { loadThemeTokens, resolvePalette } from './palette';
import { extFor, normalize } from './postprocess';
import { buildPrompt, type RefRole } from './prompt';
import type { ExerciseImageProvider, QaProvider, ReferenceImage } from './provider';
import { exerciseSummary, mechanicalCheck, parseQa, qaPasses } from './qa';
import { runPool, withRetry } from './pool';
import { writeReview } from './review';

export interface RunOptions extends WorkOptions {
  dryRun: boolean;
  step: boolean;
  qa: boolean;
}

const rel = (p: string) => path.relative(REPO_ROOT, p);
const now = () => new Date().toISOString();

/** Exercise data that affects the image — any change here invalidates it. */
export function exerciseHash(ex: CatalogExercise): string {
  return sha256(
    stableStringify({
      name: ex.name,
      equipment: ex.equipment,
      primary: ex.primary,
      secondary: ex.secondary,
      bodyPosition: ex.bodyPosition,
      unilateral: ex.unilateral,
      instructions: ex.instructions.slice(0, 4),
      paletteKey: ex.paletteKey,
    }),
  );
}

/** Which images go to the provider for a frame, in order. */
export function referencePlan(
  ex: CatalogExercise,
  state: ImageState,
  anchorPath: string | null,
  startFrame: string | null,
): ReferenceImage[] {
  const refs: ReferenceImage[] = [{ role: 'exercise', path: ex.references[state]! }];
  if (anchorPath) refs.push({ role: 'identity', path: anchorPath });
  if (state === 'end' && startFrame) refs.push({ role: 'start-frame', path: startFrame });
  return refs;
}

export interface PlannedItem {
  exercise: CatalogExercise;
  state: ImageState;
  fingerprint: Fingerprint;
  basePrompt: string;
  refs: ReferenceImage[];
  decision: ReturnType<typeof decide>;
}

/**
 * Plan without side effects (dry-run + cost summary use this). The end frame
 * is planned with its start-frame reference, and is redone whenever its start
 * is redone — a pair must come from the same shoot.
 */
export function plan(
  exercises: CatalogExercise[],
  states: ImageState[],
  m: Manifest,
  c: PipelineConfig,
  opts: WorkOptions,
): PlannedItem[] {
  const tokens = loadThemeTokens();
  const anchorPath = m.anchor ? path.join(REPO_ROOT, m.anchor.path) : null;
  const anchorHash = m.anchor?.hash ?? null;
  const configKey = generationConfigKey(c);
  const out: PlannedItem[] = [];
  for (const ex of exercises) {
    const palette = resolvePalette(ex.paletteKey, tokens);
    let startRuns = false;
    for (const state of states) {
      if (!ex.references[state]) continue;
      const startEntry = m.entries[entryKey(ex.id, 'start')];
      const startFile = startEntry?.sourcePath ?? startEntry?.outputPath;
      const startFrame = state === 'end' && startFile ? path.join(REPO_ROOT, startFile) : null;
      const willHaveStart = state === 'end' && (startRuns || !!startFrame);
      const refs = referencePlan(ex, state, anchorPath, startFrame);
      const roles: RefRole[] = refs.map((r) => r.role);
      if (willHaveStart && !roles.includes('start-frame')) roles.push('start-frame');
      const basePrompt = buildPrompt({ exercise: ex, state, palette, refs: roles }).text;
      const fingerprint: Fingerprint = {
        promptVersion: buildPrompt({ exercise: ex, state, palette, refs: roles }).version,
        promptHash: sha256(basePrompt),
        referenceHash: fileHash(ex.references[state]),
        exerciseHash: exerciseHash(ex),
        configKey,
        anchorHash,
      };
      let decision = decide(m.entries[entryKey(ex.id, state)], fingerprint, opts);
      if (state === 'end' && startRuns && !decision.run)
        decision = { run: true, reason: 'start frame redone' };
      if (state === 'start') startRuns = decision.run;
      out.push({ exercise: ex, state, fingerprint, basePrompt, refs, decision });
    }
  }
  return out;
}

export function costSummary(
  items: PlannedItem[],
  c: PipelineConfig,
  qa: boolean,
  usesRefs: boolean,
): string {
  const run = items.filter((i) => i.decision.run);
  const exercises = new Set(run.map((i) => i.exercise.id)).size;
  const worst = run.length * (1 + c.maxQaAttempts);
  return [
    `exercises to process : ${exercises}`,
    `images to generate   : ${run.length}  (skipped: ${items.length - run.length})`,
    `model                : ${c.provider}/${c.model}  quality=${c.quality}`,
    `requested size       : ${c.size.w}x${c.size.h} → output ${c.outputSize.w}x${c.outputSize.h} ${c.outputFormat}`,
    `reference editing    : ${usesRefs ? 'yes (reference + identity anchor + start frame)' : 'no'}`,
    `API requests         : ${run.length} generations minimum, up to ${worst} with QA regenerations`,
    `QA vision calls      : ${qa ? `${run.length} to ${worst}` : 'disabled'}`,
    `transport retries    : up to ${c.retries} per request on 429/5xx/timeouts (not counted above)`,
    `concurrency          : ${c.concurrency} exercise(s) at a time`,
  ].join('\n');
}

function baseEntry(p: PlannedItem, c: PipelineConfig, prev: Entry | undefined): Entry {
  const ex = p.exercise;
  return {
    key: entryKey(ex.id, p.state),
    exerciseId: ex.id,
    slug: ex.slug,
    name: ex.name,
    state: p.state,
    primaryMuscle: ex.primary,
    equipment: ex.equipment,
    paletteKey: ex.paletteKey,
    referenceUrls: ex.referenceUrls,
    referenceHash: p.fingerprint.referenceHash,
    exerciseHash: p.fingerprint.exerciseHash,
    anchorHash: p.fingerprint.anchorHash,
    configKey: p.fingerprint.configKey,
    model: `${c.provider}/${c.model}`,
    promptVersion: p.fingerprint.promptVersion,
    promptHash: p.fingerprint.promptHash,
    prompt: p.basePrompt,
    outputPath: prev?.outputPath ?? null,
    sourcePath: prev?.sourcePath ?? null,
    status: 'pending',
    attempts: prev?.attempts ?? 0,
    qaAttempts: 0,
    qaStatus: 'not-run',
    qa: null,
    qaIssues: [],
    retryInstruction: null,
    error: null,
    manualApproval: null,
    generatedAt: prev?.generatedAt ?? null,
    updatedAt: now(),
  };
}

export async function run(
  items: PlannedItem[],
  m: Manifest,
  c: PipelineConfig,
  provider: ExerciseImageProvider,
  qaProvider: QaProvider | null,
  opts: RunOptions,
): Promise<void> {
  const save = () => saveManifest(PATHS.manifest, m);
  const byExercise = new Map<string, PlannedItem[]>();
  for (const it of items) {
    if (!it.decision.run) continue;
    const list = byExercise.get(it.exercise.id) ?? [];
    list.push(it);
    byExercise.set(it.exercise.id, list);
  }
  const groups = [...byExercise.values()];
  let stop = false;
  const onSig = () => {
    // First Ctrl-C finishes in-flight exercises and saves; the manifest stays consistent.
    if (!stop) console.log('\n⏸  stopping after the current exercise(s)…');
    stop = true;
  };
  process.on('SIGINT', onSig);
  const rl = opts.step
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;
  let done = 0;

  try {
    await runPool(
      groups,
      opts.step ? 1 : c.concurrency,
      async (group) => {
        for (const p of group) await processItem(p);
        done += 1;
        writeReview(m);
        const ex = group[0].exercise;
        const line = group
          .map((p) => {
            const e = m.entries[entryKey(ex.id, p.state)];
            return `${p.state}:${e.status}${e.qa ? `(${e.qa.score})` : ''}`;
          })
          .join('  ');
        console.log(`[${done}/${groups.length}] ${ex.id}  ${line}`);
        if (rl) {
          const a = (
            await rl.question(
              '  ↵ next · q quit · review: assets/exercise-images/review/index.html  ',
            )
          ).trim();
          if (a === 'q') stop = true;
        }
      },
      () => stop,
    );
  } finally {
    rl?.close();
    process.off('SIGINT', onSig);
    save();
    writeReview(m);
  }

  async function processItem(p: PlannedItem): Promise<void> {
    const key = entryKey(p.exercise.id, p.state);
    const prev = m.entries[key];
    const e = baseEntry(p, c, prev);
    m.entries[key] = e;
    // End frames use the start frame produced a moment ago in this same run.
    const refs = [...p.refs];
    if (p.state === 'end' && !refs.some((r) => r.role === 'start-frame')) {
      const s = m.entries[entryKey(p.exercise.id, 'start')];
      // Lossless source when kept, otherwise the delivered WebP.
      const frame = s?.sourcePath ?? s?.outputPath;
      if (frame) refs.push({ role: 'start-frame', path: path.join(REPO_ROOT, frame) });
    }
    const tokens = loadThemeTokens();
    const palette = resolvePalette(p.exercise.paletteKey, tokens);
    // A human "Reject" note is the first correction; QA adds its own after that.
    let retryInstruction: string | null =
      prev?.manualApproval === 'rejected' ? (prev.retryInstruction ?? null) : null;

    for (let qaRound = 0; ; qaRound++) {
      const prompt = buildPrompt({
        exercise: p.exercise,
        state: p.state,
        palette,
        refs: refs.map((r) => r.role),
        retryInstruction,
      }).text;
      e.prompt = prompt;
      e.status = 'generating';
      e.updatedAt = now();
      save();
      try {
        const result = await withRetry(
          () => {
            e.attempts += 1;
            return provider.generate({ prompt, references: refs, size: c.size });
          },
          {
            retries: c.retries,
            onRetry: (n, ms, err) =>
              console.log(
                `  ↻ ${key} retry ${n} in ${Math.round(ms / 1000)}s: ${(err as Error).message}`,
              ),
          },
        );
        const dir = path.join(PATHS.generated, p.exercise.id);
        fs.mkdirSync(dir, { recursive: true });
        if (c.keepSource) {
          const srcDir = path.join(PATHS.source, p.exercise.id);
          fs.mkdirSync(srcDir, { recursive: true });
          const srcExt =
            result.mime === 'image/jpeg' ? 'jpg' : result.mime === 'image/webp' ? 'webp' : 'png';
          const src = path.join(srcDir, `${p.state}.${srcExt}`);
          fs.writeFileSync(src, result.image);
          e.sourcePath = rel(src);
        }
        const out = path.join(dir, `${p.state}.${extFor(c.outputFormat)}`);
        fs.writeFileSync(out, await normalize(result.image, c));
        e.outputPath = rel(out);
        e.generatedAt = now();
        e.error = null;
      } catch (err) {
        e.status = 'failed';
        e.error = (err as Error).message;
        e.updatedAt = now();
        save();
        return;
      }

      const mech = mechanicalCheck(path.join(REPO_ROOT, e.outputPath!), {
        w: c.outputSize.w,
        h: c.outputSize.h,
        format: c.outputFormat === 'jpeg' ? 'jpeg' : c.outputFormat,
      });
      if (mech.length) {
        e.status = 'failed';
        e.error = `mechanical: ${mech.join('; ')}`;
        save();
        return;
      }
      e.status = 'generated';
      save();
      if (!opts.qa || !qaProvider) return;

      e.status = 'validating';
      e.qaAttempts = qaRound + 1;
      save();
      try {
        const raw = await withRetry(
          () =>
            qaProvider.review({
              reference: p.exercise.references[p.state]!,
              generated: path.join(REPO_ROOT, e.sourcePath ?? e.outputPath!),
              identity: m.anchor ? path.join(REPO_ROOT, m.anchor.path) : null,
              exerciseSummary: exerciseSummary(p.exercise),
              state: p.state,
            }),
          { retries: c.retries },
        );
        const qa = parseQa(raw);
        e.qa = qa;
        e.qaIssues = qa.issues;
        e.retryInstruction = qa.retryInstruction ?? null;
        if (qaPasses(qa, c)) {
          e.qaStatus = 'passed';
          e.status = 'approved';
          save();
          return;
        }
        e.qaStatus = 'failed';
      } catch (err) {
        // QA infrastructure failure never silently approves: leave it for review.
        e.qaStatus = 'error';
        e.error = `QA: ${(err as Error).message}`;
        e.status = 'generated';
        save();
        return;
      }
      if (qaRound >= c.maxQaAttempts) {
        e.status = 'rejected'; // → manual review queue
        save();
        return;
      }
      e.status = 'retry';
      save();
      retryInstruction = e.retryInstruction ?? e.qaIssues.join(' ');
    }
  }
}
