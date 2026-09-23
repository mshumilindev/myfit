/**
 * Apply reviewed images to the app — the ONLY step that touches app data, and
 * it never overwrites an original:
 *   • approved WebPs are copied to client/public/exercise-img-v2/<id>/<n>.webp
 *   • client/src/data/exerciseImageOverrides.json maps id → new image URLs
 *     (exercises.ts prefers an override, falls back to the original photos)
 * Dry-run by default; every write keeps a backup of the previous overrides in
 * assets/exercise-images/apply-history/ so `apply --revert latest` undoes it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, REPO_ROOT, type ImageState } from './config';
import type { Manifest } from './manifest';

export type Overrides = Record<string, string[]>;

export interface ApplyPlan {
  add: { id: string; urls: string[]; files: { from: string; to: string }[] }[];
  unchanged: string[];
  blocked: { id: string; reason: string }[];
}

const INDEX: Record<ImageState, number> = { start: 0, end: 1, hero: 0 };

/** Pure planning: which exercises are complete + approved, and what changes. */
export function planApply(
  m: Manifest,
  current: Overrides,
  opts: { states: ImageState[]; requireManual: boolean; only?: Set<string> },
): ApplyPlan {
  const ids = [...new Set(Object.values(m.entries).map((e) => e.exerciseId))].sort();
  const out: ApplyPlan = { add: [], unchanged: [], blocked: [] };
  for (const id of ids) {
    if (opts.only && !opts.only.has(id)) continue;
    const files: { from: string; to: string }[] = [];
    const urls: string[] = [];
    let blocked: string | null = null;
    for (const st of opts.states) {
      const e = m.entries[`${id}:${st}`];
      if (!e) {
        // Exercises without an end reference have only a start frame.
        if (st === 'end') continue;
        blocked = `no ${st} frame`;
        break;
      }
      const ok =
        e.manualApproval === 'approved' ||
        (e.status === 'approved' && e.manualApproval !== 'rejected' && !opts.requireManual);
      if (!ok || !e.outputPath) {
        blocked = `${st} is ${e.status}${e.manualApproval ? ` (manual: ${e.manualApproval})` : ''}`;
        break;
      }
      const ext = path.extname(e.outputPath);
      const name = `${INDEX[st]}${ext}`;
      urls[INDEX[st]] = `/exercise-img-v2/${id}/${name}`;
      files.push({
        from: e.outputPath,
        to: path.relative(REPO_ROOT, path.join(PATHS.publicOut, id, name)),
      });
    }
    if (blocked) {
      out.blocked.push({ id, reason: blocked });
      continue;
    }
    const clean = urls.filter(Boolean);
    if (JSON.stringify(current[id] ?? null) === JSON.stringify(clean)) out.unchanged.push(id);
    else out.add.push({ id, urls: clean, files });
  }
  return out;
}

export function readOverrides(): Overrides {
  return fs.existsSync(PATHS.overrides)
    ? (JSON.parse(fs.readFileSync(PATHS.overrides, 'utf8')) as Overrides)
    : {};
}

function writeJsonAtomic(file: string, v: unknown): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(v, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function executeApply(plan: ApplyPlan, current: Overrides): string {
  fs.mkdirSync(PATHS.applyHistory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(PATHS.applyHistory, `${stamp}.json`);
  writeJsonAtomic(backup, { previousOverrides: current, applied: plan.add.map((a) => a.id) });
  // Copy first; only when every file is in place is the mapping switched.
  for (const a of plan.add) {
    for (const f of a.files) {
      const to = path.join(REPO_ROOT, f.to);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(REPO_ROOT, f.from), to);
    }
  }
  const next: Overrides = { ...current };
  for (const a of plan.add) next[a.id] = a.urls;
  const sorted = Object.fromEntries(
    Object.keys(next)
      .sort()
      .map((k) => [k, next[k]]),
  );
  writeJsonAtomic(PATHS.overrides, sorted);
  return backup;
}

export function revertApply(which: string): { restoredFrom: string; count: number } {
  const dir = PATHS.applyHistory;
  const file =
    which === 'latest'
      ? fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) => path.join(dir, f))
          .pop()
      : path.resolve(which);
  if (!file || !fs.existsSync(file)) throw new Error('nothing to revert');
  const { previousOverrides } = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    previousOverrides: Overrides;
  };
  writeJsonAtomic(PATHS.overrides, previousOverrides);
  fs.renameSync(file, `${file}.reverted`);
  return {
    restoredFrom: path.relative(REPO_ROOT, file),
    count: Object.keys(previousOverrides).length,
  };
}
