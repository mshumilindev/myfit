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
  /** openai = paid API · comfyui = free, local (ComfyUI on this Mac) · mock = offline plumbing. */
  IMAGE_PROVIDER: z.enum(['openai', 'comfyui', 'mock']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  /** openai model id (comfyui models come from COMFYUI_*). */
  IMAGE_MODEL: z.string().default('gpt-image-1'),
  /** Provider quality knob (openai: low | medium | high | auto). */
  IMAGE_QUALITY: z.string().default('high'),
  /** Size requested from the provider; post-processing derives the app size. */
  IMAGE_SIZE: z
    .string()
    .regex(/^\d+x\d+$/)
    .optional(),
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
  /** Per image. Default 180 s for the API, 15 min for local generation. */
  IMAGE_GENERATION_TIMEOUT_MS: z.coerce.number().int().min(10000).optional(),
  /** Automatic QA-driven regenerations before an item goes to manual review. */
  IMAGE_MAX_QA_ATTEMPTS: z.coerce.number().int().min(0).max(5).default(2),
  IMAGE_QA_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** auto = openai for openai, ollama for comfyui, mock for mock. */
  IMAGE_QA_PROVIDER: z.enum(['auto', 'openai', 'ollama', 'mock']).default('auto'),
  /** Default gpt-4.1 (openai) / qwen2.5vl:7b (ollama). */
  IMAGE_QA_MODEL: z.string().optional(),
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

  // --- Local generation (IMAGE_PROVIDER=comfyui) ---
  COMFYUI_URL: z.string().url().default('http://127.0.0.1:8188'),
  /** qwen-edit-2511 = best quality (default) · flux2-klein-4b = fast fallback. */
  COMFYUI_PRESET: z.enum(['qwen-edit-2511', 'flux2-klein-4b']).default('qwen-edit-2511'),
  /** Override the preset's model file names (as they appear in ComfyUI/models/…). */
  COMFYUI_UNET: z.string().optional(),
  COMFYUI_CLIP: z.string().optional(),
  COMFYUI_VAE: z.string().optional(),
  /** Speed LoRA; "none" = full-step sampling (much slower, slightly better). */
  COMFYUI_LORA: z.string().optional(),
  COMFYUI_STEPS: z.coerce.number().int().min(1).max(100).optional(),
  COMFYUI_CFG: z.coerce.number().min(0).max(20).optional(),
  /** Unload ComfyUI models before local QA so both fit in unified memory. */
  COMFYUI_FREE_BEFORE_QA: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  OLLAMA_URL: z.string().url().default('http://127.0.0.1:11434'),
});

export type ComfyPreset = 'qwen-edit-2511' | 'flux2-klein-4b';

export interface ComfyConfig {
  url: string;
  preset: ComfyPreset;
  unet: string;
  clip: string;
  vae: string;
  lora: string | null;
  steps: number;
  cfg: number;
  freeBeforeQa: boolean;
}

/** Model files per preset — exactly what setup-mac.sh downloads. */
export const COMFY_PRESETS: Record<
  ComfyPreset,
  {
    unet: string;
    clip: string;
    vae: string;
    lora: string | null;
    steps: number;
    cfg: number;
    fullSteps: number;
    fullCfg: number;
  }
> = {
  // Qwen-Image-Edit-2511 (Apache-2.0), GGUF Q4_K_M so it fits 24 GB unified memory,
  // + the 4-step Lightning LoRA. Up to 3 reference images.
  'qwen-edit-2511': {
    unet: 'qwen-image-edit-2511-Q4_K_M.gguf',
    clip: 'Qwen2.5-VL-7B-Instruct-UD-Q4_K_XL.gguf',
    vae: 'qwen_image_vae.safetensors',
    lora: 'Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors',
    steps: 4,
    cfg: 1,
    fullSteps: 30,
    fullCfg: 4,
  },
  // FLUX.2 [klein] 4B distilled (Apache-2.0): fast, weaker on complex equipment.
  'flux2-klein-4b': {
    unet: 'flux-2-klein-4b.safetensors',
    clip: 'qwen_3_4b.safetensors',
    vae: 'flux2-vae.safetensors',
    lora: null,
    steps: 4,
    cfg: 1,
    fullSteps: 4,
    fullCfg: 1,
  },
};

