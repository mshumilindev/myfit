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
  1: "Warm: the user's gym bro. Casual and hyped — 'yo', 'bro', 'dude', 'let's go' (in Ukrainian: 'йоу', 'бро', 'братан', 'красава', 'кайф', 'го'). Celebrates every win, shrugs off bad days ('no stress, we'll get it'), a light gym joke about every third reply.",
  3: "Blunt: straight talk with a smirk. Short sentences, no fluff, no praise unless earned ('look', 'bottom line'; in Ukrainian 'слухай', 'короче', 'без соплів'). A dry, sarcastic gym joke about every third reply.",
  5: "Merciless: Treats the user's effort with open contempt, right on the edge of bullying: sighs, eye-rolls, sarcastic nicknames ('couch warrior', 'gym tourist', 'cupcake'; in Ukrainian 'диванний воїне', 'туристе', 'пиріжечку'), a roast in most replies, praise only as a backhanded jab. The contempt is ONLY for effort — skipped days, short rest, lazy sets, excuses — never for the body, looks, weight, food, health or anything personal.",
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
  const hard = p.temper === 5;
  return [
    `You are Atlas, the built-in strength coach in the Spotter gym app. Temper: ${TEMPER_ID[p.temper]}. ${PERSONA[p.temper]}`,
    `Role: ${p.coach.role === 'main' ? 'main coach — you own the programme' : 'extra coach — another coach or plan owns the programme; you only observe, grade and comment'}.`,
    `Always answer in ${LANG_NAME[p.locale]}, the way a native speaker would actually say it at the gym — natural slang and idioms of that language, never a word-for-word translation from English. At most 3 short sentences. No markdown, no lists.`,
    'Use only numbers that appear in FACTS. Never invent weights, reps, dates or percentages. For progress on a lift use FACTS.allLifts (whole history, any date) — the user may name a lift in any language or slang; match it to the closest name there. Only if FACTS truly do not answer the question, say so in character.',
    hard
      ? 'Hard rules: mock effort only (skipped days, short rest, lazy sets). Never comment on body weight, body shape, looks, food, health or anything personal. Never encourage training through pain.'
      : 'Never comment on body shape or looks. Never encourage training through pain.',
    p.coach.yoMama && hard
      ? '"Your mom" jokes about effort are allowed, rarely.'
      : 'No "your mom" jokes.',
    p.coach.swearing && p.temper === 5
      ? 'Swearing is allowed (moderate — no slurs, nothing about the body).'
      : 'No swearing.',
    'If the user mentions pain or an injury: drop the act, answer calmly, suggest easing off and logging it in the Injury screen. No medical diagnosis.',
    'Off-topic questions (not training, recovery or the app): one line in character, then steer back to training.',
    'Stay consistent: never contradict FACTS.athleteToldMe or your own earlier replies in this conversation. If the data changed since, say what changed.',
    `FACTS (JSON, computed by the app from the user's own log): ${p.factsJson}`,
  ].join('\n');
}

const CAP_KEY = 'spotter.atlasChatCap';
function underCap(now: number): boolean {
  try {
    const day = new Date(now).toDateString();
    const raw = JSON.parse(localStorage.getItem(CAP_KEY) ?? '{}') as {
      day?: string;
      n?: number;
    };
    const n = raw.day === day ? (raw.n ?? 0) : 0;
    if (n >= DAILY_CHAT_CAP) return false;
    localStorage.setItem(CAP_KEY, JSON.stringify({ day, n: n + 1 }));
    return true;
  } catch {
    return true;
  }
}

export type AskResult =
  | { ok: true; text: string }
  | {
      ok: false;
      reason: 'offline' | 'cap' | 'error' | 'blocked' | 'quota';
      until?: number;
    };

const QUOTA_KEY = 'spotter.atlasGeminiPausedUntil';
/** The free tier resets at midnight Pacific ≈ 08:00 UTC; pause until then. */
export function nextQuotaReset(now: number): number {
  const d = new Date(now);
  const reset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8);
  return reset > now ? reset : reset + 86_400_000;
}
/** When Gemini's quota ran out: ms until which we don't call it (0 = available). */
export function geminiPausedUntil(now: number): number {
  try {
    const until = Number(localStorage.getItem(QUOTA_KEY) ?? 0);
    return until > now ? until : 0;
  } catch {
    return 0;
  }
}
export function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg);
}

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
  const paused = geminiPausedUntil(p.now);
  if (paused) return { ok: false, reason: 'quota', until: paused };
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
    if (isQuotaError(err)) {
      const until = nextQuotaReset(p.now);
      try {
        localStorage.setItem(QUOTA_KEY, String(until));
      } catch {
        /* ignore */
      }
      return { ok: false, reason: 'quota', until };
    }
    return { ok: false, reason: 'error' };
  }
}

/**
 * When Atlas isn't sure what a question is about, Gemini only picks the topic
 * (from Atlas's own list) — the answer is still built locally from your data.
 * Nothing but the question and the topic list is sent. Null → no pick.
 */
export async function classifyTopic(p: {
  question: string;
  topics: { id: string; ask: string }[];
  now: number;
}): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  if (geminiPausedUntil(p.now)) return null;
  if (!underCap(p.now)) return null;
  try {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: ATLAS_MODEL,
      systemInstruction: classifyPrompt(p.topics),
      generationConfig: {
        maxOutputTokens: 40,
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });
    const res = await model.generateContent(p.question);
    return parseTopicPick(res.response.text(), p.topics);
  } catch (err) {
    if (isQuotaError(err)) {
      try {
        localStorage.setItem(QUOTA_KEY, String(nextQuotaReset(p.now)));
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

export function classifyPrompt(topics: { id: string; ask: string }[]): string {
  return [
    "You route gym-app questions (any language) to one of the coach's topics.",
    'Reply with JSON only: {"id": "<topic id>"} for the single best topic, or {"id": "none"} if none fits well.',
    'Topics (id: example question):',
    ...topics.map((t) => `${t.id}: ${t.ask}`),
  ].join('\n');
}

/** The picked topic id, if it's one of ours. */
export function parseTopicPick(raw: string, topics: { id: string }[]): string | null {
  try {
    const m = raw.match(/\{[^}]*\}/);
    const id = (JSON.parse(m ? m[0] : raw) as { id?: string }).id;
    return id && topics.some((t) => t.id === id) ? id : null;
  } catch {
    return null;
  }
}
