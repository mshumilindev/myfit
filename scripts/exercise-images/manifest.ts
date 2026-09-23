/**
 * The durable, resumable record of every exercise/state the pipeline touched.
 * Written atomically (tmp + rename) after every state change, so killing the
 * process at item 437 loses at most the in-flight requests; rerunning picks up
 * where it stopped. A lock file stops two runs from writing it concurrently.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { ImageState } from './config';

export const STATUSES = [
  'pending',
  'generating',
  'generated',
  'validating',
  'approved',
  'rejected',
  'retry',
  'failed',
  'skipped',
] as const;
export type Status = (typeof STATUSES)[number];

export const QaResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(10),
  exerciseCorrect: z.boolean(),
  equipmentCorrect: z.boolean(),
  poseCorrect: z.boolean(),
  anatomyCorrect: z.boolean(),
  styleCorrect: z.boolean(),
  identityConsistent: z.boolean().optional(),
  issues: z.array(z.string()),
  retryInstruction: z.string().nullable().optional(),
});
export type QaResult = z.infer<typeof QaResultSchema>;

export interface Entry {
  key: string;
  exerciseId: string;
  slug: string;
  name: string;
  state: ImageState;
  primaryMuscle: string | null;
  equipment: string | null;
  paletteKey: string;
  referenceUrls: string[];
  referenceHash: string | null;
  exerciseHash: string;
  anchorHash: string | null;
  configKey: string;
  model: string;
  promptVersion: string;
  promptHash: string;
  prompt: string;
  /** Relative to the repo root. */
  outputPath: string | null;
  sourcePath: string | null;
  status: Status;
  attempts: number;
  qaAttempts: number;
  qaStatus: 'not-run' | 'passed' | 'failed' | 'error';
  qa: QaResult | null;
  qaIssues: string[];
  retryInstruction: string | null;
  error: string | null;
  /** Human decision from the review page / CLI (null = not reviewed). */
  manualApproval: 'approved' | 'rejected' | null;
  generatedAt: string | null;
  updatedAt: string;
}

export interface Manifest {
  version: 1;
  updatedAt: string;
  anchor: { path: string; hash: string; from: string; setAt: string } | null;
  entries: Record<string, Entry>;
}

export const entryKey = (id: string, state: ImageState) => `${id}:${state}`;

export function emptyManifest(): Manifest {
  return { version: 1, updatedAt: new Date().toISOString(), anchor: null, entries: {} };
}

export function loadManifest(file: string): Manifest {
  if (!fs.existsSync(file)) return emptyManifest();
  const m = JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest;
  if (m.version !== 1) throw new Error(`manifest: unsupported version ${String(m.version)}`);
  return m;
}

export function saveManifest(file: string, m: Manifest): void {
  m.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(m, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

/** Take the manifest lock; stale locks (dead pid) are reclaimed. */
export function acquireLock(lockFile: string): () => void {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  if (fs.existsSync(lockFile)) {
    const pid = Number(fs.readFileSync(lockFile, 'utf8'));
    let alive = false;
    try {
      if (pid) {
        process.kill(pid, 0);
        alive = true;
      }
    } catch {
      alive = false;
    }
    if (alive) throw new Error(`another run holds ${lockFile} (pid ${pid})`);
    fs.rmSync(lockFile, { force: true });
  }
  fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
  return () => fs.rmSync(lockFile, { force: true });
}

// --- idempotency ---------------------------------------------------------------

export interface Fingerprint {
  promptVersion: string;
  promptHash: string;
  referenceHash: string | null;
  exerciseHash: string;
  configKey: string;
  anchorHash: string | null;
}

export interface WorkOptions {
  force?: boolean;
  /** Also redo items whose only change is generation config / identity anchor. */
  includeConfigChanges?: boolean;
  /** Redo items QA sent to manual review (explicit: `--status rejected`). */
  retryRejected?: boolean;
}

export type Decision = { run: true; reason: string } | { run: false; reason: string };

/**
 * Should this item be (re)generated? Pure — the heart of resume/idempotency.
 * Done work is never redone unless forced, or the prompt/reference/exercise
 * data changed; a config/anchor-only change needs an explicit opt-in.
 */
export function decide(
  entry: Entry | undefined,
  fp: Fingerprint,
  opts: WorkOptions = {},
): Decision {
  if (!entry) return { run: true, reason: 'new' };
  if (opts.force) return { run: true, reason: 'forced' };
  if (entry.status === 'skipped') return { run: false, reason: 'skipped' };
  if (entry.status === 'rejected') {
    // Human-rejected always comes back; QA-rejected waits for a person or an explicit retry.
    return entry.manualApproval === 'rejected' || opts.retryRejected
      ? { run: true, reason: 'rejected' }
      : { run: false, reason: 'awaiting manual review' };
  }
  if (entry.manualApproval === 'approved') {
    if (entry.promptVersion !== fp.promptVersion || entry.referenceHash !== fp.referenceHash)
      return { run: true, reason: 'approved, but prompt version / reference changed' };
    return { run: false, reason: 'manually approved' };
  }
  if (['pending', 'retry', 'failed', 'generating'].includes(entry.status))
    return { run: true, reason: entry.status === 'generating' ? 'interrupted' : entry.status };
  if (entry.promptVersion !== fp.promptVersion)
    return { run: true, reason: 'prompt version changed' };
  if (entry.referenceHash !== fp.referenceHash) return { run: true, reason: 'reference changed' };
  if (entry.exerciseHash !== fp.exerciseHash) return { run: true, reason: 'exercise data changed' };
  // Setting an anchor adds an identity reference, which changes the prompt text too —
  // that counts as an anchor change (opt-in), not a prompt change (automatic).
  if (entry.promptHash !== fp.promptHash && entry.anchorHash === fp.anchorHash)
    return { run: true, reason: 'prompt changed' };
  if (entry.configKey !== fp.configKey || entry.anchorHash !== fp.anchorHash) {
    return opts.includeConfigChanges
      ? { run: true, reason: 'config/anchor changed' }
      : { run: false, reason: 'config/anchor changed — pass --include-config-changes to redo' };
  }
  return { run: false, reason: `already ${entry.status}` };
}

export function summarize(m: Manifest): Record<Status, number> {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const e of Object.values(m.entries)) out[e.status] += 1;
  return out;
}
