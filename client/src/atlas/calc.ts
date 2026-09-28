/**
 * Numbers in the question, answered straight — no "which lift?" when the
 * maths doesn't need one:
 *   "1RM if I do 100 × 5"            → estimated max
 *   "80% of 120"                     → 96 kg (rounded to plates)
 *   "will I bench 100×10 if now 85×8" → compares the two by estimated max
 *   "protein if I weigh 100"         → 160–220 g a day
 *   "17 × 23" / "скільки буде 17 помножити на 23" → 391
 * And the edge of Atlas's world: weather, politics, recipes, films — a line
 * in character and back to training (Gemini may still take it, if on).
 */
import type { Tr } from './intentKit';
import { normalize } from './nlu';
import { dec } from './num';

const NUM = '(\\d+(?:[.,]\\d+)?)';
const num = (s: string) => Number(s.replace(',', '.'));
/** Estimated one-rep max (Epley); 1 rep is itself. */
const epley = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));
const plate = (kg: number) => Math.round(kg / 2.5) * 2.5;

/** "100 на 5", "100x5", "100 kg for 5", "100 кг × 5 разів". */
const SET_RE = new RegExp(
  `${NUM}\\s*(?:кг|kg|kgs|кило)?\\s*(?:на|x|х|×|\\*|by|for|по)\\s*(\\d{1,2})(?:\\s*(?:раз\\S*|повт\\S*|reps?|times))?(?:\\s|$)`,
  'u',
);
const ONE_RM =
  /(1\s?пм|1\s?rm|one rep max|на раз|максимум|max(imum)?|розрахунков\S*|скільки (я )?(пожму|підніму|витисну)|how much (can|could) i)/u;