export type ImageState = 'start' | 'end' | 'hero';

export interface PipelineConfig {
  provider: 'openai' | 'comfyui' | 'mock';
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
  qaProvider: 'openai' | 'ollama' | 'mock';
  qaModel: string;
  qaMinScore: number;
  bulkThreshold: number;
  states: ImageState[];
  keepSource: boolean;
  comfy: ComfyConfig;
  ollamaUrl: string;
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
  const local = e.IMAGE_PROVIDER === 'comfyui';
  const preset = COMFY_PRESETS[e.COMFYUI_PRESET];
  const lora =
    e.COMFYUI_LORA === undefined ? preset.lora : e.COMFYUI_LORA === 'none' ? null : e.COMFYUI_LORA;
  const fast = !!lora || e.COMFYUI_PRESET === 'flux2-klein-4b';
  const comfy: ComfyConfig = {
    url: e.COMFYUI_URL.replace(/\/$/, ''),
    preset: e.COMFYUI_PRESET,
    unet: e.COMFYUI_UNET ?? preset.unet,
    clip: e.COMFYUI_CLIP ?? preset.clip,
    vae: e.COMFYUI_VAE ?? preset.vae,
    lora,
    steps: e.COMFYUI_STEPS ?? (fast ? preset.steps : preset.fullSteps),
    cfg: e.COMFYUI_CFG ?? (fast ? preset.cfg : preset.fullCfg),
    freeBeforeQa: e.COMFYUI_FREE_BEFORE_QA,
  };
  const qaProvider =
    e.IMAGE_QA_PROVIDER !== 'auto'
      ? e.IMAGE_QA_PROVIDER
      : e.IMAGE_PROVIDER === 'comfyui'
        ? 'ollama'
        : e.IMAGE_PROVIDER;
  return {
    provider: e.IMAGE_PROVIDER,
    apiKey: e.OPENAI_API_KEY,
    baseUrl: e.OPENAI_BASE_URL,
    model: local
      ? `${comfy.preset}:${comfy.unet}${comfy.lora ? `+${comfy.lora}` : ''}@${comfy.steps}/${comfy.cfg}`
      : e.IMAGE_MODEL,
    quality: e.IMAGE_QUALITY,
    // Local models work at ~1 MP; 1248x832 is the 3:2 bucket they were trained on.
    size: parseSize(e.IMAGE_SIZE ?? (local ? '1248x832' : '1536x1024')),
    outputSize: parseSize(e.IMAGE_OUTPUT_SIZE),
    outputFormat: e.IMAGE_OUTPUT_FORMAT,
    outputQuality: e.IMAGE_OUTPUT_QUALITY,
    concurrency: e.IMAGE_GENERATION_CONCURRENCY,
    retries: e.IMAGE_GENERATION_RETRIES,
    timeoutMs: e.IMAGE_GENERATION_TIMEOUT_MS ?? (local ? 900_000 : 180_000),
    maxQaAttempts: e.IMAGE_MAX_QA_ATTEMPTS,
    qaEnabled: e.IMAGE_QA_ENABLED,
    qaProvider,
    qaModel: e.IMAGE_QA_MODEL ?? (qaProvider === 'ollama' ? 'qwen2.5vl:7b' : 'gpt-4.1'),
    qaMinScore: e.IMAGE_QA_MIN_SCORE,
    bulkThreshold: e.IMAGE_BULK_THRESHOLD,
    states,
    keepSource: e.IMAGE_KEEP_SOURCE,
    comfy,
    ollamaUrl: e.OLLAMA_URL.replace(/\/$/, ''),
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
