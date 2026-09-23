/**
 * Local, free generation through a ComfyUI server on this machine
 * (scripts/exercise-images/local/start-comfyui.sh). Uses only ComfyUI's
 * documented HTTP API: /upload/image, /prompt, /history/<id>, /view, /free,
 * /object_info. No tokens, nothing leaves the computer.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PipelineConfig } from '../config';
import { ProviderError } from '../errors';
import { sha256, short } from '../hash';
import { mimeOf } from '../imageInfo';
import { fetchWithTimeout, sleep } from '../pool';
import type { ExerciseImageProvider, GenerateRequest, GenerateResult } from '../provider';
import { buildComfyGraph, requiredModels } from './comfyGraph';

interface HistoryItem {
  status?: {
    status_str?: string;
    completed?: boolean;
    messages?: [string, Record<string, unknown>][];
  };
  outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>;
}

/** object_info combo inputs: legacy `[[...options]]` or `["COMBO", { options }]`. */
function comboOptions(spec: unknown): string[] {
  if (!Array.isArray(spec)) return [];
  if (Array.isArray(spec[0])) return spec[0] as string[];
  const opts = (spec[1] as { options?: unknown } | undefined)?.options;
  return Array.isArray(opts) ? (opts as string[]) : [];
}

export class ComfyUIProvider implements ExerciseImageProvider {
  readonly name = 'comfyui';
  readonly usesReferences = true;
  private readonly uploaded = new Map<string, string>();
  constructor(private readonly c: PipelineConfig) {}

  private url(p: string): string {
    return `${this.c.comfy.url}${p}`;
  }

  private async call(p: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<Response> {
    try {
      return await fetchWithTimeout(this.url(p), init, timeoutMs);
    } catch (e) {
      throw new ProviderError(
        `ComfyUI is not reachable at ${this.c.comfy.url} — start it with ` +
          `scripts/exercise-images/local/start-comfyui.sh (${(e as Error).message})`,
        { retryable: true },
      );
    }
  }

  async preflight(): Promise<void> {
    const stats = await this.call('/system_stats');
    if (!stats.ok)
      throw new ProviderError(`ComfyUI /system_stats: ${stats.status}`, { retryable: false });
    const missing: string[] = [];
    for (const r of requiredModels(this.c.comfy)) {
      const res = await this.call(`/object_info/${r.node}`);
      const info = res.ok
        ? ((await res.json()) as Record<string, { input?: { required?: Record<string, unknown> } }>)
        : {};
      const node = info[r.node];
      if (!node) {
        missing.push(`node ${r.node} (is ComfyUI-GGUF installed? rerun local/setup-mac.sh)`);
        continue;
      }
      if (!comboOptions(node.input?.required?.[r.input]).includes(r.file)) missing.push(r.file);
    }
    if (missing.length) {
      throw new ProviderError(
        `ComfyUI is missing: ${missing.join(', ')}. Run scripts/exercise-images/local/setup-mac.sh ${this.c.comfy.preset}`,
        { retryable: false },
      );
    }
  }

  /** Content-addressed upload: the same file (anchor, start frame) is sent once. */
  private async upload(file: string): Promise<string> {
    const buf = fs.readFileSync(file);
    const name = `${short(sha256(buf))}${path.extname(file) || '.png'}`;
    const cached = this.uploaded.get(name);
    if (cached) return cached;
    const form = new FormData();
    form.append('image', new Blob([buf], { type: mimeOf(file) }), name);
    form.append('subfolder', 'exercise-images');
    form.append('type', 'input');
    form.append('overwrite', 'true');
    const res = await this.call('/upload/image', { method: 'POST', body: form });
    if (!res.ok)
      throw new ProviderError(`ComfyUI upload failed: ${res.status}`, {
        retryable: res.status >= 500,
      });
    const j = (await res.json()) as { name: string; subfolder?: string };
    const ref = j.subfolder ? `${j.subfolder}/${j.name}` : j.name;
    this.uploaded.set(name, ref);
    return ref;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const images: string[] = [];
    for (const r of req.references) images.push(await this.upload(r.path));
    const graph = buildComfyGraph(this.c.comfy, {
      prompt: req.prompt,
      images,
      seed: req.seed ?? 0,
      size: req.size,
    });
    const res = await this.call('/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: graph.nodes, client_id: randomUUID() }),
    });
    if (!res.ok) {
      // 400 = workflow validation (missing node/model, bad input) — retrying won't help.
      throw new ProviderError(
        `ComfyUI rejected the workflow (${res.status}): ${(await res.text()).slice(0, 1500)}`,
        {
          retryable: res.status >= 500,
          status: res.status,
        },
      );
    }
    const { prompt_id: id } = (await res.json()) as { prompt_id: string };

    const deadline = Date.now() + this.c.timeoutMs;
    for (;;) {
      await sleep(2000);
      const h = await this.call(`/history/${id}`);
      const item = h.ok ? ((await h.json()) as Record<string, HistoryItem>)[id] : undefined;
      if (item?.status?.status_str === 'error') {
        const err = item.status.messages?.find(([t]) => t === 'execution_error')?.[1];
        const msg = err
          ? `${String(err.node_type)}: ${String(err.exception_message)}`.trim()
          : 'unknown error';
        // Out-of-memory can pass after models are unloaded; other errors are config problems.
        const oom = /out of memory|MPS backend out of memory/i.test(msg);
        if (oom) await this.release();
        throw new ProviderError(`ComfyUI execution error — ${msg}`, { retryable: oom });
      }
      const img = item?.outputs?.[graph.output]?.images?.[0];
      if (img) {
        const q = new URLSearchParams({
          filename: img.filename,
          subfolder: img.subfolder,
          type: img.type,
        });
        const v = await this.call(`/view?${q.toString()}`);
        if (!v.ok) throw new ProviderError(`ComfyUI /view: ${v.status}`, { retryable: true });
        return { image: Buffer.from(await v.arrayBuffer()), mime: 'image/png', providerRef: id };
      }
      if (item?.status?.completed)
        throw new ProviderError('ComfyUI finished without an image', { retryable: true });
      if (Date.now() > deadline) {
        await this.call('/interrupt', { method: 'POST' }).catch(() => undefined);
        throw new ProviderError(
          `ComfyUI timed out after ${Math.round(this.c.timeoutMs / 1000)} s`,
          {
            retryable: true,
          },
        );
      }
    }
  }

  async release(): Promise<void> {
    await this.call('/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
    }).catch(() => undefined);
  }
}