export function calcAnswer(question: string, L: Tr, kg: (n: number) => string): string | null {
  // Raw text (normalize would drop the maths symbols), lower-cased.
  const ph = ` ${question
    .toLowerCase()
    .replace(/%/g, ' percent ')
    .replace(/[?!,;]/g, ' ')} `
    .replace(/(\d)\s*[xх×*]\s*(\d)/g, '$1 x $2')
    .replace(/\s+/g, ' ');

  // "80% від 120" / "80 percent of 120"
  const pm = new RegExp(`${NUM}\\s*percent\\s*(?:від|of|з|из|от)\\s*${NUM}`, 'u').exec(ph);
  if (pm) {
    const v = (num(pm[1]) * num(pm[2])) / 100;
    return L(
      `${pm[1]}% of ${pm[2]} is ${kg(plate(v))} (exactly ${dec(v, 'en', 2)}).`,
      `${pm[1]}% від ${pm[2]} — це ${kg(plate(v))} (точно ${dec(v, 'uk', 2)}).`,
    );
  }

  // Two sets compared: "пожму 100 на 10, якщо зараз 85 на 8?"
  const sets = [...ph.matchAll(new RegExp(SET_RE.source, 'gu'))];
  // "5x5 or 3x10" is a set × rep scheme, not two weights.
  const schemes = sets.every((m) => num(m[1]) <= 10 && !/кг|kg|кило/u.test(m[0]));
  if (sets.length >= 2 && !schemes) {
    const [a, b] = sets.map((m) => ({
      kg: num(m[1]),
      reps: Number(m[2]),
      e1: epley(num(m[1]), Number(m[2])),
    }));
    const target = a.e1 >= b.e1 ? a : b;
    const now = target === a ? b : a;
    // "0 × 8" (an empty bar / nothing yet) has no max to grow from.
    if (!(now.e1 > 0))
      return L(
        `${target.kg} × ${target.reps} needs ≈ ${kg(Math.round(target.e1))} max — log a real working set and I’ll tell you how far off you are.`,
        `Для ${target.kg} × ${target.reps} треба ≈ ${kg(Math.round(target.e1))} максимуму — запиши робочий сет, і скажу, скільки лишилось.`,
      );
    const gap = Math.round(((target.e1 - now.e1) / now.e1) * 100);
    return L(
      `${now.kg} × ${now.reps} ≈ ${kg(Math.round(now.e1))} max; ${target.kg} × ${target.reps} needs ≈ ${kg(Math.round(target.e1))} — ${gap <= 3 ? "you're basically there" : `about ${gap}% stronger than now, realistic in ${gap <= 10 ? '1–2 months' : gap <= 20 ? '3–5 months' : 'half a year or more'} of steady progress`}.`,
      `${now.kg} × ${now.reps} ≈ ${kg(Math.round(now.e1))} максимуму; для ${target.kg} × ${target.reps} треба ≈ ${kg(Math.round(target.e1))} — ${gap <= 3 ? 'ти майже там' : `це на ~${gap}% сильніше, ніж зараз: реально за ${gap <= 10 ? '1–2 місяці' : gap <= 20 ? '3–5 місяців' : 'пів року й більше'} рівного прогресу`}.`,
    );
  }

  // One set → estimated max: "1ПМ якщо 100 на 5"
  if (sets.length === 1 && ONE_RM.test(ph)) {
    const w = num(sets[0][1]);
    const r = Number(sets[0][2]);
    if (w > 0 && r >= 1 && r <= 20) {
      // Epley; above 10 reps it's a rough guess — said so.
      const e = r === 1 ? w : w * (1 + r / 30);
      const rough = r > 10;
      return L(
        `${w} × ${r} ≈ ${kg(Math.round(e))} for one rep (${rough ? 'very rough above 10 reps — a set of 3–5 gives a truer number' : 'an estimate — the more reps, the rougher it gets'}).`,
        `${w} × ${r} ≈ ${kg(Math.round(e))} на раз (${rough ? 'понад 10 повторів — дуже грубо; сет на 3–5 дасть точніше' : 'оцінка — що більше повторів, то грубіша'}).`,
      );
    }
  }

  // Protein for a bodyweight: "скільки білка якщо я важу 100"
  const bw = /(важу|вага|вешу|weigh|i.?m)\s*(\d{2,3})/u.exec(ph);
  if (bw && /(білк|белк|protein|протеїн)/u.test(ph)) {
    const w = Number(bw[2]);
    if (w >= 35 && w <= 250)
      return L(
        `At ${w} kg: about ${Math.round(w * 1.6)}–${Math.round(w * 2.2)} g of protein a day, split over 3–5 meals.`,
        `При ${w} кг: приблизно ${Math.round(w * 1.6)}–${Math.round(w * 2.2)} г білка на день, на 3–5 прийомів.`,
      );
  }

  // Calories for a bodyweight: "скільки калорій якщо я важу 90"
  const bwk = /(важу|вага|вешу|weigh|i.?m)\s*(\d{2,3})/u.exec(ph);
  if (bwk && /(калор|ккал|calorie|kcal)/u.test(ph)) {
    const w = Number(bwk[2]);
    if (w >= 35 && w <= 250) {
      const lo = Math.round((w * 30) / 50) * 50; // ~30–33 kcal/kg
      const hi = Math.round((w * 33) / 50) * 50;
      return L(
        `At ${w} kg, maintenance is roughly ${lo}–${hi} kcal a day for someone who lifts 3–4× a week. To gain: +200–300; to lose: −300–500. Check the scale for two weeks and adjust.`,
        `При ${w} кг підтримка — приблизно ${lo}–${hi} ккал на день, якщо тренуєшся 3–4 рази на тиждень. На масу: +200–300, на сушку: −300–500. Два тижні дивись на ваги й коригуй.`,
      );
    }
  }

  // Plain arithmetic: "17 помножити на 23", "120 / 4"
  const ar = new RegExp(
    `${NUM}\\s*(помножити на|помножене на|множити на|умножить на|times|multiplied by|x|плюс|plus|\\+|мінус|минус|minus|-|поділити на|разделить на|divided by|/)\\s*${NUM}`,
    'u',
  ).exec(ph);
  if (ar && /(скільки буде|сколько будет|порахуй|посчитай|what.?s|what is|calculate|=)/u.test(ph)) {
    const a = num(ar[1]);
    const b = num(ar[3]);
    const op = ar[2];
    const v = /помнож|множ|умнож|times|multipl|^x$/.test(op)
      ? a * b
      : /плюс|plus|\+/.test(op)
        ? a + b
        : /мінус|минус|minus|-/.test(op)
          ? a - b
          : b
            ? a / b
            : NaN;
    if (Number.isFinite(v)) {
      return L(
        `${dec(v, 'en', 2)}. Numbers I can do — now, anything about your training?`,
        `${dec(v, 'uk', 2)}. Рахувати вмію — а тепер щось про тренування?`,
      );
    }
  }
  return null;
}

