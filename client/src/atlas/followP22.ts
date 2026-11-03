/**
 * SPO-35 P22/P23 — follow-ups that hang on the last topic ("how deep", "when did I hit it", "is that more than
 * usual") and questions about a calendar period ("what did I do yesterday", "did I train legs last week").
 * Explicit patterns (the base is at its limit); every number comes from the log.
 */
import { finishedOf, date, type AskCtx, type Tr } from './intentKit';
import * as N from './num';
import { muscleSetsInWorkout, setTopWeight, setTypeOf } from '../store';
import { weekStartOf } from '../weekStart';
import { topHistory } from '../progression';
import { findMuscle, normalize, tokens } from './nlu';
import { parseRange } from './when';
import { calcAnswer } from './calc';
import { solvePlates } from '../plates';

const DAY = 86_400_000;
const SQUAT = /squat/i;
const BENCH = /bench/i;

const DEPTH_RE =
  /^\s*(and )?(how (deep|low)( should i (go|squat))?|на яку глибину|наскільки глибоко)\s*\??\s*$/iu;
const STANCE_RE =
  /^\s*(and )?how (wide|narrow)( should (my|the))? (stance|feet|foot position)( be)?\s*\??\s*$|^\s*(яка|якою) (має бути )?(ширина )?постановк\p{L}*/iu;
const ELBOWS_RE =
  /(?<!\p{L})(should|do|can) (my )?elbows? (flare|tuck|go out|stay)|(?<!\p{L})де тримати лікті|(?<!\p{L})як тримати лікті/iu;
const SETS_WEEK_RE =
  /how many (hard |working )?sets (per|for each|for a|for every) (muscle|body ?part|muscle group) (a|per|each|in a) week|скільки (робочих |важких )?(підходів|сетів) (на|для) (м.яз\p{L}*|групу) (на|за) тиждень/iu;
const YESTERDAY_RE =
  /(?<!\p{L})(what|which) (did|have) i (do|train|lift|log|work on)\b[^?]*\byesterday|(?<!\p{L})did i (train|work ?out|lift|go)\b[^?]*\byesterday|що я (робив|робила|тренував\p{L}*|качав\p{L}*) вчора|чи (я )?тренув\p{L}* вчора/iu;
const MUSCLE_WEEK_RE =
  /(?<!\p{L})did i (train|hit|work)\b.*\b(last|previous) week|(?<!\p{L})чи (я )?(тренув\p{L}*|качав\p{L}*)\b.*\bминулого тижня/iu;
const WHEN_HIT_RE =
  /^\s*(and )?(when|what day|which day) (did i|was it|was that)( hit| set| lift| do| make)?( it| that| this)?\s*\??\s*$|^\s*коли (я )?(його |це )?(поставив|поставила|зробив|зробила)\s*\??\s*$/iu;
/** Standalone: "how much volume vs usual this week". */
const VOLUME_USUAL_RE =
  /(?<!\p{L})(volume|tonnage|обсяг)\p{L}* .*(vs|versus|compared (to|with)|than|проти|порівня\p{L}* з) (usual|normal|average|зазвичай|звичайн\p{L}*)/iu;

const MORE_USUAL_RE =
  /^\s*(and )?is (that|this|it) (more|less|higher|lower|bigger|better|worse) than (usual|normal|average|before|last week)\s*\??\s*$|^\s*це (більше|менше) (ніж )?зазвичай\s*\??\s*$/iu;
const STUCK_RE =
  /^\s*(and )?how long (have|has) (i|it|my \w+|that) been (stuck|stalled|flat|the same|plateau\w*)(\s+for)?\s*\??\s*$|^\s*скільки (вже )?(я )?(застряг|застрягла|не ростe|не росте)/iu;

const SAFE_RE =
  /(?<!\p{L})(what|which)( \w+)? (exercises?|movements?|lifts?|workouts?) (are|is|can i do|would be|do i do)( \w+)? (safe|ok|okay|fine)|(?<!\p{L})які вправи (безпечні|можна|не нашкодять)/iu;
