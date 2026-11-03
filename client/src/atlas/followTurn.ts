/**
 * SPO-35 P11 — follow-ups that only make sense in the context of the last answer:
 *  - after a plan ("what about legs?", "can you add arms?", "how long will each session be?") the answer is read
 *    from the plan itself (compose.ts), not from the topic the words happen to match (k_skip_legs, tempo);
 *  - after a pain check-in ("should I see a doctor?", "how long until it heals?").
 * Kept out of intents.ts (file-size ratchet); called from dataTurn.ts.
 */
import { programAnswer } from './compose';
import type { Frame } from './frame';
import { finishedOf, type AskCtx, type Tr } from './intentKit';
import { setTypeOf } from '../store';
import { normalize } from './nlu';
import { parseRange } from './when';
import { bestPeriod } from './appP17';
import { p20Topic, repsGoal } from './appP20';
import * as N from './num';
import type { Route } from './confidence';

interface FConvo {
  intent?: string;
  frame?: Frame;
}
interface Out<C> {
  route: Route;
  intent: string;
  text: string;
  chips: string[];
  convo: C;
}

/** What each muscle word means in the plan: the exercises that train it (by name). */
const MUSCLES: { re: RegExp; ex: RegExp }[] = [
  {
    re: /(?<!\p{L})(legs?|quads?|ніг\p{L}*|ноги)(?!\p{L})/iu,
    ex: /squat|leg press|lunge|deadlift|hip thrust|glute|calf/i,
  },
  {
    re: /(?<!\p{L})(arms?|biceps?|triceps?|рук\p{L}*|біцепс\p{L}*|трицепс\p{L}*)(?!\p{L})/iu,
    ex: /curl|pushdown|triceps|close-grip|skull|extension/i,
  },
  {
    re: /(?<!\p{L})(chest|груд\p{L}*)(?!\p{L})/iu,
    ex: /bench|fly|push-?up|dip/i,
  },
  {
    re: /(?<!\p{L})(back|спин\p{L}*)(?!\p{L})/iu,
    ex: /row|pull-?up|pullup|pulldown|chin/i,
  },
  {
    re: /(?<!\p{L})(shoulders?|delts?|плеч\p{L}*)(?!\p{L})/iu,
    ex: /press.*(military|shoulder)|military|shoulder press|lateral raise|overhead/i,
  },
  {
    re: /(?<!\p{L})(abs|core|press (muscles)?|прес\p{L}*)(?!\p{L})/iu,
    ex: /plank|crunch|leg raise|ab /i,
  },
];

const ASK_ABOUT_RE =
  /^\s*((and|so|ok(ay)?|but) )?(what about|how about|can you (also )?add|can we add|add|include|more|і що з|а що з|а як щодо|а|додай|додати|можеш додати|а можна додати)(?!\p{L})/iu;
const LENGTH_RE =
  /how long (will|does|is|do) (each|a|the|one|every|these|my)? ?(session|workout|training)s?|how long (is|are) (each|the) (session|workout)|how much time (does|will) (each|a) (session|workout)|скільки (триватиме|триває|буде тривати) (кожне|одне|тренування)|скільки часу (займе|займає) (кожне )?тренування|скільки (хвилин|часу) (на|буде) (кожне )?тренування/iu;
const DOCTOR_RE =
  /(should|do|must|need|worth)\b.*\b(see|visit|go to|ask|consult)\b.*\b(doctor|physio|physiotherapist|gp)\b|(?<!\p{L})(чи )?(варто|треба|потрібно)(?!\p{L}).*(?<!\p{L})(лікар\p{L}*|фізіотерапевт\p{L}*|травматолог\p{L}*)/iu;
const HEAL_RE =
  /how long (until|till|will it take|before)\b.*\b(heal\w*|recover\w*|go away|better|fine|settle)|when (will|does|should) (it|this) (heal|go away|get better|stop|settle)|(?<!\p{L})скільки (часу )?(буде )?(гоїт\p{L}*|проходит\p{L}*|лікуват\p{L}*|відновлюват\p{L}*)|коли (воно )?(пройде|заживе|загоїться)/iu;

