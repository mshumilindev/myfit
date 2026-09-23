/**
 * Runtime configuration for the exercise-image pipeline. Everything tunable
 * comes from the environment (see docs/exercise-image-generation.md and
 * .env.example); nothing here is a secret. Validated once with zod so a typo in
 * .env fails loudly instead of silently producing the wrong images.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../..');

/** Where every artefact of the pipeline lives — never inside client/public. */
export const OUT_ROOT = path.join(REPO_ROOT, 'assets/exercise-images');
export const PATHS = {
  root: OUT_ROOT,
  manifest: path.join(OUT_ROOT, 'manifest.json'),
  lock: path.join(OUT_ROOT, '.manifest.lock'),
  /** App-ready WebP per exercise/state (committed after review). */
  generated: path.join(OUT_ROOT, 'generated'),
  /** Raw provider output (large; gitignored). */
  source: path.join(OUT_ROOT, 'source'),
  review: path.join(OUT_ROOT, 'review'),
  /** The canonical athlete image every request is conditioned on. */
  anchorDir: path.join(OUT_ROOT, 'anchor'),
  applyHistory: path.join(OUT_ROOT, 'apply-history'),
  /** Immutable originals (free-exercise-db photos) — read-only for us. */
  referenceImages: path.join(REPO_ROOT, 'client/public/exercise-img'),
  catalog: path.join(REPO_ROOT, 'client/src/data/exercises.rich.json'),
  instructions: path.join(REPO_ROOT, 'client/src/data/exercises.instructions.json'),
  localizedNames: path.join(REPO_ROOT, 'client/src/data/exerciseNames.generated.json'),
  themeCss: path.join(REPO_ROOT, 'client/src/styles.css'),
  /** Apply target: approved images are copied here and mapped in the overrides JSON. */
  publicOut: path.join(REPO_ROOT, 'client/public/exercise-img-v2'),
  overrides: path.join(REPO_ROOT, 'client/src/data/exerciseImageOverrides.json'),
} as const;

const Env = z.object({
  /** openai = paid API · mock = offline plumbing test. */
  IMAGE_PROVIDER: z.enum(['openai', 'mock']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  IMAGE_MODEL: z.string().default('gpt-image-1'),
  /** Provider quality knob (openai: low | medium | high | auto). */
  IMAGE_QUALITY: z.string().default('high'),
  /** Size requested from the provider; post-processing derives the app size. */
  IMAGE_SIZE: z
    .string()
    .regex(/^\d+x\d+$/)
    .default('1536x1024'),
  /** Final app image (matches the 3:2 originals the UI already crops). */
  IMAGE_OUTPUT_SIZE: z
    .string()
    .regex(/^\d+x\d+$/)
    .default('960x640'),
  IMAGE_OUTPUT_FORMAT: z.enum(['webp', 'jpeg', 'png']).default('webp'),
  IMAGE_OUTPUT_QUALITY: z.coerce.number().int().min(40).max(100).default(80),
  /** Default 1: one exercise at a time, so identity drift is caught early. */
  IMAGE_GENERATION_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  IMAGE_GENERATION_RETRIES: z.coerce.number().int().min(0).max(6).default(3),
  IMAGE_GENERATION_TIMEOUT_MS: z.coerce.number().int().min(10000).default(180000),
  /** Automatic QA-driven regenerations before an item goes to manual review. */
  IMAGE_MAX_QA_ATTEMPTS: z.coerce.number().int().min(0).max(5).default(2),
  IMAGE_QA_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  IMAGE_QA_MODEL: z.string().default('gpt-4.1'),
  IMAGE_QA_MIN_SCORE: z.coerce.number().min(0).max(10).default(8),
  /** Bulk guard: jobs with more images than this need --confirm-bulk. */
  IMAGE_BULK_THRESHOLD: z.coerce.number().int().min(1).default(24),
  /** Which frames the product needs: the app shows start + end side by side. */
  IMAGE_STATES: z.string().default('start,end'),
  /** Keep the raw provider PNG next to the WebP (gitignored). */
  IMAGE_KEEP_SOURCE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type ImageState = 'start' | 'end' | 'hero';

export interface PipelineConfig {
  provider: 'openai' | 'mock';
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  quality: string;
  size: { w: number; h: number };
  outputSize: { w: number; h: number };
  outputFormat: 'webp' | 'jpeg' | 'png';
  outputQuality: number;
  concurrency: number;
  retries: number;
  timeoutMs: number;
  maxQaAttempts: number;
  qaEnabled: boolean;
  qaModel: string;
  qaMinScore: number;
  bulkThreshold: number;
  states: ImageState[];
  keepSource: boolean;
}

function parseSize(s: string): { w: number; h: number } {
  const [w, h] = s.split('x').map(Number);
  return { w, h };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PipelineConfig {
  const e = Env.parse(env);
  const states = e.IMAGE_STATES.split(',')
    .map((s) => s.trim())
    .filter(Boolean) as ImageState[];
  for (const s of states) {
    if (!['start', 'end', 'hero'].includes(s))
      throw new Error(`IMAGE_STATES: unknown state "${s}"`);
  }
  return {
    provider: e.IMAGE_PROVIDER,
    apiKey: e.OPENAI_API_KEY,
    baseUrl: e.OPENAI_BASE_URL,
    model: e.IMAGE_MODEL,
    quality: e.IMAGE_QUALITY,
    size: parseSize(e.IMAGE_SIZE),
    outputSize: parseSize(e.IMAGE_OUTPUT_SIZE),
    outputFormat: e.IMAGE_OUTPUT_FORMAT,
    outputQuality: e.IMAGE_OUTPUT_QUALITY,
    concurrency: e.IMAGE_GENERATION_CONCURRENCY,
    retries: e.IMAGE_GENERATION_RETRIES,
    timeoutMs: e.IMAGE_GENERATION_TIMEOUT_MS,
    maxQaAttempts: e.IMAGE_MAX_QA_ATTEMPTS,
    qaEnabled: e.IMAGE_QA_ENABLED,
    qaModel: e.IMAGE_QA_MODEL,
    qaMinScore: e.IMAGE_QA_MIN_SCORE,
    bulkThreshold: e.IMAGE_BULK_THRESHOLD,
    states,
    keepSource: e.IMAGE_KEEP_SOURCE,
  };
}

/** The generation-relevant slice of config — changing it invalidates fingerprints. */
export function generationConfigKey(c: PipelineConfig): string {
  return JSON.stringify({
    provider: c.provider,
    model: c.model,
    quality: c.quality,
    size: c.size,
    outputSize: c.outputSize,
    outputFormat: c.outputFormat,
  });
}
