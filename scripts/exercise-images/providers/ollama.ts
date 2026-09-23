/**
 * Local vision QA through Ollama's native /api/chat (images as base64,
 * JSON output). keep_alive 0 unloads the model right after each review, so it
 * and the image model never sit in unified memory together.
 */
import fs from 'node:fs';
import { z } from 'zod';
import type { PipelineConfig } from '../config';
import { ProviderError, isRetryableStatus } from '../errors';
import { fetchWithTimeout } from '../pool';
import type { QaProvider, QaRequest } from '../provider';
import { QA_SYSTEM, qaUserText } from '../qa';

const ChatResponse = z.object({ message: z.object({ content: z.string() }) });

export class OllamaQaProvider implements QaProvider {
  readonly name = 'ollama-vision';
  constructor(private readonly c: PipelineConfig) {}

  async review(req: QaRequest): Promise<unknown> {
    const images = [req.reference, req.generated, ...(req.identity ? [req.identity] : [])].map(
      (p) => fs.readFileSync(p).toString('base64'),
    );
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${this.c.ollamaUrl}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.c.qaModel,
            stream: false,
            format: 'json',
            keep_alive: 0,
            options: { temperature: 0 },
            messages: [
              { role: 'system', content: QA_SYSTEM },
              { role: 'user', content: qaUserText(req), images },
            ],
          }),
        },
        this.c.timeoutMs,
      );
    } catch (e) {
      throw new ProviderError(
        `Ollama is not reachable at ${this.c.ollamaUrl} — open the Ollama app or run \`ollama serve\` (${(e as Error).message})`,
        { retryable: true },
      );
    }
    if (!res.ok) {
      const body = await res.text();
      const hint = /not found/i.test(body) ? ` — run: ollama pull ${this.c.qaModel}` : '';
      throw new ProviderError(`Ollama ${res.status}: ${body.slice(0, 300)}${hint}`, {
        retryable: isRetryableStatus(res.status),
        status: res.status,
      });
    }
    const parsed = ChatResponse.safeParse(await res.json());
    if (!parsed.success)
      throw new ProviderError('unexpected Ollama response shape', { retryable: true });
    try {
      return normalizeLocalQa(JSON.parse(parsed.data.message.content));
    } catch {
      throw new ProviderError('Ollama QA answer was not JSON', { retryable: true });
    }
  }
}

/**
 * Small local models are sloppier with the schema: scores as strings or 0–1 /
 * 0–100 scales, missing arrays. Normalise the obvious cases; anything else
 * still fails strict validation and lands in manual review.
 */
export function normalizeLocalQa(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = { ...(raw as Record<string, unknown>) };
  const n = typeof r.score === 'string' ? Number(r.score) : r.score;
  if (typeof n === 'number' && Number.isFinite(n)) {
    let score = n;
    if (score > 10 && score <= 100) score = score / 10;
    else if (score > 0 && score <= 1 && !Number.isInteger(score)) score = score * 10;
    r.score = Math.max(0, Math.min(10, score));
  }
  for (const k of [
    'passed',
    'exerciseCorrect',
    'equipmentCorrect',
    'poseCorrect',
    'anatomyCorrect',
    'styleCorrect',
    'identityConsistent',
  ]) {
    if (r[k] === 'true') r[k] = true;
    if (r[k] === 'false') r[k] = false;
    // null = "couldn't tell": identity is optional, every other check fails safe.
    if (r[k] === null || r[k] === undefined)
      if (k === 'identityConsistent') delete r[k];
      else r[k] = false;
  }
  if (!Array.isArray(r.issues))
    r.issues = typeof r.issues === 'string' && r.issues ? [r.issues] : [];
  if (r.retryInstruction === '') r.retryInstruction = null;
  return r;
}
