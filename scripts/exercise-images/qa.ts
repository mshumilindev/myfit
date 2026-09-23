/** Two QA layers: mechanical (always) and vision-model semantic (optional). */
import fs from 'node:fs';
import type { CatalogExercise } from './catalog';
import type { PipelineConfig } from './config';
import { readImageInfo } from './imageInfo';
import { QaResultSchema, type QaResult } from './manifest';

export const MIN_BYTES = 8 * 1024;

export function mechanicalCheck(
  file: string,
  expected: { w: number; h: number; format: string },
): string[] {
  const issues: string[] = [];
  if (!fs.existsSync(file)) return [`missing file ${file}`];
  const buf = fs.readFileSync(file);
  if (buf.length < MIN_BYTES) issues.push(`file too small (${buf.length} bytes)`);
  const info = readImageInfo(buf);
  if (!info) return [...issues, 'file does not decode as PNG/JPEG/WebP'];
  if (info.format !== expected.format)
    issues.push(`format ${info.format}, expected ${expected.format}`);
  if (info.width !== expected.w || info.height !== expected.h)
    issues.push(`size ${info.width}x${info.height}, expected ${expected.w}x${expected.h}`);
  return issues;
}

export function exerciseSummary(ex: CatalogExercise): string {
  return [
    ex.name,
    `equipment: ${ex.equipment ?? 'none'}`,
    `primary: ${ex.primary ?? '—'}`,
    ex.secondary.length ? `secondary: ${ex.secondary.join(', ')}` : '',
    `position: ${ex.bodyPosition}`,
    ex.unilateral ? 'unilateral' : 'bilateral',
    ex.instructions.slice(0, 2).join(' '),
  ]
    .filter(Boolean)
    .join(' | ');
}

/** Validate the vision model's JSON; throws with a readable message when malformed. */
export function parseQa(raw: unknown): QaResult {
  const r = QaResultSchema.safeParse(raw);
  if (!r.success)
    throw new Error(`QA JSON invalid: ${r.error.issues.map((i) => i.message).join('; ')}`);
  return r.data;
}

/**
 * Pass only if the model says so AND the score clears the bar AND none of the
 * correctness checks failed — the model's own `passed` is not trusted alone.
 * Identity drift fails too, but it is the last thing the checks look at.
 */
export function qaPasses(r: QaResult, c: Pick<PipelineConfig, 'qaMinScore'>): boolean {
  return (
    r.passed &&
    r.score >= c.qaMinScore &&
    r.exerciseCorrect &&
    r.equipmentCorrect &&
    r.poseCorrect &&
    r.anatomyCorrect &&
    r.styleCorrect &&
    r.identityConsistent !== false
  );
}
