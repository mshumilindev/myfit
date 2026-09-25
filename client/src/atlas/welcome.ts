/**
 * The first thing you see in an empty chat: Atlas says hello in its temper's
 * voice, tells you what it can do (from your own log when there is one), and
 * offers three ways in. Not stored — it's there until you write.
 */
import type { AskCtx, Tr } from './intentKit';
import { finishedOf, loggedLifts } from './intentKit';
import { startChips } from './intents';

export interface Welcome {
  text: string;
  chips: string[];
}

export function welcome(c: AskCtx): Welcome {
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const n = finishedOf(c).length;
  const top = loggedLifts(c).sort((a, b) => b.count - a.count)[0];
  const lift = top ? c.fmt.exercise(top.name) : null;
  const t = c.temper;
  const hour = new Date(c.now).getHours();

  let hello: string;
  if (t <= 1) {
    const hey = hour < 12 ? L('Morning, bro!', 'Доброго ранку, бро!') : L('Yo, bro!', 'Йоу, бро!');
    hello = n
      ? L(
          `${hey} I'm Atlas — your coach in your pocket. Went through your ${n} workouts, so I know what you've got going.`,
          `${hey} Я Atlas — твій тренер у кишені. Переглянув твої тренування (${n}) — тож я в темі.`,
        )
      : L(
          `${hey} I'm Atlas — your coach in your pocket. Log the first workout and I'll be with you on every one after it.`,
          `${hey} Я Atlas — твій тренер у кишені. Запиши перше тренування — і далі я з тобою на кожному.`,
        );
  } else if (t >= 5) {
    hello = n
      ? L(
          `Oh, you found the chat. I've seen all ${n} of your workouts. All of them. Let's talk.`,
          `О, знайшов чат. Я бачив усі твої тренування (${n}). Усі. Поговоримо.`,
        )
      : L(
          'Zero workouts and already chatting. Bold. Fine — I can still be useful.',
          'Нуль тренувань, а ти вже балакати. Сміливо. Гаразд — користь буде й так.',
        );
  } else {
    hello = n
      ? L(
          `Atlas. ${n} workouts in your log — I've read them.`,
          `Atlas. У журналі ${n} тренувань — я їх бачу.`,
        )
      : L(
          'Atlas. Your log is empty — start with one workout.',
          'Atlas. Журнал порожній — почни з одного тренування.',
        );
  }

  const can = n
    ? L(
        `Ask me how ${lift ?? 'a lift'} is going, what to train today, why something's stuck, or how to do an exercise right.`,
        `Питай, як іде ${lift ?? 'вправа'}, що тренувати сьогодні, чому щось застрягло чи як правильно робити вправу.`,
      )
    : L(
        'Ask me about technique, a plan, rest and recovery — or anything you want to start with.',
        'Питай про техніку, план, відпочинок і відновлення — чи з чого почати взагалі.',
      );
  const care =
    t >= 5
      ? L(
          "Something hurts — say so, no jokes there. Forgot an exercise's name — describe it, I'll dig it up.",
          'Щось болить — кажи, тут без жартів. Забув назву вправи — опиши, я знайду.',
        )
      : L(
          "Something hurts — tell me and we'll sort it out. Forgot an exercise's name — describe it and I'll find it.",
          'Щось болить — скажи, розберемось. Забув назву вправи — опиши, і я знайду.',
        );
  return { text: `${hello} ${can} ${care}`, chips: startChips(c, L) };
}
