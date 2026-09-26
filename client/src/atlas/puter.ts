/**
 * The spare engine: when Gemini's free quota for the day is used up, Atlas
 * can talk through Puter.js (https://docs.puter.com) instead. Puter is
 * "user-pays": each person uses their own Puter account and its free monthly
 * allowance — nothing is billed to the app. The script is fetched only the
 * first time it's needed (not bundled, not cached for offline), and the first
 * use needs a sign-in to Puter, which must start from a tap.
 */
import type { ChatTurn } from './chat';
import { lineAllowed } from './guard';
import type { Temper } from './types';

const SRC = 'https://js.puter.com/v2/';
/** Small and cheap, so a person's free allowance lasts. Override with VITE_ATLAS_PUTER_MODEL. */
export const PUTER_MODEL =
  (import.meta.env.VITE_ATLAS_PUTER_MODEL as string | undefined) ?? 'gpt-5-nano';

interface PuterChunk {
  text?: string;
}
interface PuterApi {
  ai: {
    chat: (
      messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
      opts: { model: string; stream: true; max_tokens?: number; temperature?: number },
    ) => Promise<AsyncIterable<PuterChunk>>;
  };
  auth: { isSignedIn: () => boolean; signIn: () => Promise<unknown> };
}

let loading: Promise<PuterApi | null> | null = null;

/** Load Puter.js once (a script tag); null offline or if it can't load. */
export function loadPuter(): Promise<PuterApi | null> {
  const w = globalThis as unknown as { puter?: PuterApi; document?: Document };
  if (w.puter) return Promise.resolve(w.puter);
  if (!w.document) return Promise.resolve(null);
  loading ??= new Promise((resolve) => {
    const s = w.document!.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve(w.puter ?? null);
    s.onerror = () => {
      loading = null;
      resolve(null);
    };
    w.document!.head.appendChild(s);
  });
  return loading;
}

export type PuterResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'signin' | 'unavailable' | 'error' | 'blocked' };

/** Is the spare engine ready without asking anything (loaded and signed in)? */
export async function puterReady(): Promise<boolean> {
  const p = await loadPuter();
  try {
    return !!p && p.auth.isSignedIn();
  } catch {
    return false;
  }
}

/** Sign in to Puter — call from a tap (it opens Puter's own window). */
export async function puterSignIn(): Promise<boolean> {
  const p = await loadPuter();
  if (!p) return false;
  try {
    await p.auth.signIn();
    return p.auth.isSignedIn();
  } catch {
    return false;
  }
}

/** Ask through Puter with the same system prompt Gemini gets. */
export async function askPuter(p: {
  system: string;
  history: ChatTurn[];
  question: string;
  temper: Temper;
  onText?: (partial: string) => void;
}): Promise<PuterResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return { ok: false, reason: 'unavailable' };
  const api = await loadPuter();
  if (!api) return { ok: false, reason: 'unavailable' };
  try {
    if (!api.auth.isSignedIn()) return { ok: false, reason: 'signin' };
    const stream = await api.ai.chat(
      [
        { role: 'system', content: p.system },
        ...p.history.slice(-10).map((m) => ({
          role: m.from === 'me' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        })),
        { role: 'user', content: p.question },
      ],
      { model: PUTER_MODEL, stream: true, max_tokens: 220, temperature: 0.8 },
    );
    let text = '';
    for await (const part of stream) {
      text += part?.text ?? '';
      p.onText?.(text);
    }
    text = text.trim();
    if (!text) return { ok: false, reason: 'error' };
    // The same line Gemini must pass: hard tempers never touch the body.
    if (!lineAllowed(text, p.temper)) return { ok: false, reason: 'blocked' };
    return { ok: true, text };
  } catch (err) {
    console.warn('atlas: puter failed', err);
    return { ok: false, reason: 'error' };
  }
}
