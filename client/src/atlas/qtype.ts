/**
 * What KIND of question it is — why / how / when / how much / should /
 * what-is / who / where — in English, Ukrainian and Russian. The topic says
 * WHAT we talk about; the question type says which side of it to answer.
 */
import { normalize } from './nlu';
import type { Facet } from './kb';

const RULES: [Facet, RegExp][] = [
  [
    'why',
    /(^|\s)(why|how come|what for|чому|навіщо|нащо|чого це|з якої причини|почему|зачем|отчего)(\s|$)/,
  ],
  [
    'howMuch',
    /(^|\s)(how (much|many|long|heavy|often|far|deep)|скільки|сколько|як довго|як часто|як глибоко|как долго|как часто|как глубоко|яку вагу|який вага|what weight|how many times)(\s|$)/,
  ],
  [
    'when',
    /(^|\s)(when|what time|at what point|коли|о котрій|в який момент|когда|во сколько)(\s|$)/,
  ],
  [
    'should',
    /(^|\s)(should|shall|can i|could i|is it (ok|okay|bad|good|fine|safe|worth)|do i need|must i|worth it|чи варто|чи можна|чи треба|чи потрібно|чи нормально|чи погано|чи добре|чи безпечно|чи шкідливо|стоит ли|можно ли|нужно ли|надо ли|нормально ли|вредно ли)(\s|$)/,
  ],
  [
    'what',
    /(^|\s)(what is|what s|what are|what does .* mean|define|meaning of|що таке|що це таке|що означає|що значить|что такое|что значит|что означает)(\s|$)/,
  ],
  ['who', /(^|\s)(who|for whom|хто|для кого|кто|кому)(\s|$)/],
  ['where', /(^|\s)(where|де|куди|звідки|где|куда)(\s|$)/],
  [
    'how',
    /(^|\s)(how|how do|how to|how should|як|яким чином|як правильно|как|каким образом|как правильно)(\s|$)/,
  ],
];

/** First matching question type (in the order above), or null. */
export function questionType(text: string): Facet | null {
  const p = ` ${normalize(text)} `;
  for (const [f, re] of RULES) if (re.test(p)) return f;
  return null;
}

/** "My / мій / мой…" — the question is about YOUR data, not the concept. */
export function isPersonal(text: string): boolean {
  return /(^|\s)(my|mine|me|i|i m|am i|did i|do i|мій|моя|моє|мої|мого|моїй|мене|мені|я|мой|моя|мое|мои|меня|мне)(\s|$)/.test(
    ` ${normalize(text)} `,
  );
}

export const FACET_CHIP: Record<Facet, [string, string]> = {
  why: ['Why?', 'Чому?'],
  how: ['How?', 'Як?'],
  when: ['When?', 'Коли?'],
  howMuch: ['How much?', 'Скільки?'],
  should: ['Should I?', 'Чи варто?'],
  what: ['What is it?', 'Що це?'],
  who: ['Who is it for?', 'Для кого?'],
  where: ['Where?', 'Де?'],
};