/** "Can you help me get stronger?" — a request for help, not the goal statement "I want to get stronger" (that is the goal topic's). */
const STRONGER_RE =
  /^\s*((hey|ok(ay)?|so) )?(can|could|would) you (please )?help me (get|become|be) stronger\b|^\s*help me (get|become|be) stronger\b|^\s*допоможи(ть)? (мені )?(стати|бути) сильніш/iu;

/** "Should I see a doctor?" / "how long until it heals?" asked in or right after a pain check-in. */
export const painFollowUp = (question: string): boolean =>
  DOCTOR_RE.test(question) || HEAL_RE.test(question);

function planLines(text: string): { day: string; kind: string; items: string[] }[] {
  const out: { day: string; kind: string; items: string[] }[] = [];
  for (const line of text.split('\n')) {
    const m =
      /^Day (\d+) — ([^:]+): (.*)$/u.exec(line) ?? /^День (\d+) — ([^:]+): (.*)$/u.exec(line);
    if (!m) continue;
    const items = m[3]
      .replace(/\.$/u, '')
      .split(' · ')
      .map((x) => x.replace(/\s+\d+×.*$/u, '').trim());
    out.push({ day: m[1], kind: m[2], items });
  }
  return out;
}

export function followTurn<C extends FConvo>(
  question: string,
  c: AskCtx,
  convo: C,
  turn: number,
  L: Tr,
): Out<C & { turn: number; q: string }> | null {
  const keep = (intent: string, text: string, chips: string[] = []) => ({
    route: 'ack' as Route,
    intent,
    text,
    chips,
    convo: { ...convo, turn, q: question },
  });
  const rg = repsGoal(question, convo.intent, L);
  if (rg)
    return {
      ...keep('reps', rg.text),
      convo: { ...convo, intent: 'reps_goal', turn, q: question },
    };
  const p20 = p20Topic(question, L);
  if (p20) return keep(p20.intent, p20.text);
  const bp = bestPeriod(question, c, L);
  if (bp) return keep(bp.intent, bp.text);
  const mf = monthFollow(question, c, convo.intent, L);
  if (mf)
    return {
      ...keep(mf.intent, mf.text),
      convo: { ...convo, intent: convo.intent, turn, q: question },
    };
  const ctx = ctxFollow(question, convo.intent, L);
  if (ctx) {
    const o = keep(ctx.intent, ctx.text);
    // The sleep answer is the topic the next question ("will that hurt my gains?") hangs on.
    return ctx.intent === 'sleep_short'
      ? { ...o, convo: { ...o.convo, intent: 'sleep_short' } }
      : o;
  }
  if (STRONGER_RE.test(question))
    return keep(
      'get_stronger',
      L(
        'Yes. Strength comes from heavy basic lifts done often: squat, bench, row, deadlift or press 2–3 times a week, 3–6 reps, add a little weight when every set is clean. Sleep and food do half the work. Tell me which lift to push and I’ll show where you stand in your log.',
        'Так. Сила росте від важких базових вправ, які робиш часто: присід, жим, тяга, станова чи жим стоячи 2–3 рази на тиждень, 3–6 повторів, додавай трохи ваги, коли всі сети чисті. Сон і їжа дають половину результату. Скажи, яку вправу тягнемо, і я покажу, де ти за журналом.',
      ),
    );
  // Anywhere: the pain check-in clears its own state when it hands the turn over, and the answer is safe on its own.
  if (painFollowUp(question)) {
    if (DOCTOR_RE.test(question))
      return keep(
        'pain_doctor',
        L(
          'I’m not a doctor, so take this as a rule of thumb: see one (or a physio) if the pain is sharp, there is swelling, numbness or tingling, it wakes you at night, or it has not eased after 1–2 weeks of leaving the trigger out. Until then, skip what sets it off and train around it.',
          'Я не лікар, тож це лише орієнтир: до лікаря (або фізіотерапевта) — якщо біль різкий, є набряк, оніміння чи поколювання, він будить уночі або не слабшає за 1–2 тижні без тригера. До того прибери вправу, яка його викликає, і тренуйся в обхід.',
        ),
      );
    if (HEAL_RE.test(question))
      return keep(
        'pain_heal',
        L(
          'I can’t give a date — it depends on what it is, and I can’t examine you. A mild overuse ache often settles within a couple of weeks once you stop provoking it; if it is not clearly better after 2 weeks, or it gets worse, get it looked at.',
          'Дати термін не можу — це залежить від того, що саме болить, а оглянути тебе я не можу. Легкий біль від перевантаження часто стихає за кілька тижнів, якщо не провокувати його; якщо за 2 тижні не краще або стає гірше — покажись фахівцю.',
        ),
      );
  }
  if ((convo.intent !== 'plan_build' && convo.intent !== 'plan') || !convo.frame) return null;
  const q = question.toLowerCase();
  if (q.trim().split(/\s+/).length > 9) return null;
  const plan = programAnswer(c, convo.frame, L).text;
  if (LENGTH_RE.test(q)) {
    const mins = /~(\d+) (min|хв)/u.exec(plan)?.[1] ?? '60';
    return keep(
      'plan_length',
      L(
        `About ${mins} minutes each, as the plan is built. For shorter or longer, say “make it 45 minutes” and I’ll rebuild it.`,
        `Близько ${mins} хвилин кожне — так збудований план. Хочеш коротше чи довше — скажи «зроби на 45 хвилин», і я перебудую.`,
      ),
    );
  }
  if (!ASK_ABOUT_RE.test(q)) return null;
  const m = MUSCLES.find((x) => x.re.test(q));
  if (!m) return null;
  const hits = planLines(plan)
    .map((d) => ({ ...d, hit: d.items.filter((i) => m.ex.test(i)) }))
    .filter((d) => d.hit.length);
  if (!hits.length)
    return keep(
      'plan_muscle',
      L(
        'That is not in this plan yet. Tell me what to change — for example “make it 75 minutes” gives each day extra slots — and I’ll rebuild it.',
        'Цього в плані ще нема. Скажи, що змінити — наприклад «зроби на 75 хвилин» дає кожному дню додаткові слоти — і я перебудую.',
      ),
    );
  // One sentence per day: each translates on its own (pl / lt / et), whatever the number of days.
  const where = hits.map((d) => `${L('Day', 'День')} ${d.day}: ${d.hit.slice(0, 2).join(', ')}.`);
  return keep(
    'plan_muscle',
    L(
      `Yes, it is in the plan. ${where.join(' ')} For more, ask for a longer session (“make it 75 minutes”) or name the exercise you want.`,
      `Так, воно є в плані. ${where.join(' ')} Хочеш більше — попроси довше тренування («зроби на 75 хвилин») або назви вправу.`,
    ),
  );
}