const HOW_LONG_RE =
  /(?<!\p{L})how long (will|would|does) (it|this|that) (take|last)|(?<!\p{L})скільки (це )?(триватиме|займе|буде тривати)/iu;
const BRACE_RE =
  /(?<!\p{L})(do|should|would) i need (a |an )?(brace|sleeve|support|strap|tape|wrap)|(?<!\p{L})чи (потрібен|треба) (мені )?(бандаж|фіксатор|напульсник|еластичн\p{L}*)/iu;
const RETURN_RE =
  /(?<!\p{L})when can i (go back|return|get back|start|begin|resume)|(?<!\p{L})коли (я )?(можу|можна) (повернутись|повернутися|знову|почати)/iu;

/** Questions a person asks around a pain check-in: safe exercises, how long, a brace, when to return. */
export function painMore(question: string, L: Tr): { intent: string; text: string } | null {
  if (SAFE_RE.test(question))
    return {
      intent: 'pain_safe',
      text: L(
        'Anything that does not hurt during or after it: skip the painful movement and range, use lighter loads, machines or another muscle group. Keep pain at 3/10 or lower.',
        'Усе, що не болить ні під час, ні після: пропусти болючий рух і амплітуду, візьми легшу вагу, тренажер або інший м’яз. Тримай біль на 3/10 або нижче.',
      ),
    };
  if (HOW_LONG_RE.test(question))
    return {
      intent: 'pain_long',
      text: L(
        'It depends on the cause and I cannot diagnose it. Train around it for 1–2 weeks; if it is not clearly better by then, or it gets worse, see a doctor or a physio.',
        'Залежить від причини, а діагностувати я не можу. Потренуйся в обхід болю 1–2 тижні; якщо за цей час не краще або стає гірше — до лікаря чи фізіотерапевта.',
      ),
    };
  if (BRACE_RE.test(question))
    return {
      intent: 'pain_brace',
      text: L(
        'A brace or sleeve can feel comfortable, but it does not treat the cause. Do not use it to train through sharp pain.',
        'Бандаж чи фіксатор може давати комфорт, але причину не лікує. Не використовуй його, щоб тренуватись через різкий біль.',
      ),
    };
  if (RETURN_RE.test(question))
    return {
      intent: 'pain_return',
      text: L(
        'Once it is pain-free in daily life, restart at about half the old weight and add 10–20% a week if it stays quiet the next morning.',
        'Коли в повсякденному житті не болить, повертайся з половини колишньої ваги й додавай 10–20% на тиждень, якщо наступного ранку тихо.',
      ),
    };
  return null;
}

const LOSE_MUSCLE_RE = /^\s*(and )?will i (lose|burn) (muscle|my gains|strength)\s*\??\s*$/iu;
const CUT_INTENTS = new Set([
  'fat_loss',
  'calories',
  'cut_deficit',
  'cardio',
  'cardio_gains',
  'k_maintenance',
]);
const CONVERT_PLATES_RE =
  /^\s*(convert|calculate|work out|переведи|порахуй)\s+(\d+(?:[.,]\d+)?)\s*(kg|кг|lbs?|фунт\p{L}*)(?!\p{L})[^?]*\s(and|then|і|та)\s+(tell me|show me|give me|what(?!\p{L})|how(?!\p{L})|скажи|покажи)[^?]*(?<!\p{L})(plates?|млинц\p{L}*|блин\p{L}*)/iu;
const STUCK_INTENTS = new Set(['progress_lift', 'plateau', 'stall', 'stalled']);
const HIT_INTENTS = new Set(['best', 'heaviest', 'e1rm', 'range_lift', 'progress_lift']);
const VOLUME_INTENTS = new Set(['log_query', 'tonnage', 'week', 'range_summary']);

