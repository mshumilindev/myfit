/**
 * Free-form chat with Atlas via Gemini (Firebase AI Logic — straight from the
 * PWA, no server of our own; App Check guards the key). The model only words
 * things: every number it may use comes from the facts we compute and pass in.
 * The reply still goes through the guard (hard tempers never talk about the
 * body). Offline, over the daily cap, or on any error → Atlas answers from his
 * own phrase book.
 */
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { app } from '../firebase';
import type { LocaleId } from '../i18n';
import type { CoachSettings, Temper } from './types';
import { TEMPER_ID } from './types';
import { lineAllowed } from './guard';

/** Model id — override with VITE_ATLAS_MODEL without a code change. */
export const ATLAS_MODEL =
  (import.meta.env.VITE_ATLAS_MODEL as string | undefined) ?? 'gemini-3.5-flash-lite';
/** Messages per day before Atlas falls back to his phrase book. */
export const DAILY_CHAT_CAP = 30;

const LANG_NAME: Record<LocaleId, string> = {
  en: 'English',
  uk: 'Ukrainian',
  pl: 'Polish',
  lt: 'Lithuanian',
  et: 'Estonian',
};

const PERSONA: Record<Temper, string> = {
  1: 'Warm and encouraging. Celebrate effort, soften bad news, use exclamation marks sparingly.',
  2: 'Calm and methodical. Plain facts, one clear instruction, no drama.',
  3: 'Blunt. Say it once, plainly, short sentences, no praise unless earned.',
  4: 'A loud drill sergeant. Short commands, occasional CAPITALS for emphasis, zero excuses accepted.',
  5: 'Merciless: cold, dry, sardonic, never impressed. Cutting one-liners such as "Pathetic." Contempt is for lazy effort only.',
};

export interface ChatTurn {
  from: 'me' | 'atlas';
  text: string;
}

export function systemPrompt(p: {
  temper: Temper;
  coach: CoachSettings;
  locale: LocaleId;
  factsJson: string;
}): string {
  const hard = p.temper >= 4;
  return [
    `You are Atlas, the built-in strength coach in the Spotter gym app. Temper: ${TEMPER_ID[p.temper]}. ${PERSONA[p.temper]}`,
    `Role: ${p.coach.role === 'main' ? 'main coach — you own the programme' : 'extra coach — another coach or plan owns the programme; you only observe, grade and comment'}.`,
    `Always answer in ${LANG_NAME[p.locale]}. At most 3 short sentences. No markdown, no lists, no emoji.`,
    'Use only numbers that appear in FACTS. Never invent weights, reps, dates or percentages. If FACTS do not answer the question, say so in character.',
    hard
      ? 'Hard rules: mock effort only (skipped days, short rest, lazy sets). Never comment on body weight, body shape, looks, food, health or anything personal. Never encourage training through pain.'
      : 'Never comment on body shape or looks. Never encourage training through pain.',
    p.coach.yoMama && hard
      ? '"Your mom" jokes about effort are allowed, rarely.'
      : 'No "your mom" jokes.',
    p.coach.swearing && p.temper === 5 ? 'Mild swearing is allowed, rarely.' : 'No swearing.',
    'If the user mentions pain or an injury: drop the act, answer calmly, suggest easing off and logging it in the Injury screen. No medical diagnosis.',
    'Off-topic questions (not training, recovery or the app): one line in character, then steer back to training.',
    `FACTS (JSON, computed by the app from the user's own log): ${p.factsJson}`,
  ].join('\n');
}

const CAP_KEY = 'spotter.atlasChatCap';
function underCap(now: number): boolean {
  try {
    const day = new Date(now).toDateString();
    const raw = JSON.parse(localStorage.getItem(CAP_KEY) ?? '{}') as { day?: string; n?: number };
    const n = raw.day === day ? (raw.n ?? 0) : 0;
    if (n >= DAILY_CHAT_CAP) return false;
    localStorage.setItem(CAP_KEY, JSON.stringify({ day, n: n + 1 }));
    return true;
  } catch {
    return true;
  }
}

export type AskResult =
  { ok: true; text: string } | { ok: false; reason: 'offline' | 'cap' | 'error' | 'blocked' };

/**
 * Ask Atlas. Streams partial text through `onText`; resolves with the final
 * (guarded) reply, or a reason to answer from the phrase book instead.
 */
export async function askAtlas(p: {
  question: string;
  history: ChatTurn[];
  temper: Temper;
  coach: CoachSettings;
  locale: LocaleId;
  factsJson: string;
  now: number;
  onText?: (partial: string) => void;
}): Promise<AskResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return { ok: false, reason: 'offline' };
  if (!underCap(p.now)) return { ok: false, reason: 'cap' };
  try {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: ATLAS_MODEL,
      systemInstruction: systemPrompt(p),
      generationConfig: { maxOutputTokens: 220, temperature: 0.8 },
    });
    const chat = model.startChat({
      history: p.history.slice(-10).map((m) => ({
        role: m.from === 'me' ? 'user' : 'model',
        parts: [{ text: m.text }],
      })),
    });
    const res = await chat.sendMessageStream(p.question);
    let text = '';
    for await (const chunk of res.stream) {
      text += chunk.text();
      p.onText?.(text);
    }
    text = text.trim();
    if (!text) return { ok: false, reason: 'error' };
    if (!lineAllowed(text, p.temper)) return { ok: false, reason: 'blocked' };
    return { ok: true, text };
  } catch (err) {
    console.warn('atlas: chat failed', err);
    return { ok: false, reason: 'error' };
  }
}