/** Questions people ask in the middle of a pain check-in; the check-in stays open. */
const SIDE_CAN_RE =
  /(?<!\p{L})(can|could|may) i (still |even )?(squat|bench|press|deadlift|row|train|lift|work out|exercise|do|use)(?!\p{L})|(?<!\p{L})чи (можна|можу|варто)( мені)? (ще |все ще )?(жати|присідати|тренувати|тягнути|тренуватись|тренуватися|робити|використовувати)(?!\p{L})/iu;
const SIDE_INSTEAD_RE =
  /(?<!\p{L})(what|which)( \w+){0,3} (instead of|in place of|replaces?|to replace)(?!\p{L})|(?<!\p{L})(що|яка вправа|яку вправу) (робити |можна )?(замість|натомість)(?!\p{L})|(?<!\p{L})яка вправа замість(?!\p{L})/iu;
const SIDE_STRETCH_RE =
  /(?<!\p{L})(should|can|do) i (stretch|massage|foam roll|ice|heat)(?!\p{L})|(?<!\p{L})чи (варто|можна|треба) (розтягувати|розтягуватись|розтягнути|масажувати|розминати|прогрівати)(?!\p{L})/iu;

export type PainSide = 'can' | 'instead' | 'stretch';
export function painSide(question: string): PainSide | null {
  if (SIDE_INSTEAD_RE.test(question)) return 'instead';
  if (SIDE_STRETCH_RE.test(question)) return 'stretch';
  if (SIDE_CAN_RE.test(question)) return 'can';
  return null;
}

