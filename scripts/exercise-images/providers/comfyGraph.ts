/**
 * ComfyUI API-format workflows for the local presets, built in code (not a
 * saved JSON) so they stay reviewable and testable. Node graphs follow the
 * official ComfyUI templates:
 *   • image_qwen_image_edit_2511.json         (Qwen-Image-Edit-2511)
 *   • image_flux2_klein_image_edit_4b_distilled.json (FLUX.2 [klein] 4B)
 * GGUF files load through city96/ComfyUI-GGUF (UnetLoaderGGUF / CLIPLoaderGGUF).
 */
import type { ComfyConfig } from '../config';

export type ComfyInput = string | number | boolean | [string, number];
export interface ComfyNode {
  class_type: string;
  inputs: Record<string, ComfyInput>;
}
export interface ComfyGraph {
  nodes: Record<string, ComfyNode>;
  /** Node id whose images are the result. */
  output: string;
}

export interface GraphInput {
  prompt: string;
  /** Uploaded image names (ComfyUI input folder), in reference order. */
  images: string[];
  seed: number;
  size: { w: number; h: number };
}

function builder() {
  const nodes: Record<string, ComfyNode> = {};
  let n = 0;
  const add = (class_type: string, inputs: Record<string, ComfyInput>): string => {
    const id = String(++n);
    nodes[id] = { class_type, inputs };
    return id;
  };
  return { nodes, add };
}

const out = (id: string, slot = 0): [string, number] => [id, slot];
const isGguf = (f: string) => f.toLowerCase().endsWith('.gguf');

/** Qwen-Image-Edit-2511: up to 3 pictures; the first also fixes the output framing. */
function qwenEdit(c: ComfyConfig, g: GraphInput): ComfyGraph {
  if (g.images.length < 1 || g.images.length > 3)
    throw new Error(`qwen-edit-2511 takes 1–3 reference images, got ${g.images.length}`);
  const { nodes, add } = builder();
  const unet = isGguf(c.unet)
    ? add('UnetLoaderGGUF', { unet_name: c.unet })
    : add('UNETLoader', { unet_name: c.unet, weight_dtype: 'default' });
  const clip = isGguf(c.clip)
    ? add('CLIPLoaderGGUF', { clip_name: c.clip, type: 'qwen_image' })
    : add('CLIPLoader', { clip_name: c.clip, type: 'qwen_image', device: 'default' });
  const vae = add('VAELoader', { vae_name: c.vae });

  let model = out(add('ModelSamplingAuraFlow', { model: out(unet), shift: 3.1 }));
  model = out(add('CFGNorm', { model, strength: 1 }));
  if (c.lora)
    model = out(add('LoraLoaderModelOnly', { model, lora_name: c.lora, strength_model: 1 }));

  const loads = g.images.map((image) => add('LoadImage', { image }));
  // Picture 1 (the exercise reference) is scaled to the model's preferred ~1 MP bucket
  // and its latent sets the output size, exactly like the official template.
  const scaled = add('FluxKontextImageScale', { image: out(loads[0]) });
  const encode = (prompt: string) => {
    const inputs: Record<string, ComfyInput> = { clip: out(clip), vae: out(vae), prompt };
    inputs.image1 = out(scaled);
    if (loads[1]) inputs.image2 = out(loads[1]);
    if (loads[2]) inputs.image3 = out(loads[2]);
    return add('FluxKontextMultiReferenceLatentMethod', {
      conditioning: out(add('TextEncodeQwenImageEditPlus', inputs)),
      reference_latents_method: 'index_timestep_zero',
    });
  };
  const positive = encode(g.prompt);
  const negative = encode('');
  const latent = add('VAEEncode', { pixels: out(scaled), vae: out(vae) });
  const sampled = add('KSampler', {
    model,
    seed: g.seed,
    steps: c.steps,
    cfg: c.cfg,
    sampler_name: 'euler',
    scheduler: 'simple',
    positive: out(positive),
    negative: out(negative),
    latent_image: out(latent),
    denoise: 1,
  });
  const image = add('VAEDecode', { samples: out(sampled), vae: out(vae) });
  return { nodes, output: add('PreviewImage', { images: out(image) }) };
}

/** FLUX.2 [klein] 4B: reference latents chained onto both conditionings. */
function flux2Klein(c: ComfyConfig, g: GraphInput): ComfyGraph {
  const { nodes, add } = builder();
  const unet = isGguf(c.unet)
    ? add('UnetLoaderGGUF', { unet_name: c.unet })
    : add('UNETLoader', { unet_name: c.unet, weight_dtype: 'default' });
  const clip = isGguf(c.clip)
    ? add('CLIPLoaderGGUF', { clip_name: c.clip, type: 'flux2' })
    : add('CLIPLoader', { clip_name: c.clip, type: 'flux2', device: 'default' });
  const vae = add('VAELoader', { vae_name: c.vae });
  let positive = add('CLIPTextEncode', { text: g.prompt, clip: out(clip) });
  let negative = add('ConditioningZeroOut', { conditioning: out(positive) });
  for (const image of g.images) {
    const scaled = add('ImageScaleToTotalPixels', {
      image: out(add('LoadImage', { image })),
      upscale_method: 'lanczos',
      megapixels: 1,
      resolution_steps: 1,
    });
    const latent = add('VAEEncode', { pixels: out(scaled), vae: out(vae) });
    positive = add('ReferenceLatent', { conditioning: out(positive), latent: out(latent) });
    negative = add('ReferenceLatent', { conditioning: out(negative), latent: out(latent) });
  }
  const { w, h } = g.size;
  const sampled = add('SamplerCustomAdvanced', {
    noise: out(add('RandomNoise', { noise_seed: g.seed })),
    guider: out(
      add('CFGGuider', {
        model: out(unet),
        positive: out(positive),
        negative: out(negative),
        cfg: c.cfg,
      }),
    ),
    sampler: out(add('KSamplerSelect', { sampler_name: 'euler' })),
    sigmas: out(add('Flux2Scheduler', { steps: c.steps, width: w, height: h })),
    latent_image: out(add('EmptyFlux2LatentImage', { width: w, height: h, batch_size: 1 })),
  });
  const image = add('VAEDecode', { samples: out(sampled), vae: out(vae) });
  return { nodes, output: add('PreviewImage', { images: out(image) }) };
}

export function buildComfyGraph(c: ComfyConfig, g: GraphInput): ComfyGraph {
  return c.preset === 'flux2-klein-4b' ? flux2Klein(c, g) : qwenEdit(c, g);
}

/** Loader node + input name for each model file, used by preflight to list what's installed. */
export function requiredModels(c: ComfyConfig): { node: string; input: string; file: string }[] {
  const req = [
    isGguf(c.unet)
      ? { node: 'UnetLoaderGGUF', input: 'unet_name', file: c.unet }
      : { node: 'UNETLoader', input: 'unet_name', file: c.unet },
    isGguf(c.clip)
      ? { node: 'CLIPLoaderGGUF', input: 'clip_name', file: c.clip }
      : { node: 'CLIPLoader', input: 'clip_name', file: c.clip },
    { node: 'VAELoader', input: 'vae_name', file: c.vae },
  ];
  if (c.lora) req.push({ node: 'LoraLoaderModelOnly', input: 'lora_name', file: c.lora });
  return req;
}
