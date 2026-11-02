/**
 * SPO-35 P4: leaving a guided flow (pain check-in, find-a-lift) when the person clearly asks about something else.
 * Before this a pain check-in kept asking "When does it hurt?" through "what weight did I use for pullups" and "thanks".
 * Answers to the flow's own questions are short and about the pain/lift; a question about the log, the chat, or a
 * new subject is not.
 */
import { readDataQuestion } from './dataQuestion';
import type { AskCtx, Parsed, Tr } from './intentKit';
import { painFollowUp } from './followTurn';
import { metaTurn } from './metaTurn';

const THANKS_RE =
  /^\s*(thanks|thank you|thx|ty|cheers|дякую|дяка|дякуємо|спасибі|dziękuję|dzięki|ačiū|dėkui|aitäh|aitäh|tänan)(?!\p{L})/iu;
/** The same switches in Polish, Lithuanian and Estonian (\b is ASCII-only, so explicit boundaries). */
const SWITCH_X_RE =
  /(?<!\p{L})(ką (šiandien )?treniruoti|kiek baltymų|kas tu|koks mano|kiek kartų|mida (täna )?treenida|kui palju valku|kes sa oled|mis on minu|mitu (korda|seeriat)|co (dziś |dzisiaj )?trenować|ile białka|kto cię|jaki jest mój|ile (serii|razy|ważyłem))(?!\p{L})/iu;
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
    painFollowUp(question) ||
    SWITCH_RE.test(question) ||
    SWITCH_X_RE.test(question) ||
    !!metaTurn(question, {}, 0, L) ||
    !!readDataQuestion(question, parse(question, c), c)
  );
}

const OPENER_RE =
  /^\s*(what('s| is| are| does| do)|where|who|why|how (do|does|can|should|long|often|many|much)|when|що таке|де |хто |чому|як (мені|можна|правильно)|скільки)(?!\p{L})/iu;

/** A new question of its own ("what is a deload"), not a one-word answer to "which lift?". */
export const freshQuestion = (question: string): boolean =>
  question.trim().split(/\s+/).length >= 3 &&
  OPENER_RE.test(question) &&
  !/^\s*what about/iu.test(question);
