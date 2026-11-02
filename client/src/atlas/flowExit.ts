/**
 * SPO-35 P4: leaving a guided flow (pain check-in, find-a-lift) when the person clearly asks about something else.
 * Before this a pain check-in kept asking "When does it hurt?" through "what weight did I use for pullups" and "thanks".
 * Answers to the flow's own questions are short and about the pain/lift; a question about the log, the chat, or a
 * new subject is not.
 */
import { readDataQuestion } from './dataQuestion';
import type { AskCtx, Parsed, Tr } from './intentKit';
import { metaTurn } from './metaTurn';

const THANKS_RE =
  /^\s*(thanks|thank you|thx|ty|cheers|дякую|дяка|дякуємо|спасибі|dziękuję|dzięki)\b/iu;
const SWITCH_RE =
  /\b(what should i train|what to train|show (me )?my|how is my|how are my|what('s| is) my|when did i|how (much|many) did i)\b|що (мені )?тренувати|покажи (мій|мою|моє|мої)|як (там )?(мій|моя|моє|мої)|який (в мене|мій)|коли я (востаннє|останній раз)|co (dziś |dzisiaj )?trenować|pokaż moj\p{L}*|jak (tam )?(mój|moja|moje)/iu;

/** True when the message is not an answer inside the flow but a different question or a polite sign-off. */
export function leavesFlow(
  question: string,
  c: AskCtx,
  L: Tr,
  parse: (q: string, c: AskCtx) => Parsed,
): boolean {
  return (
    THANKS_RE.test(question) ||
    SWITCH_RE.test(question) ||
    !!metaTurn(question, {}, 0, L) ||
    !!readDataQuestion(question, parse(question, c), c)
  );
}