/** A pain-check side question answered while the check-in stays open (null = not one). */
export function painSideAnswer<F>(q: string, L: Tr, flow: F) {
  const side = painSide(q);
  return side ? { intent: `pain_side_${side}`, text: painSideReply(side, L), flow } : null;
}

export function painSideReply(kind: PainSide, L: Tr): string {
  const tail = L(
    ' Whenever you are ready, answer the last question and we will finish the check-in.',
    ' Коли будеш готовий, дай відповідь на останнє питання — і завершимо перевірку.',
  );
  if (kind === 'can')
    return (
      L(
        'Maybe, in a lighter and pain-free version: if it does not hurt while you do it and is no worse the next day, it is fine. Keep pain at 3/10 or lower. If it is sharp, or hurts during the lift, skip it until it is checked.',
        'Можливо, у полегшеному варіанті без болю: якщо під час вправи не болить і наступного дня не гірше — можна. Тримай біль на 3/10 або нижче. Якщо біль різкий або з’являється під час вправи — пропусти її, доки не оглянуть.',
      ) + tail
    );
  if (kind === 'instead')
    return (
      L(
        'Swap it for a variation that does not hurt: a different angle or grip, a machine or dumbbell version, a shorter range, or another muscle today. In a session, tap the lift and choose Swap.',
        'Заміни на варіант, що не болить: інший кут чи хват, тренажер чи гантелі, коротша амплітуда або інший м’яз сьогодні. У тренуванні тапни вправу й обери «Замінити».',
      ) + tail
    );
  return (
    L(
      'Gentle movement and a light stretch in a comfortable range are fine; do not push into pain or stretch hard. Heat helps stiff muscle, but neither one heals it — easy movement and time do.',
      'Легкий рух і м’яке розтягування в комфортній амплітуді — нормально; не тисни в біль і не тягни різко. Тепло допомагає затиснутим м’язам, але не лікує — це робить легкий рух і час.',
    ) + tail
  );
}

/** Short follow-ups that only make sense after the previous topic (nutrition, sleep). */
const AFTER_RE =
  /^\s*((and|so|а|і) )?(after|after (it|that|training|a workout|the gym)|після( цього| тренування)?)\s*\??\s*$/iu;
const REST_DAYS_RE =
  /(?<!\p{L})(on |for )?rest days?(?!\p{L})|(?<!\p{L})(у |на )?(вихідн\p{L}*|дні відпочинку|дні без тренувань)(?!\p{L})/iu;
const SLEEP_HOURS_RE =
  /(?<!\p{L})(i )?(only )?(sleep|slept|get)( only| about| around| just)? (\d(?:[.,]\d)?) ?(h|hrs?|hours?)(?!\p{L})|(?<!\p{L})я (сплю|спав|спала)( лише| тільки| приблизно)? (\d(?:[.,]\d)?) (год|годин\p{L}*)/iu;
const SLEEP_COST_RE =
  /(?<!\p{L})(will|does|would|is) (that|it|this)( \w+)? (hurt|kill|ruin|affect|hinder|stop)( my)? (gains|progress|muscle|growth|results)|(?<!\p{L})(це|то) (пошкодить|зашкодить|вплине на)( мій)? (ріст|результат|прогрес|м’язи)/iu;
const SLEEP_TRAIN_RE =
  /(?<!\p{L})(should|can|may) i (still )?(train|work ?out|lift|go to the gym)( \w+)? if i (slept|sleep) (badly|poorly|little|bad|not much)|(?<!\p{L})чи (варто|можна)( мені)? тренуватись?( \p{L}+)? якщо (я )?(погано спав|мало спав|не виспався)/iu;

