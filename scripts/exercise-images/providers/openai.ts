/**
 * OpenAI provider: image EDIT endpoint (reference-conditioned generation) and
 * a vision chat model for QA. Endpoints/params are the documented Images API
 * (`POST /images/edits`, multipart, several `image[]` inputs) and Chat
 * Completions with image inputs + JSON mode. Check the current API reference
 * before a big run — model names and limits change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { PipelineConfig } from '../config';
import { ProviderError, isRetryableStatus, parseRetryAfter } from '../errors';
import { fetchWithTimeout } from '../pool';
import type {
  ExerciseImageProvider,
  GenerateRequest,
  GenerateResult,
  QaProvider,
  QaRequest,
} from '../provider';

const ImagesResponse = z.object({
  data: z.array(z.object({ b64_json: z.string().min(100) })).min(1),
});
const ChatResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

function mimeOf(p: string): string {
  const ext = path.extname(p).toLowerCase();
  return ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
}

async function failFrom(res: Response): Promise<never> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { error?: { message?: string; code?: string } };
    if (body.error?.message) msg += `: ${body.error.message}`;
  } catch {
    /* non-JSON error body */
  }
  throw new ProviderError(msg, {
    retryable: isRetryableStatus(res.status),
    status: res.status,
    retryAfterMs: parseRetryAfter(res.headers.get('retry-after')),
  });
}

function requireKey(c: PipelineConfig): string {
  if (!c.apiKey) {
    throw new ProviderError('OPENAI_API_KEY is not set (see .env.example)', { retryable: false });
  }
  return c.apiKey;
}

export class OpenAIImageProvider implements ExerciseImageProvider {
  readonly name = 'openai';
  readonly usesReferences = true;
  constructor(private readonly c: PipelineConfig) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const key = requireKey(this.c);
    const form = new FormData();
    form.append('model', this.c.model);
    form.append('prompt', req.prompt);
    form.append('n', '1');
    form.append('size', `${req.size.w}x${req.size.h}`);
    form.append('quality', this.c.quality);
    // Keeps faces/details of the inputs — important for the identity anchor.
    if (this.c.model.startsWith('gpt-image-1')) form.append('input_fidelity', 'high');
    for (const r of req.references) {
      const buf = fs.readFileSync(r.path);
      form.append('image[]', new Blob([buf], { type: mimeOf(r.path) }), path.basename(r.path));
    }
    const res = await fetchWithTimeout(
      `${this.c.baseUrl}/images/edits`,
      { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form },
      this.c.timeoutMs,
    );
    if (!res.ok) await failFrom(res);
    const parsed = ImagesResponse.safeParse(await res.json());
    if (!parsed.success) {
      throw new ProviderError(`unexpected images response: ${parsed.error.message}`, {
        retryable: true,
      });
    }
    return { image: Buffer.from(parsed.data.data[0].b64_json, 'base64'), mime: 'image/png' };
  }
}

const QA_SYSTEM = `You are a strict QA reviewer for an exercise-instruction image library.
You get: (1) the ORIGINAL reference photo of the exercise, (2) the NEW generated image,
optionally (3) the IDENTITY reference of the library's athlete, and the exercise metadata.
Judge the NEW image. Exercise correctness matters far more than beauty.
Check: same exercise; same equipment type, placement and setup (bench angle, seat, cable/pulley
height and attachment, machine geometry, Smith vs free bar); body orientation and stance;
grip orientation and width; which limbs work (unilateral stays unilateral); the requested
start/end state; anatomy (hands, fingers, joints); equipment plausibility (cables connected,
no floating plates, straight bars); style (dark restrained studio set, athlete shirtless in
plain dark shorts and shoes, no text/logos/other people); identity match with (3) if given;
obvious AI artifacts.
Respond ONLY with JSON:
{"passed":bool,"score":number 0-10,"exerciseCorrect":bool,"equipmentCorrect":bool,
"poseCorrect":bool,"anatomyCorrect":bool,"styleCorrect":bool,"identityConsistent":bool,
"issues":[string],"retryInstruction":string|null}
retryInstruction: one or two concrete, physical corrections for a regeneration (e.g.
"Keep the pulley at knee height as in the reference; only the right arm moves."), or null.`;

function dataUrl(p: string): string {
  return `data:${mimeOf(p)};base64,${fs.readFileSync(p).toString('base64')}`;
}

export class OpenAIQaProvider implements QaProvider {
  readonly name = 'openai-vision';
  constructor(private readonly c: PipelineConfig) {}

  async review(req: QaRequest): Promise<unknown> {
    const key = requireKey(this.c);
    const content: unknown[] = [
      {
        type: 'text',
        text: `Exercise metadata: ${req.exerciseSummary}\nRequested frame: ${req.state}.\nImage 1 = ORIGINAL reference, image 2 = NEW generated${req.identity ? ', image 3 = IDENTITY reference' : ''}.`,
      },
      { type: 'image_url', image_url: { url: dataUrl(req.reference) } },
      { type: 'image_url', image_url: { url: dataUrl(req.generated) } },
    ];
    if (req.identity)
      content.push({ type: 'image_url', image_url: { url: dataUrl(req.identity) } });
    const res = await fetchWithTimeout(
      `${this.c.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.c.qaModel,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: QA_SYSTEM },
            { role: 'user', content },
          ],
        }),
      },
      this.c.timeoutMs,
    );
    if (!res.ok) await failFrom(res);
    const parsed = ChatResponse.safeParse(await res.json());
    if (!parsed.success || !parsed.data.choices[0].message.content) {
      throw new ProviderError('unexpected QA response shape', { retryable: true });
    }
    try {
      return JSON.parse(parsed.data.choices[0].message.content) as unknown;
    } catch {
      throw new ProviderError('QA response was not JSON', { retryable: true });
    }
  }
}