/** Clearly not about training (and no training words in it). */
const OFF =
  /(погод\S*|дощ\S*|сніг\S*|прогноз|weather|rain|forecast|президент\S*|політик\S*|вибор\S*|уряд\S*|election\S*|politic\S*|рецепт\S*|борщ\S*|приготувати|зварити|recipe\S*|cook\S*|фільм\S*|серіал\S*|кіно|movie\S*|film\S*|series|netflix|музик\S*|пісн\S*|song\S*|новин\S*|news|курс (долара|євро)|біткоїн\S*|bitcoin|crypto\S*|футбол\S*|хто виграв|who won|гороскоп\S*|horoscope|столиц\S*|capital of|напиши (код|вірш|есе|твір)|write (code|an essay|a poem)|космос\S*|планет\S*|галактик\S*|outer space|planets?\b|galax\S*|відеоігр\S*|комп.?ютерн\S* ігр\S*|video ?games?|playstation|xbox|minecraft|fortnite|dota|сенс життя|meaning of life| president | war | війн\S*|translate |переклад\S*|переклади|переведи|перевести|near me|restaurant\S*|ресторан\S*|pizza place|fix my car|repair my car|car repair|полагод\S* машин\S*|ремонт\S* машин\S*|домашк\S*|філософ\S*|philosoph\S*|релігі\S*|religio\S*|домашн\S* завданн\S*|homework|програмуванн\S*|programming|javascript|python\b|інвестиц\S*|invest(ing|ment)\S*|stock market|фондов\S* ринок|акці(ї|й) компан\S*|історі(я|ю|ї) (україни|світу|росії)|world history)/u;
const FIT =
  /(трен\S*|зал\S*|вправ\S*|білк\S*|біцепс\S*|присід\S*|жим\S*|сет\S*|м.?яз\S*|кардіо|вага|схуд\S*|gym|workout\S*|train\S*|exercise\S*|protein|lift\S*|muscle\S*|squat\S*|bench|cardio|calorie\S*|калор\S*|diet|дієт\S*|спорт\S*|sport\S*)/u;

/** Polish, Lithuanian, Estonian (folded, as normalized messages are). */
const OFF_X =
  /(^| )(pogod\S*|deszcz\S*|wybor\S*|wybory|polityk\S*|prezydent\S*|przepis\S*|ugotowac|serial\S*|piosenk\S*|samochod\S*|naprawic auto|oras|orai|lietus|rinkim\S*|prezident\S*|politik\S*|recept\S*|masinos|masinoje|pataisyti masina|automobil\S*|ilm|ilmateade|vihm\S*|valimis\S*|president\S*|poliitik\S*|retsept\S*|autot|autoga|muusik\S*|mecz\S*|wygrał\S*|wygral\S*|rungtyn\S*|laimejo|voitis|matsi\S*)( |$)/u;
const FIT_X =
  /(trening\S*|silown\S*|cwicz\S*|miesn\S*|bialk\S*|przysiad\S*|treniruot\S*|sporto|raumen\S*|baltym\S*|trenn\S*|treening\S*|jousaal\S*|lihas\S*|valgu\S*)/u;

export function offTopic(question: string): boolean {
  const ph = ` ${normalize(question)} `;
  return (OFF.test(ph) || OFF_X.test(ph)) && !FIT.test(ph) && !FIT_X.test(ph);
}

export function offTopicLine(temper: number, L: Tr): string {
  if (temper <= 1)
    return L(
      "Ha, bro, that's not my thing 😅 I'm all about iron: your training, recovery, progress. Ask me anything about that!",
      'Ха, бро, це не моя тема 😅 Я про залізо: тренування, відновлення, твій прогрес. Питай про це що завгодно!',
    );
  if (temper >= 5)
    return L(
      'Do I look like a search engine? I coach lifting. Ask about your training or go do some.',
      'Я схожий на пошуковик? Я тренер. Питай про тренування — або йди й потренуйся.',
    );
  return L(
    'Not my area — I stick to training, recovery and your numbers. Ask me about those.',
    'Це не до мене — я про тренування, відновлення й твої цифри. Питай про це.',
  );
}
