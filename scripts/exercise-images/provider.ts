/**
 * Image-generation provider abstraction. Everything model-specific lives in
 * providers/<name>.ts; the pipeline only knows this interface, so switching
 * models/vendors is a new file + IMAGE_PROVIDER, not a refactor.
 */
import type { PipelineConfig } from './config';
import type { RefRole } from './prompt';

export interface ReferenceImage {
  role: RefRole;
  /** Absolute path on disk. */
  path: string;
}

export interface GenerateRequest {
  prompt: string;
  references: ReferenceImage[];
  size: { w: number; h: number };
  /** Deterministic per item + attempt, so a rerun of the same attempt is reproducible. */
  seed?: number;
}

export interface GenerateResult {
  /** Raw image bytes (PNG/WebP/JPEG) as returned by the provider. */
  image: Buffer;
  mime: string;
  /** Provider's own id for tracing, when it gives one. */
  providerRef?: string;
}

export interface ExerciseImageProvider {
  readonly name: string;
  /** True when the provider conditions on reference images (edit mode). */
  readonly usesReferences: boolean;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  /** Fail fast before a run (server reachable, model files present). */
  preflight?(): Promise<void>;
  /** Free memory (e.g. unload local models before a local QA model runs). */
  release?(): Promise<void>;
}

export interface QaRequest {
  reference: string;
  generated: string;
  identity?: string | null;
  exerciseSummary: string;
  state: string;
}

export interface QaProvider {
  readonly name: string;
  review(req: QaRequest): Promise<unknown>;
}

export async function createProvider(c: PipelineConfig): Promise<ExerciseImageProvider> {
  if (c.provider === 'mock') return new (await import('./providers/mock')).MockProvider();
  if (c.provider === 'comfyui') return new (await import('./providers/comfyui')).ComfyUIProvider(c);
  return new (await import('./providers/openai')).OpenAIImageProvider(c);
}

export async function createQaProvider(c: PipelineConfig): Promise<QaProvider> {
  if (c.qaProvider === 'mock') return new (await import('./providers/mock')).MockQaProvider();
  if (c.qaProvider === 'ollama')
    return new (await import('./providers/ollama')).OllamaQaProvider(c);
  return new (await import('./providers/openai')).OpenAIQaProvider(c);
}