export function ctxFollow(
  question: string,
  intent: string | undefined,
  L: Tr,
): { intent: string; text: string } | null {
  if (intent === 'pre_meal' && AFTER_RE.test(question))
    return {
      intent: 'post_meal',
      text: L(
        'Within a few hours after: 25–40 g protein and some carbs. The “30-minute window” is mostly a myth — the day’s total matters more.',
        'Протягом кількох годин після: 25–40 г білка й трохи вуглеводів. «Вікно 30 хвилин» — здебільшого міф; важливіший підсумок за день.',
      ),
    };
  if ((intent === 'protein' || intent === 'protein_need') && REST_DAYS_RE.test(question))
    return {
      intent: 'protein_rest',
      text: L(
        'Keep protein the same on rest days — that is when the muscle is repaired and built. Calories can sit a little lower if you move less.',
        'У дні відпочинку білок той самий — саме тоді м’язи відновлюються й ростуть. Калорій можна трохи менше, якщо рухаєшся менше.',
      ),
    };
  // Only the bare statement ("i sleep 5 hours"); a longer message carries its own question.
  const m = question.trim().split(/\s+/).length <= 6 ? SLEEP_HOURS_RE.exec(question) : null;
  if (m) {
    const h = Number((m[5] ?? m[9]).replace(',', '.'));
    if (h < 7)
      return {
        intent: 'sleep_short',
        text: L(
          'That is on the short side. Less sleep slows recovery and strength and raises hunger. Aim for 7–9 hours; even an extra hour helps. On a short night train, but keep it easier.',
          'Це замало. Менше сну сповільнює відновлення й силу та підвищує голод. Цілься в 7–9 годин; навіть додаткова година допомагає. Після короткої ночі тренуйся, але легше.',
        ),
      };
    return {
      intent: 'sleep_ok',
      text: L(
        'That is in a good range. Keep the bedtime steady — it matters as much as the hours.',
        'Це хороший діапазон. Тримай стабільний час відбою — він важить стільки ж, скільки години.',
      ),
    };
  }
  if ((intent === 'sleep_short' || intent === 'sleep') && SLEEP_COST_RE.test(question))
    return {
      intent: 'sleep_cost',
      text: L(
        'Yes, regularly short sleep costs you: slower recovery, less strength and more hunger. It is not a disaster for a week, but fix it before you change the programme.',
        'Так, постійно короткий сон коштує: повільніше відновлення, менше сили, більший голод. Тиждень — не катастрофа, але виправ це, перш ніж міняти програму.',
      ),
    };
  if (SLEEP_TRAIN_RE.test(question))
    return {
      intent: 'sleep_train',
      text: L(
        'Yes, but easier: same lifts, fewer sets, leave more reps in reserve. If you feel ill or dizzy, rest instead.',
        'Так, але легше: ті самі вправи, менше підходів, лишай більше повторів у запасі. Якщо почуваєшся хворим чи паморочиться — краще відпочинь.',
      ),
    };
  return null;
}

const MONTH_ONLY_RE =
  /^\s*((and|so|а|і) )?(how about |what about |а що |а як )?(in|during|за|у|в|на) \p{L}+\s*\??\s*$/iu;

/** "and in August?" right after a count for a month: the same count for the other month. */
export function monthFollow(
  question: string,
  c: AskCtx,
  intent: string | undefined,
  L: Tr,
): { intent: string; text: string } | null {
  if ((intent !== 'month' && intent !== 'range_count') || !MONTH_ONLY_RE.test(question))
    return null;
  const r = parseRange(normalize(question), c.now);
  if (!r || !/^(in|since) /u.test(r.label[0])) return null;
  const ws = finishedOf(c).filter((w) => w.startedAt >= r.from && w.startedAt < r.to);
  const sets = ws.reduce(
    (n, w) =>
      n +
      w.exercises.reduce((m, e) => m + e.sets.filter((x) => setTypeOf(x) !== 'warmup').length, 0),
    0,
  );
  const y = new Date(r.from).getFullYear();
  const yr = y === new Date(c.now).getFullYear() ? '' : ` ${y}`;
  const cap = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}`;
  return {
    intent: 'range_count',
    text: L(
      `${cap(r.label[0])}${yr}: ${N.sessions('en', ws.length)}, ${N.workingSets('en', sets)}.`,
      `${cap(r.label[1])}${yr}: ${N.sessions('uk', ws.length)}, ${N.workingSets('uk', sets)}.`,
    ),
  };
}