function tonnage(c: AskCtx, from: number, to: number): number {
  let t = 0;
  for (const w of finishedOf(c))
    if (w.startedAt >= from && w.startedAt < to)
      for (const e of w.exercises)
        for (const s of e.sets)
          if (setTypeOf(s) !== 'warmup' && s.reps) t += setTopWeight(s) * s.reps;
  return Math.round(t);
}

export function p22Follow(
  question: string,
  c: AskCtx,
  convo: { intent?: string; exercise?: string | null },
  L: Tr,
): { intent: string; text: string } | null {
  const ex = convo.exercise ?? '';
  if (convo.intent?.startsWith('pain')) {
    const pm = painMore(question, L);
    if (pm) return pm;
  }
  if (DEPTH_RE.test(question) && SQUAT.test(ex))
    return {
      intent: 'squat_depth',
      text: L(
        'Hips at least to knee height is the standard; deeper is fine if your back stays flat and your heels stay down. Go only as deep as you can control.',
        'Стандарт — стегна щонайменше до рівня колін; глибше можна, якщо спина лишається рівною, а п’яти не відриваються. Йди лише настільки глибоко, наскільки контролюєш.',
      ),
    };
  if (STANCE_RE.test(question) && SQUAT.test(ex))
    return {
      intent: 'squat_stance',
      text: L(
        'About shoulder-width with the toes turned slightly out; a bit wider if your hips feel pinched. The knees follow the toes.',
        'Приблизно на ширині плечей, носки трохи врозтіч; трохи ширше, якщо стегна «защемляє». Коліна йдуть за носками.',
      ),
    };
  if (ELBOWS_RE.test(question) && BENCH.test(ex))
    return {
      intent: 'bench_elbows',
      text: L(
        'Not straight out at 90°: tuck them to about 45° from the body so the shoulders stay happy. Film from the front to check.',
        'Не під 90° убік: тримай лікті приблизно під 45° до тулуба, щоб плечі почувалися добре. Зніми збоку чи спереду й перевір.',
      ),
    };
  if (CUT_INTENTS.has(convo.intent ?? '') && LOSE_MUSCLE_RE.test(question))
    return {
      intent: 'cut_muscle',
      text: L(
        'Not if you keep lifting heavy, eat enough protein and keep the deficit moderate. Most of what you lose should be fat.',
        'Ні, якщо тренуєшся важко, їси достатньо білка й тримаєш помірний дефіцит. Більшість того, що йде, має бути жиром.',
      ),
    };
  const cp = CONVERT_PLATES_RE.exec(question);
  if (cp) {
    const conv = calcAnswer(question.replace(/\s(and|then|і|та)\s.*$/iu, ''), L, (n) =>
      c.fmt.kg(n),
    );
    const load = /^(kg|кг)$/iu.test(cp[3]) ? Number(cp[2].replace(',', '.')) : null;
    if (conv && load && load >= 20 && load <= 500) {
      const sol = solvePlates(load, { barKg: 20, unit: 'kg' });
      const per = sol.perSide.length ? sol.perSide.join(' + ') : '—';
      return {
        intent: 'calc',
        text: `${conv} ${L(
          `On a 20 kg bar: per side ${per}${sol.exact ? '' : ` (closest: ${c.fmt.kg(sol.achievedKg)})`}.`,
          `На грифі 20 кг: з кожного боку ${per}${sol.exact ? '' : ` (найближче: ${c.fmt.kg(sol.achievedKg)})`}.`,
        )}`,
      };
    }
  }
  if (SETS_WEEK_RE.test(question))
    return {
      intent: 'sets_per_muscle',
      text: L(
        'Most muscles do well on about 8–14 hard sets a week, split over two sessions. Beginners need fewer; add sets only when progress stalls.',
        'Більшості м’язів вистачає приблизно 8–14 важких підходів на тиждень, розбитих на два тренування. Новачкам треба менше; додавай підходи лише коли прогрес стоїть.',
      ),
    };
  if (YESTERDAY_RE.test(question)) {
    const ws = finishedOf(c).filter((w) => N.calendarDays(w.startedAt, c.now) === 1);
    if (ws.length) {
      const names = [...new Set(ws.flatMap((w) => w.exercises.map((e) => c.fmt.exercise(e.name))))];
      const sets = ws.reduce(
        (n, w) =>
          n +
          w.exercises.reduce(
            (m, e) => m + e.sets.filter((s) => setTypeOf(s) !== 'warmup').length,
            0,
          ),
        0,
      );
      return {
        intent: 'last_session',
        text: L(
          `Yesterday: ${N.workingSets('en', sets)} — ${names.join(', ')}.`,
          `Вчора: ${N.workingSets('uk', sets)} — ${names.join(', ')}.`,
        ),
      };
    }
    const last = finishedOf(c)[0];
    return {
      intent: 'last_session',
      text: last
        ? L(
            `Nothing logged yesterday. Your last session was ${N.daysAgoOf(c, N.calendarDays(last.startedAt, c.now))} (${date(c, last.startedAt)}).`,
            `Учора нічого не записано. Останнє тренування — ${N.daysAgoOf(c, N.calendarDays(last.startedAt, c.now))} (${date(c, last.startedAt)}).`,
          )
        : L('Nothing logged yesterday.', 'Учора нічого не записано.'),
    };
  }
  if (MUSCLE_WEEK_RE.test(question)) {
    const m = findMuscle(tokens(question), normalize(question));
    const r = parseRange(normalize(question), c.now);
    if (m && r) {
      const hits = finishedOf(c).filter(
        (w) =>
          w.startedAt >= r.from && w.startedAt < r.to && (muscleSetsInWorkout(w).get(m) ?? 0) > 0,
      );
      const sets = Math.round(hits.reduce((n, w) => n + (muscleSetsInWorkout(w).get(m) ?? 0), 0));
      const mu = c.fmt.muscle(m);
      return {
        intent: 'muscle_in_range',
        text: hits.length
          ? L(
              `Yes — ${mu}, ${r.label[0]}: ${N.sessions('en', hits.length)}, ${N.sets('en', sets)}.`,
              `Так — ${mu}, ${r.label[1]}: ${N.sessions('uk', hits.length)}, ${N.sets('uk', sets)}.`,
            )
          : L(
              `No — nothing for ${mu}, ${r.label[0]}.`,
              `Ні — ${mu}, ${r.label[1]}: у журналі нічого.`,
            ),
      };
    }
  }
  if (ex && HIT_INTENTS.has(convo.intent ?? '') && WHEN_HIT_RE.test(question)) {
    const pts = topHistory(finishedOf(c), ex).filter((p) => p.weight != null);
    const max = Math.max(...pts.map((p) => p.weight as number));
    const at = pts.filter((p) => p.weight === max).sort((a, b) => b.ts - a.ts)[0];
    if (at)
      return {
        intent: 'best_when',
        text: L(
          `${c.fmt.exercise(ex)}: heaviest set — ${c.fmt.kg(max)} × ${at.reps}, ${N.daysAgoOf(c, N.calendarDays(at.ts, c.now))} (${date(c, at.ts)}).`,
          `${c.fmt.exercise(ex)}: найважчий сет — ${c.fmt.kg(max)} × ${at.reps}, ${N.daysAgoOf(c, N.calendarDays(at.ts, c.now))} (${date(c, at.ts)}).`,
        ),
      };
  }
  if (
    (VOLUME_INTENTS.has(convo.intent ?? '') && MORE_USUAL_RE.test(question)) ||
    VOLUME_USUAL_RE.test(question)
  ) {
    const start = weekStartOf(c.now);
    const now = tonnage(c, start, c.now + 1);
    const before = tonnage(c, start - 28 * DAY, start) / 4;
    if (before > 0) {
      const pct = Math.round(((now - before) / before) * 100);
      const s = (n: number) => c.fmt.kg(n);
      const sign = pct > 0 ? `+${pct}` : `${pct}`;
      return {
        intent: 'volume_vs_usual',
        text: L(
          `This week so far: ${s(now)}, against ~${s(Math.round(before))} a week over the previous 4 weeks (${sign}%). The week is not over yet.`,
          `Цей тиждень поки що: ${s(now)}, проти ~${s(Math.round(before))} на тиждень за попередні 4 тижні (${sign}%). Тиждень ще не скінчився.`,
        ),
      };
    }
  }
  if (ex && STUCK_INTENTS.has(convo.intent ?? '') && STUCK_RE.test(question)) {
    const pts = topHistory(finishedOf(c), ex).filter((p) => p.weight != null);
    if (pts.length) {
      const max = Math.max(...pts.map((p) => p.weight as number));
      const first = pts.filter((p) => p.weight === max).sort((a, b) => a.ts - b.ts)[0];
      const weeks = Math.floor((c.now - first.ts) / (7 * DAY));
      return {
        intent: 'stuck_for',
        text:
          weeks >= 2
            ? L(
                `${c.fmt.exercise(ex)}: your top weight, ${c.fmt.kg(max)}, was first reached ${weeks} weeks ago and has not gone up since.`,
                `${c.fmt.exercise(ex)}: твоя робоча вага ${c.fmt.kg(max)} вперше була ${weeks} тиж. тому і відтоді не зросла.`,
              )
            : L(
                `${c.fmt.exercise(ex)}: your top weight went up recently, so it is not really stuck yet.`,
                `${c.fmt.exercise(ex)}: твоя робоча вага зросла нещодавно, тож це ще не застій.`,
              ),
      };
    }
  }
  return null;
}

