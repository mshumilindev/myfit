/** Two QA layers: mechanical (always) and vision-model semantic (optional). */
import fs from 'node:fs';
import type { CatalogExercise } from './catalog';
import type { PipelineConfig } from './config';
import type { QaRequest } from './provider';
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

/** System prompt shared by every QA provider (OpenAI vision, local Ollama). */
export const QA_SYSTEM = `You are a strict QA reviewer for an exercise-instruction image library.
You get: (1) the ORIGINAL reference photo of the exercise, (2) the NEW generated image,
optionally (3) the IDENTITY reference of the library's athlete, and the exercise metadata.
Judge the NEW image. Exercise correctness matters far more than beauty.
Check: same exercise; same equipment type, placement and setup (bench angle, seat, cable/pulley
height and attachment, machine geometry, Smith vs free bar); body orientation and stance;
grip orientation and width; which limbs work (unilateral stays unilateral); the requested
start/end state; anatomy (hands, fingers, joints); equipment plausibility (cables connected,
no floating plates, straight bars); style (dark restrained studio set, athlete shirtless (no tank top or shirt) in
plain dark shorts, white socks and shoes, no text/logos/other people); identity match with (3) if given;
obvious AI artifacts.
Respond ONLY with JSON:
{"passed":bool,"score":number 0-10,"exerciseCorrect":bool,"equipmentCorrect":bool,
"poseCorrect":bool,"anatomyCorrect":bool,"styleCorrect":bool,"identityConsistent":bool,
"issues":[string],"retryInstruction":string|null}
retryInstruction: one or two concrete, physical corrections for a regeneration (e.g.
"Keep the pulley at knee height as in the reference; only the right arm moves."), or null.`;

export function qaUserText(req: QaRequest): string {
  return (
    `Exercise metadata: ${req.exerciseSummary}\nRequested frame: ${req.state}.\n` +
    `Image 1 = ORIGINAL reference, image 2 = NEW generated` +
    `${req.identity ? ', image 3 = IDENTITY reference' : ''}.`
  );
}
