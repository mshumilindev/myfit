/**
 * On-device dish estimation via Chrome's built-in AI (Gemini Nano / Prompt API).
 * Free, local, no API key, no tokens. Returns null when the built-in model is
 * unavailable — the caller then falls back to manual entry.
 *
 * Supports both API shapes shipped across Chrome versions:
 *   - window.LanguageModel.{availability,create}         (newer)
 *   - window.ai.languageModel.{capabilities,create}      (older)
 */
import type { Macros } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Session = { prompt: (s: string) => Promise<string>; destroy?: () => void };

async function openSession(): Promise<Session | null> {
  const g = globalThis as any;
  try {
    const LM = g.LanguageModel;
    if (LM?.create) {
      const avail = LM.availability ? await LM.availability() : 'available';
      if (avail === 'unavailable') return null;
      return (await LM.create()) as Session;
    }
    const ai = g.ai;
    if (ai?.languageModel?.create) {
      const cap = ai.languageModel.capabilities ? await ai.languageModel.capabilities() : null;
      if (cap && cap.available === 'no') return null;
      return (await ai.languageModel.create()) as Session;
    }
  } catch {
    return null;
  }
  return null;
}

export function aiAvailable(): boolean {
  const g = globalThis as any;
  return !!(g.LanguageModel?.create || g.ai?.languageModel?.create);
}

/** Estimate typical per-portion macros for a named dish. null → use manual. */
export async function estimateDish(name: string): Promise<Macros | null> {
  const q = name.trim();
  if (!q) return null;
  const session = await openSession();
  if (!session) return null;
  try {
    const out = await session.prompt(
      `Estimate the nutrition of ONE typical restaurant portion of the dish "${q}". ` +
        `Reply with ONLY strict minified JSON, no prose, no code fence: ` +
        `{"kcal":<int>,"protein":<grams int>,"fat":<grams int>,"carbs":<grams int>}.`,
    );
    session.destroy?.();
    const m = out.match(/\{[\s\S]*?\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]) as Partial<Macros>;
    if (typeof j.kcal !== 'number' || !isFinite(j.kcal)) return null;
    return {
      kcal: Math.max(0, Math.round(j.kcal)),
      protein: Math.max(0, Math.round(j.protein ?? 0)),
      fat: Math.max(0, Math.round(j.fat ?? 0)),
      carbs: Math.max(0, Math.round(j.carbs ?? 0)),
    };
  } catch {
    session.destroy?.();
    return null;
  }
}