/** The conversation state after a flow turn; a pain turn leaves its intent so "do I need a brace?" has something to hang on. */
export function flowConvo<F extends { kind: string; lift?: string | null }>(
  r: { intent: string; flow?: F | null },
  turn: number,
  exercise: string | null | undefined,
  softUntil: number | undefined,
) {
  return {
    turn,
    flow: r.flow ?? undefined,
    intent: r.intent.startsWith('pain') ? r.intent : undefined,
    exercise: r.flow?.kind === 'pain' ? (r.flow.lift ?? null) : exercise,
    softUntil,
  };
}

const FASTEST_RE =
  /^\s*(що|яка вправа|який рух) ((найбільше|найшвидше) (росте|прогресує|зростає)|(росте|прогресує|зростає) (найбільше|найшвидше))\s*\??\s*$/iu;
const STALLING_RE =
  /^\s*(що|яка вправа|який рух) (застрягло|застрягла|стоїть на місці|не росте)\s*\??\s*$/iu;

/** Wordings the data reader misses, said the way it reads them ("що найбільше росте" = "which lift is improving fastest"). */
const REWRITES: [RegExp, string][] = [
  [
    /^\s*(give|make|write) me (a |an )?(push[ /-]pull[ /-]legs|ppl)( \w+)? (plan|programme|program|routine)\s*\.?\s*$/iu,
    'build me a push pull legs program',
  ],
  [
    /^\s*як (зв.язатись|зв.язатися|звʼязатись|звʼязатися) з тренером\s*\??\s*$/iu,
    'як підключити тренера',
  ],
  [
    /^\s*how (do|can) i (set|start|use) (a |the |my )?rest ?timer\s*\??\s*$/iu,
    'how do i change the rest timer',
  ],
  [/^\s*how (do|can) i back ?up my data\s*\??\s*$/iu, 'how do i export my data'],
  [/^\s*(wat|what)s? (is )?a gud split\s*\??\s*$/iu, 'what is a good split'],
  [/^\s*(shud|should) i do cardo\s*\??\s*$/iu, 'should i do cardio'],
  [/^\s*як швидко росте м.яз\p{L}*\s*\??\s*$/iu, 'how fast does muscle grow'],
];

export function canonQuestion(question: string): string {
  for (const [re, to] of REWRITES) if (re.test(question)) return to;
  if (FASTEST_RE.test(question)) return 'which lift is improving fastest';
  if (STALLING_RE.test(question)) return 'which is stalling';
  return question;
}
