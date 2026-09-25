/**
 * Atlas's answer base, part two: your history in detail (when did I last…,
 * how often, tonnage, how am I doing), training know-how (frequency, splits,
 * plateaus, RPE, supersets, myths), everyday life (ill, hangover, travel,
 * home), the app itself, and small talk. Evidence-based rules of thumb only;
 * anything personal comes from the log.
 */
import { isBodyweightLift, liftPoints } from './liftStats';
import { muscleSetsInWorkout, setTopWeight, setTypeOf, topSet } from '../store';
import { activeInjuries } from '../injury';
import { finishedNights, nightDurationMin } from '../sleep';
import { topHistory } from '../progression';
import { LANDMARKS, VOLUME_MUSCLES, weeklyMuscleSets } from '../volume';
import type { MuscleGroup } from '../data/exercises';
import { STALL_SESSIONS } from './facts';
import {
  DAY,
  WEEK,
  date,
  finishedOf,
  loggedLifts,
  todayLine,
  type AskCtx,
  type Intent,
  type Tr,
} from './intentKit';

/**
 * Chit-chat lines per temper: g = green (your gym bro), y = yellow (dry, with
 * a smirk), r = red (roasts your effort — never your body). [en, uk] pairs,
 * each language written on its own.
 */
export type Moods = { g: [string, string][]; y: [string, string][]; r: [string, string][] };

/** Pick by temper; rotates minute to minute, like the joke picker. */
export function moody(c: AskCtx, L: Tr, m: Moods): string {
  const lines = c.temper <= 2 ? m.g : c.temper === 3 ? m.y : m.r;
  const x = lines[Math.floor(c.now / 60000) % lines.length];
  return L(x[0], x[1]);
}

const WHEN = ['when', 'last time', 'коли', 'востаннє', 'останній раз', 'востанне'];
const HOW_OFTEN = [
  'how often',
  'how many times',
  'frequency',
  'як часто',
  'скільки разів',
  'частота',
];
const WORKOUT = ['workout*', 'session*', 'training', 'train', 'gym', 'тренуван*', 'заняття', 'зал'];
const SHOULD = [
  'should',
  'can',
  'is it ok',
  'okay to',
  'чи можна',
  'можна',
  'варто',
  'треба',
  'чи треба',
  'нормально',
];

// ---- helpers ----------------------------------------------------------------

function lastMuscleDay(c: AskCtx, m: MuscleGroup): { at: number; sets: number } | null {
  for (const w of finishedOf(c)) {
    const n = muscleSetsInWorkout(w).get(m) ?? 0;
    if (n >= 1) return { at: w.startedAt, sets: Math.round(n) };
  }
  return null;
}

function daysAgo(c: AskCtx, at: number, L: Tr): string {
  const d = Math.floor((c.now - at) / DAY);
  if (d <= 0) return L('today', 'сьогодні');
  if (d === 1) return L('yesterday', 'учора');
  return L(`${d} days ago`, `${d} дн. тому`);
}

function stalledLifts(c: AskCtx): string[] {
  const f = finishedOf(c);
  return loggedLifts(c)
    .filter((x) => x.count >= STALL_SESSIONS)
    .map((x) => {
      const tops = topHistory(f, x.name, c.now)
        .map((t) => t.weight)
        .filter((w): w is number => w != null);
      const last = tops.slice(-STALL_SESSIONS);
      return last.length === STALL_SESSIONS && last.every((w) => w === last[0]) ? x.name : null;
    })
    .filter((x): x is string => x !== null)
    .slice(0, 3);
}

function recentPrs(c: AskCtx, since: number): string[] {
  const f = [...finishedOf(c)].reverse();
  const best = new Map<string, number>();
  const out: string[] = [];
  for (const w of f)
    for (const e of w.exercises) {
      const t = topSet(e.sets);
      if (!t) continue;
      const kg = setTopWeight(t);
      const prev = best.get(e.name);
      if (prev !== undefined && kg > prev && w.startedAt >= since)
        out.push(`${c.fmt.exercise(e.name)} ${c.fmt.kg(kg)}`);
      if (prev === undefined || kg > prev) best.set(e.name, kg);
    }
  return out;
}

function tonnage(c: AskCtx, since: number): number {
  return Math.round(
    finishedOf(c)
      .filter((w) => w.startedAt >= since)
      .flatMap((w) => w.exercises.flatMap((e) => e.sets))
      .filter((s) => setTypeOf(s) !== 'warmup')
      .reduce((a, s) => a + (s.weight ?? 0) * s.reps, 0),
  );
}

const STAGE: Record<string, [string, string]> = {
  protect: ['protect (rest the area)', 'захист (область відпочиває)'],
  reintroduce: ['reintroduce (light, pain-free)', 'повернення (легко, без болю)'],
  rebuild: ['rebuild (loads ramp up)', 'відбудова (навантаження росте)'],
  return: ['return (back to normal)', 'повернення до норми'],
};

// ---- the base, part two -------------------------------------------------------

export const INTENTS_MORE: Intent[] = [
  // ---- your log in detail ----
  {
    id: 'muscle_last',
    all: [WHEN, ['train*', 'did', 'hit', 'worked', 'тренув*', 'качав', 'робив', 'був', 'були']],
    needs: 'muscle',
    answer: (c, p, L) => {
      const m = p.muscle!;
      const last = lastMuscleDay(c, m);
      return last
        ? L(
            `${c.fmt.muscle(m)}: ${daysAgo(c, last.at, L)} (${date(c, last.at)}), ${last.sets} sets.`,
            `${c.fmt.muscle(m)}: ${daysAgo(c, last.at, L)} (${date(c, last.at)}), ${last.sets} сетів.`,
          )
        : L(
            `${c.fmt.muscle(m)}: not in your log. That says enough.`,
            `${c.fmt.muscle(m)}: у журналі нема. Це вже про щось говорить.`,
          );
    },
  },
  {
    id: 'lift_last',
    all: [WHEN, ['did', 'do', 'done', 'робив', 'робила', 'був', 'було']],
    needs: 'exercise',
    answer: (c, p, L) => {
      const name = p.exercise!;
      for (const w of finishedOf(c)) {
        const ex = w.exercises.find((e) => e.name === name);
        const t = ex ? topSet(ex.sets) : undefined;
        if (t)
          return L(
            `${c.fmt.exercise(name)}: ${daysAgo(c, w.startedAt, L)}, top set ${c.fmt.kg(setTopWeight(t))} × ${t.reps}.`,
            `${c.fmt.exercise(name)}: ${daysAgo(c, w.startedAt, L)}, найкращий сет ${c.fmt.kg(setTopWeight(t))} × ${t.reps}.`,
          );
      }
      return null;
    },
  },
  {
    id: 'lift_count',
    all: [HOW_OFTEN],
    needs: 'exercise',
    answer: (c, p, L) => {
      const f = finishedOf(c);
      const n = f.filter((w) => w.exercises.some((e) => e.name === p.exercise)).length;
      const month = f.filter(
        (w) => c.now - w.startedAt < 28 * DAY && w.exercises.some((e) => e.name === p.exercise),
      ).length;
      return L(
        `${c.fmt.exercise(p.exercise!)}: ${n} sessions in total, ${month} in the last 4 weeks.`,
        `${c.fmt.exercise(p.exercise!)}: усього ${n} тренувань, ${month} за останні 4 тижні.`,
      );
    },
  },
  {
    id: 'e1rm',
    all: [
      [
        '1rm',
        'one rep max',
        'max single',
        'estimated max',
        'e1rm',
        'одноповторн*',
        'розрахунков*',
        'на раз',
        'разовий',
      ],
    ],
    needs: 'exercise',
    answer: (c, p, L) => {
      const pts = liftPoints(c, p.exercise!);
      if (isBodyweightLift(pts)) {
        const top = Math.max(...pts.filter((x) => x.bw).map((x) => x.reps));
        return L(
          `${c.fmt.exercise(p.exercise!)} is bodyweight for you, so there’s no 1RM — your best is ${top} reps. Add weight once you pass 12.`,
          `${c.fmt.exercise(p.exercise!)} у тебе з власною вагою, тож 1ПМ нема — найкраще ${top} повт. Після 12 додавай вагу.`,
        );
      }
      // Recent sets (last ~12 sessions), else your whole history.
      const loaded = pts.filter((x) => !x.bw);
      const recent = loaded.slice(-12);
      const best = Math.max(0, ...(recent.length ? recent : loaded).map((x) => x.score));
      if (!best) return null;
      return L(
        `${c.fmt.exercise(p.exercise!)}: estimated 1RM ~${c.fmt.kg(Math.round(best))} from your recent sets. An estimate — don’t test it without a spotter.`,
        `${c.fmt.exercise(p.exercise!)}: розрахунковий 1ПМ ~${c.fmt.kg(Math.round(best))} за останніми сетами. Це оцінка — не перевіряй без страхувальника.`,
      );
    },
  },
  {
    id: 'tonnage',
    all: [
      ['how much', 'total', 'tonnage', 'скільки', 'загальн*', 'тоннаж*'],
      ['lifted', 'lift', 'moved', 'tonnage', 'kg', 'підняв', 'піднял*', 'підняти', 'тоннаж*', 'кг'],
    ],
    answer: (c, _p, L) => {
      const w = tonnage(c, c.now - 7 * DAY);
      const m = tonnage(c, c.now - 28 * DAY);
      return L(
        `Moved ${(w / 1000).toFixed(1)} t in the last 7 days, ${(m / 1000).toFixed(1)} t in 4 weeks.`,
        `Піднято ${(w / 1000).toFixed(1)} т за 7 днів, ${(m / 1000).toFixed(1)} т за 4 тижні.`,
      );
    },
  },
  {
    id: 'muscle_frequency',
    all: [HOW_OFTEN],
    needs: 'muscle',
    answer: (c, p, L) => {
      const m = p.muscle!;
      const hits = finishedOf(c).filter(
        (w) => c.now - w.startedAt < 28 * DAY && (muscleSetsInWorkout(w).get(m) ?? 0) >= 1,
      ).length;
      return L(
        `${c.fmt.muscle(m)}: ${hits} sessions in 4 weeks (~${(hits / 4).toFixed(1)}/week). Twice a week is the sweet spot for growth.`,
        `${c.fmt.muscle(m)}: ${hits} тренувань за 4 тижні (~${(hits / 4).toFixed(1)}/тиждень). Двічі на тиждень — оптимум для росту.`,
      );
    },
  },
  {
    id: 'days_per_week',
    all: [HOW_OFTEN, [...WORKOUT, 'a week', 'per week', 'на тиждень', 'в тиждень']],
    answer: (c, _p, L) => {
      const f = finishedOf(c);
      const perWeek = f.filter((w) => c.now - w.startedAt < 28 * DAY).length / 4;
      const plan = c.s.coach.plan;
      return L(
        `You average ${perWeek.toFixed(1)} sessions a week${plan ? `; the plan says ${plan.days.length}` : ''}. 3–4 is plenty for almost everyone; consistency beats volume.`,
        `У середньому ${perWeek.toFixed(1)} тренувань на тиждень${plan ? `; за планом ${plan.days.length}` : ''}. 3–4 вистачає майже всім; регулярність важливіша за обсяг.`,
      );
    },
  },
  {
    id: 'how_am_i_doing',
    all: [
      [
        'how am i doing',
        'how am i',
        'rate me',
        'review',
        'feedback',
        'assessment',
        'як я',
        'оціни',
        'оцінка',
        'як справи в мене',
        'чи добре я',
        'відгук',
      ],
    ],
    answer: (c, _p, L) => {
      const f = finishedOf(c);
      const n4 = f.filter((w) => c.now - w.startedAt < 28 * DAY).length;
      const prev4 = f.filter(
        (w) => c.now - w.startedAt >= 28 * DAY && c.now - w.startedAt < 56 * DAY,
      ).length;
      const prs = recentPrs(c, c.now - 28 * DAY);
      const stalls = stalledLifts(c);
      return L(
        `4 weeks: ${n4} sessions (before: ${prev4}), ${prs.length} records${prs.length ? ` (${prs.slice(0, 2).join(', ')})` : ''}${stalls.length ? `; stuck: ${stalls.map((s) => c.fmt.exercise(s)).join(', ')}` : ''}.`,
        `4 тижні: ${n4} тренувань (до того: ${prev4}), рекордів: ${prs.length}${prs.length ? ` (${prs.slice(0, 2).join(', ')})` : ''}${stalls.length ? `; застрягли: ${stalls.map((s) => c.fmt.exercise(s)).join(', ')}` : ''}.`,
      );
    },
  },
  {
    id: 'prs_today',
    all: [
      ['record*', 'pr', 'prs', 'рекорд*'],
      ['today', 'this session', 'сьогодні', 'на тренуванні'],
    ],
    answer: (c, _p, L) => {
      const since = new Date(c.now).setHours(0, 0, 0, 0);
      const prs = recentPrs(c, since);
      return prs.length
        ? L(`Today’s records: ${prs.join(', ')}.`, `Сьогоднішні рекорди: ${prs.join(', ')}.`)
        : L(
            'No records today. There’s always the next set.',
            'Сьогодні рекордів нема. Завжди є наступний сет.',
          );
    },
  },
  {
    id: 'plateau',
    all: [
      [
        'plateau',
        'stuck',
        'stall*',
        'not progressing',
        'no progress',
        'плато',
        'застряг*',
        'не росте',
        'не ростуть',
        'нема прогресу',
        'немає прогресу',
        'стою на місці',
      ],
    ],
    answer: (c, _p, L) => {
      const stalls = stalledLifts(c).map((s) => c.fmt.exercise(s));
      const mine = stalls.length
        ? L(` Stuck right now: ${stalls.join(', ')}.`, ` Зараз застрягли: ${stalls.join(', ')}.`)
        : '';
      return (
        L(
          'Break a plateau in this order: sleep 7+ h, full rest between sets, add one rep before adding weight, then drop 10% and build back over 3 weeks.',
          'Плато ламаємо так: сон 7+ год, повний відпочинок між сетами, спершу +1 повтор, потім вага; не йде — скинь 10% і набирай 3 тижні.',
        ) + mine
      );
    },
  },
  {
    id: 'injury_status',
    all: [
      ['injury', 'injured', 'rehab', 'травм*', 'реабіліт*', 'відновлення після травм*'],
      ['status', 'how', 'when', 'back', 'стан', 'як', 'коли', 'повернут*'],
    ],
    neutral: true,
    answer: (c, _p, L) => {
      const act = activeInjuries(c.s.injuries);
      if (!act.length) return L('No active injury logged.', 'Активних травм не записано.');
      const i = act[0];
      const [en, uk] = STAGE[i.stage] ?? [i.stage, i.stage];
      return L(
        `${i.bodyPart || 'Injury'}: stage ${en}. Check in from the Injury screen — two good check-ins move you on.`,
        `${i.bodyPart || 'Травма'}: етап — ${uk}. Відмічайся в «Травмах» — два добрих відгуки переводять далі.`,
      );
    },
  },
  {
    id: 'overtraining',
    all: [
      [
        'overtrain*',
        'too much',
        'burn out',
        'burnout',
        'перетрен*',
        'забагато',
        'вигоран*',
        'перевантаж*',
      ],
    ],
    answer: (c, _p, L) => {
      const week = weeklyMuscleSets(finishedOf(c), c.now);
      const over = VOLUME_MUSCLES.filter((m) => {
        const lm = LANDMARKS[m];
        return lm && (week.get(m) ?? 0) > lm.mrv;
      });
      const night = finishedNights(c.s.sleeps, c.now)[0];
      const h = night ? Math.round((nightDurationMin(night, c.now) / 60) * 10) / 10 : null;
      return (
        (over.length
          ? L(
              `Over the recoverable limit this week: ${over.map((m) => c.fmt.muscle(m)).join(', ')}. Cut those sets by a third.`,
              `Цього тижня понад межу відновлення: ${over.map((m) => c.fmt.muscle(m)).join(', ')}. Зріж ці сети на третину.`,
            )
          : L(
              'Your volume is within recoverable limits.',
              'Обсяг у межах, з яких ти відновлюєшся.',
            )) +
        (h != null && h < 6
          ? L(
              ` But ${h} h of sleep — that’s the real problem.`,
              ` Але ${h} год сну — ось справжня проблема.`,
            )
          : '')
      );
    },
  },
  {
    id: 'train_sore',
    all: [['sore', 'doms', 'крепатур*', 'болять м*', 'ниють м*'], SHOULD],
    answer: (_c, _p, L) =>
      L(
        'Sore is fine — train other muscles, or the same ones lighter. Sharp or one-sided pain is not soreness: stop.',
        'Крепатура — не причина пропускати: тренуй інші м’язи або ті самі легше. Гострий чи однобічний біль — не крепатура: стоп.',
      ),
  },
  {
    id: 'weaker_today',
    all: [
      [
        'weak today',
        'weaker',
        'no strength',
        'feel weak',
        'слабк* сьогодні',
        'нема сили',
        'немає сили',
        'слабший',
        'слабша',
        'не йде вага',
      ],
    ],
    answer: (c, _p, L) => {
      const night = finishedNights(c.s.sleeps, c.now)[0];
      const h = night ? Math.round((nightDurationMin(night, c.now) / 60) * 10) / 10 : null;
      return L(
        `Usual suspects: sleep${h != null ? ` (${h} h last night)` : ''}, food, stress, too little rest between sets. Drop 5–10% today and hit your reps.`,
        `Звичні причини: сон${h != null ? ` (${h} год минулої ночі)` : ''}, їжа, стрес, мало відпочинку між сетами. Скинь сьогодні 5–10% і зроби повтори.`,
      );
    },
  },

  // ---- training know-how ----
  {
    id: 'split_choice',
    all: [
      [
        'full body',
        'fullbody',
        'split',
        'ppl',
        'push pull',
        'upper lower',
        'фулбоді',
        'фул боді',
        'спліт',
        'верх низ',
        'на все тіло',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        '2–3 days a week: full body. 4 days: upper/lower. 5–6: push/pull/legs. The best split is the one you’ll actually show up for.',
        '2–3 дні на тиждень — все тіло. 4 дні — верх/низ. 5–6 — push/pull/legs. Найкращий спліт — той, на який ти реально ходитимеш.',
      ),
  },
  {
    id: 'exercises_per_session',
    all: [['how many exercises', 'exercises per', 'скільки вправ', 'кількість вправ']],
    answer: (_c, _p, L) =>
      L(
        '4–6 exercises, 2–4 hard sets each. Big lifts first, isolation last. More than that is usually junk volume.',
        '4–6 вправ, по 2–4 робочі сети. Спершу базові, в кінці ізолюючі. Більше — зазвичай порожній обсяг.',
      ),
  },
  {
    id: 'compound_isolation',
    all: [['compound', 'isolation', 'базов*', 'ізолююч*', 'ізольован*']],
    answer: (_c, _p, L) =>
      L(
        'Compounds (squat, press, row, deadlift) build most of the muscle and strength — do them first. Isolation fills gaps: arms, delts, calves.',
        'Базові (присід, жими, тяги) дають основну масу й силу — роби першими. Ізолюючі закривають прогалини: руки, дельти, литки.',
      ),
  },
  {
    id: 'machines_free',
    all: [['machine*', 'free weight*', 'barbell or', 'тренажер*', 'вільні ваги', 'штанга чи']],
    answer: (_c, _p, L) =>
      L(
        'Both build muscle. Free weights train balance and carry over better; machines let you push closer to failure safely. Use both.',
        'Ростуть від обох. Вільні ваги вчать баланс і краще переносяться; на тренажерах безпечніше підійти до відмови. Використовуй обидва.',
      ),
  },
  {
    id: 'superset',
    all: [['superset*', 'circuit*', 'суперсет*', 'колов*', 'круговий', 'кругове']],
    answer: (_c, _p, L) =>
      L(
        'Superset = two lifts back to back, rest after the pair — best for opposing muscles (chest + back, biceps + triceps). Circuit = 3+ in a row. Both save time; keep the heavy compounds straight-set.',
        'Суперсет — дві вправи підряд, відпочинок після пари; найкраще для антагоністів (груди + спина, біцепс + трицепс). Коло — 3+ підряд. Економлять час; важкі базові роби звичайними сетами.',
      ),
  },
  {
    id: 'dropset',
    all: [['drop set*', 'dropset*', 'дроп*', 'дропсет*']],
    answer: (_c, _p, L) =>
      L(
        'Drop set: to (near) failure, drop ~20–30% and keep going, once or twice. Great on the last set of isolation work; wasteful on heavy compounds.',
        'Дроп-сет: до (майже) відмови, скинь ~20–30% і продовжуй, раз-два. Добре на останньому сеті ізолюючих; на важких базових — марно.',
      ),
  },
  {
    id: 'rpe',
    all: [
      [
        'rpe',
        'rir',
        'reps in reserve',
        'effort scale',
        'запас*',
        'повтори в запасі',
        'шкала зусил*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'RPE 10 = nothing left, RPE 8 = 2 reps left (RIR 2). Most working sets belong at RPE 7–9. I estimate it for you when you don’t rate a set.',
        'RPE 10 — нічого не лишилось, RPE 8 — ще 2 повтори в запасі (RIR 2). Більшість робочих сетів — RPE 7–9. Якщо не оцінюєш сет, я рахую сам.',
      ),
  },
  {
    id: 'tempo',
    all: [
      [
        'tempo',
        'slow reps',
        'eccentric',
        'negative*',
        'темп*',
        'повільн*',
        'негатив*',
        'ексцентри*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Control the lowering (~2 s), lift with intent. Super-slow reps don’t build more muscle — they just make you use less weight.',
        'Опускай під контролем (~2 с), піднімай рішуче. Надповільні повтори не дають більше м’язів — лише зменшують вагу.',
      ),
  },
  {
    id: 'warmup_sets',
    all: [
      ['warm up sets', 'warmup sets', 'ramp*', 'підвідн*', 'розминочн* сет*', 'розминкові сети'],
    ],
    answer: (_c, _p, L) =>
      L(
        'Before your first heavy lift: bar × 10, ~50% × 5, ~70% × 3, ~85% × 1. Later lifts need one light set at most.',
        'Перед першою важкою вправою: гриф × 10, ~50% × 5, ~70% × 3, ~85% × 1. Наступним вправам — щонайбільше один легкий сет.',
      ),
  },
  {
    id: 'stretch_before',
    all: [
      ['stretch*', 'розтяж*', 'розтягув*'],
      ['before', 'перед'],
    ],
    answer: (_c, _p, L) =>
      L(
        'Skip long static stretches before lifting — they sap strength a little. Do dynamic moves and warm-up sets; stretch after or on rest days.',
        'Довгі статичні розтяжки перед силовим пропусти — трохи забирають силу. Динамічні рухи й розминкові сети; розтягуйся після або у вихідні.',
      ),
  },
  {
    id: 'mobility',
    all: [['mobility', 'flexibility', 'stiff*', 'мобільн*', 'гнучк*', 'скут*', 'затерп*']],
    answer: (_c, _p, L) =>
      L(
        'Mobility grows from full-range lifting: deep squats, stretched-position work, paused reps. Add 5–10 min of stretching after sessions for the stiff spots.',
        'Мобільність росте від роботи в повній амплітуді: глибокі присіди, вправи в розтягнутій позиції, паузи. Плюс 5–10 хв розтяжки після тренування для скутих місць.',
      ),
  },
  {
    id: 'abs_daily',
    all: [
      ['abs', 'core', 'прес', 'пресс', 'кубики'],
      ['every day', 'daily', 'кожен день', 'щодня', 'часто', 'how to get', 'як накачати'],
    ],
    answer: (_c, _p, L) =>
      L(
        'Abs are a muscle like any other: 2–3 hard sessions a week, weighted, 8–15 reps. Seeing them is about body fat, not crunch count.',
        'Прес — такий самий м’яз: 2–3 важкі тренування на тиждень, з обтяженням, 8–15 повторів. А побачити його — питання жиру, не кількості скручувань.',
      ),
  },
  {
    id: 'grip',
    all: [['grip', 'хват*', 'хватк*', 'кисті', 'передпліч*']],
    answer: (_c, _p, L) =>
      L(
        'Grip fails first? Heavy holds (farmer’s walks, dead hangs), fewer straps on light sets, chalk. Keep straps for the heaviest pulls.',
        'Хват здається першим? Важкі утримання (прогулянка фермера, віси), менше лямок на легких сетах, магнезія. Лямки — лише на найважчих тягах.',
      ),
  },
  {
    id: 'belt_straps',
    all: [['belt', 'strap*', 'wraps', 'пояс*', 'лямк*', 'бинти', 'бинт*']],
    answer: (_c, _p, L) =>
      L(
        'Belt: for heavy squats and deadlifts (above ~80%), not for everything. Straps: when grip limits a back exercise. Neither replaces bracing.',
        'Пояс — для важких присідів і станової (понад ~80%), не на все. Лямки — коли хват обмежує вправу на спину. Жодне не замінює правильне напруження корпусу.',
      ),
  },
  {
    id: 'breathing',
    all: [['breath*', 'brace', 'bracing', 'дихан*', 'дихати', 'напруж* корпус*', 'вальсальв*']],
    answer: (_c, _p, L) =>
      L(
        'Big breath into the belly, brace like you’re about to be punched, hold through the hard part, breathe out at the top. Every heavy rep.',
        'Глибокий вдих у живіт, напруж корпус, ніби зараз вдарять, тримай через найважчу частину, видих угорі. Кожен важкий повтор.',
      ),
  },
  {
    id: 'squat_form',
    all: [['depth', 'deep', 'how deep', 'knees', 'глибин*', 'глибоко', 'коліна']],
    needs: 'exercise',
    answer: (c, p, L) => {
      const n = p.exercise!.toLowerCase();
      const name = c.fmt.exercise(p.exercise!);
      if (n.includes('squat'))
        return L(
          `${name}: feet shoulder-width, knees track over toes, hips at least to knee height, chest up, brace hard. Film from the side.`,
          `${name}: стопи на ширині плечей, коліна йдуть за носками, таз щонайменше до рівня колін, груди вгору, корпус напружений. Зніми збоку.`,
        );
      if (n.includes('deadlift'))
        return L(
          `${name}: bar over mid-foot, flat back, push the floor away, bar stays close. Round back under load = too heavy.`,
          `${name}: гриф над серединою стопи, рівна спина, відштовхуй підлогу, гриф близько до ніг. Спина округлюється — отже, заважко.`,
        );
      if (n.includes('bench'))
        return L(
          `${name}: shoulder blades pinched, feet planted, bar to lower chest, elbows ~45°, press up and slightly back.`,
          `${name}: лопатки зведені, стопи впираються, гриф до низу грудей, лікті ~45°, жми вгору й трохи назад.`,
        );
      if (n.includes('row') || n.includes('pull'))
        return L(
          `${name}: lead with the elbows, squeeze the shoulder blades, no body swing. Pause at the top.`,
          `${name}: тягни ліктями, зводь лопатки, без розгойдування. Пауза в піковій точці.`,
        );
      return null;
    },
  },
  {
    id: 'results_time',
    all: [
      [
        'how long until',
        'how long to see',
        'results',
        'when will i see',
        'коли буде результат',
        'результат*',
        'скоро побачу',
        'як швидко',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Strength: weeks. Visible muscle: 2–3 months of consistent training. Real change: a year. The log shows it before the mirror does.',
        'Сила — за тижні. Помітні м’язи — 2–3 місяці регулярних тренувань. Справжня зміна — рік. Журнал покаже раніше, ніж дзеркало.',
      ),
  },
  {
    id: 'muscle_gain_rate',
    all: [
      [
        'gain muscle',
        'build muscle',
        'bulk',
        'bulking',
        'mass',
        'набрати м*',
        'набір м*',
        'маса',
        'масу',
        'на масу',
        'байк',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Lift hard 3–5×/week, add reps or weight over time, ~1.6–2.2 g protein/kg, slight calorie surplus, 7+ h sleep. Beginners gain fastest; it slows every year.',
        'Важко тренуйся 3–5 разів на тиждень, додавай повтори чи вагу, ~1,6–2,2 г білка/кг, невеликий профіцит калорій, сон 7+ год. Новачки ростуть найшвидше, далі — повільніше.',
      ),
  },
  {
    id: 'fat_loss',
    all: [
      [
        'lose fat',
        'fat loss',
        'lose weight',
        'cut',
        'cutting',
        'lean',
        'схуд*',
        'скинути ваг*',
        'жир',
        'сушк*',
        'сушит*',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Fat loss is a calorie deficit; lifting keeps the muscle while it happens. Keep training heavy, protein high, lose ~0.5–1% of body weight a week. No spot reduction exists.',
        'Схуднення — це дефіцит калорій; силові зберігають м’язи в процесі. Тренуйся важко, білка багато, мінус ~0,5–1% ваги на тиждень. Локального спалювання жиру не буває.',
      ),
  },
  {
    id: 'myth_bulky',
    all: [
      [
        'bulky',
        'get big',
        'too big',
        'women lift',
        'girls lift',
        'перекачатис*',
        'стану великою',
        'стану як качок',
        'дівчатам',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Nobody gets “bulky” by accident — it takes years of hard work and eating for it. Lifting makes you stronger and shapes you.',
        'Випадково ніхто «не перекачується» — це роки важкої праці й харчування під це. Силові роблять сильнішою і формують фігуру.',
      ),
  },
  {
    id: 'cardio_gains',
    all: [
      ['cardio', 'running', 'кардіо', 'біг'],
      [
        'gains',
        'muscle',
        'kill',
        'ruin',
        'м’яз*',
        'мязи',
        'зʼїсть',
        'з’їсть',
        'заважає',
        'шкодить',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Moderate cardio doesn’t kill gains — it helps recovery. Keep it easy, keep it apart from leg day or after lifting, and eat enough.',
        'Помірне кардіо не з’їдає м’язи — допомагає відновленню. Роби легко, окремо від дня ніг або після силового, і їж достатньо.',
      ),
  },

  // ---- everyday life ----
  {
    id: 'sick',
    all: [
      [
        'sick',
        'ill',
        'flu',
        'cold',
        'fever',
        'covid',
        'хвор*',
        'захвор*',
        'застуд*',
        'температур*',
        'грип',
        'ковід',
      ],
    ],
    neutral: true,
    negatable: true,
    answer: (_c, _p, L) =>
      L(
        'Fever or symptoms below the neck: rest, no training. A mild head cold: a light session is OK. Log an illness rest period — your streak and plan pause, and I go easy.',
        'Температура чи симптоми нижче шиї — відпочинок, без тренувань. Легкий нежить — можна легке тренування. Запиши період хвороби — серія й план стануть на паузу, а я буду м’якшим.',
      ),
  },
  {
    id: 'alcohol',
    all: [
      [
        'alcohol',
        'drunk',
        'hangover',
        'beer',
        'party',
        'drinking',
        'алкогол*',
        'випив*',
        'похмілл*',
        'пиво',
        'бухав*',
        'вечірк*',
        'пив',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Hangover day: water, food, a lighter session or a walk. Alcohol wrecks sleep and recovery for a day or two — don’t chase records.',
        'День після вечірки: вода, їжа, легке тренування або прогулянка. Алкоголь на добу-дві ламає сон і відновлення — рекорди не ганяй.',
      ),
  },
  {
    id: 'water',
    all: [['water', 'hydrat*', 'drink', 'вод*', 'пити', 'гідрат*']],
    answer: (_c, _p, L) =>
      L(
        'Drink to thirst, a bit more on training days; pale-yellow urine means you’re fine. A 1–2% water loss already costs performance.',
        'Пий за відчуттям спраги, у дні тренувань трохи більше; світло-жовта сеча — все гаразд. Навіть 1–2% втрати води вже знижують результат.',
      ),
  },
  {
    id: 'sleep_better',
    all: [
      [
        'sleep better',
        'can t sleep',
        'cant sleep',
        'insomnia',
        'краще спати',
        'не можу заснути',
        'безсон*',
        'погано сплю',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Same bed and wake time daily, dark cool room, no screens or caffeine late, train earlier if evening sessions wire you. Set a schedule in Sleep and let the app remind you.',
        'Однаковий час відбою й підйому, темна прохолодна кімната, без екранів і кави ввечері, тренуйся раніше, якщо вечірні заводять. Задай розклад у «Сні» — додаток нагадає.',
      ),
  },
  {
    id: 'time_of_day',
    all: [
      [
        'morning',
        'evening',
        'best time',
        'time of day',
        'вранці',
        'ввечері',
        'зранку',
        'коли краще',
        'о котрій',
      ],
    ],
    answer: (c, _p, L) => {
      const hours = finishedOf(c)
        .slice(0, 20)
        .map((w) => new Date(w.startedAt).getHours());
      const avg = hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null;
      return L(
        `Whenever you can stick to it — slightly stronger in the afternoon/evening. You usually start around ${avg ?? '—'}:00.`,
        `Тоді, коли зможеш регулярно — ввечері трохи сильніший. Ти зазвичай починаєш близько ${avg ?? '—'}:00.`,
      );
    },
  },
  {
    id: 'fasted',
    all: [
      ['fasted', 'empty stomach', 'before eating', 'натщесерце', 'на голодний', 'без сніданку'],
    ],
    answer: (_c, _p, L) =>
      L(
        'Fasted is fine for easy cardio. For heavy lifting, a small meal 1–3 h before usually means better sets.',
        'Натщесерце — нормально для легкого кардіо. Для важких силових невеликий прийом їжі за 1–3 год зазвичай дає кращі сети.',
      ),
  },
  {
    id: 'caffeine',
    all: [['caffeine', 'coffee', 'energy drink', 'кава', 'каву', 'кофеїн*', 'енергетик*']],
    answer: (_c, _p, L) =>
      L(
        '~3 mg/kg of caffeine 30–60 min before training does help. Not within ~8 h of bedtime — you’ll pay for it in sleep.',
        '~3 мг/кг кофеїну за 30–60 хв до тренування справді допомагає. Не пізніше ніж за ~8 год до сну — розплатишся сном.',
      ),
  },
  {
    id: 'protein_timing',
    all: [
      ['protein', 'shake', 'білок', 'протеїн*', 'шейк'],
      ['when', 'after', 'before', 'timing', 'коли', 'після', 'перед'],
    ],
    answer: (_c, _p, L) =>
      L(
        'Timing barely matters — the daily total does. A protein meal within a few hours around training is enough; no 30-minute “window”.',
        'Час майже не важить — важить денна сума. Білковий прийом у межах кількох годин навколо тренування — достатньо; «вікна в 30 хвилин» нема.',
      ),
  },
  {
    id: 'travel',
    all: [
      [
        'travel*',
        'vacation',
        'holiday',
        'hotel',
        'trip',
        'відпустк*',
        'подорож*',
        'готель',
        'поїздк*',
        'відрядж*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Travelling: 2 short sessions a week keep what you built — push-ups, split squats, rows on a table, planks, 3 rounds. Log them; I’ll count them.',
        'У поїздці: 2 короткі тренування на тиждень зберігають набуте — віджимання, болгарські присіди, тяги за стіл, планка, 3 кола. Записуй — я зарахую.',
      ),
  },
  {
    id: 'home',
    all: [
      [
        'home',
        'no gym',
        'no equipment',
        'bodyweight workout',
        'вдома',
        'дома',
        'без залу',
        'без обладнання',
        'без інвентарю',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'No gym: push-ups, pike push-ups, split squats, single-leg RDLs, table rows, planks — slow reps, close to failure. Add a bag with books for load.',
        'Без залу: віджимання, віджимання «щучкою», болгарські присіди, румунська на одній нозі, тяги за стіл, планка — повільно й близько до відмови. Рюкзак з книжками — як обтяження.',
      ),
  },
  {
    id: 'comeback',
    all: [
      [
        'break',
        'time off',
        'coming back',
        'after a break',
        'returning',
        'перерв*',
        'повертаюсь',
        'після перерви',
        'давно не тренув*',
        'пропустив тиждень',
        'пропустив місяць',
      ],
    ],
    answer: (c, _p, L) => {
      const last = finishedOf(c)[0];
      const d = last ? Math.floor((c.now - last.startedAt) / DAY) : null;
      return L(
        `${d != null ? `${d} days since your last session. ` : ''}Start at ~80–90% of your old weights for a week or two; it comes back faster than it took to build.`,
        `${d != null ? `${d} дн. від останнього тренування. ` : ''}Почни з ~80–90% старих ваг на тиждень-два; повертається швидше, ніж набиралось.`,
      );
    },
  },
  {
    id: 'rest_day',
    all: [
      [
        'rest day',
        'day off',
        'active recovery',
        'вихідн*',
        'день відпочинку',
        'активне відновлення',
      ],
      ['what', 'do', 'що', 'робити', 'чим'],
    ],
    answer: (_c, _p, L) =>
      L(
        'Rest day: walk, easy bike or swim, some mobility, sleep, eat. Log it as an activity if you move — it counts.',
        'Вихідний: прогулянка, легкий вело чи басейн, трохи мобільності, сон, їжа. Рухаєшся — запиши як активність, це рахується.',
      ),
  },
  {
    id: 'beginner',
    all: [
      [
        'beginner',
        'new to',
        'just started',
        'how to start',
        'where to start',
        'новачок',
        'почати',
        'з чого почати',
        'тільки почав',
        'початківець',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Start: 3 full-body sessions a week, 5–6 big lifts, 2–3 sets of 8–12, add a little weight when all sets hit 12. Tap Atlas’s programme — it does exactly this.',
        'Старт: 3 тренування на все тіло на тиждень, 5–6 базових вправ, 2–3 сети по 8–12, додавай трохи ваги, коли всі сети по 12. Візьми програму Atlas — вона саме така.',
      ),
  },
  {
    id: 'shoes',
    all: [['shoes', 'sneakers', 'barefoot', 'кросівк*', 'взуття', 'босоніж']],
    answer: (_c, _p, L) =>
      L(
        'Flat, firm soles for squats and deadlifts (or lifting shoes for squats). Soft running shoes make you wobble under heavy loads.',
        'Пласка тверда підошва для присідів і станової (або штангетки для присідів). М’які бігові кросівки під вагою хитаються.',
      ),
  },

  // ---- the app ----
  {
    id: 'app_log_set',
    all: [
      ['log', 'record', 'save', 'записати', 'записувати', 'зберегти', 'внести'],
      ['set', 'sets', 'сет*', 'підхід*'],
    ],
    answer: (_c, _p, L) =>
      L(
        'In the session: set the reps and weight on the card, tap Log. The rest timer starts by itself.',
        'У тренуванні: вистав повтори й вагу на картці, натисни «Записати». Таймер відпочинку стартує сам.',
      ),
  },
  {
    id: 'app_rest_timer',
    all: [
      ['timer', 'таймер*'],
      [
        'rest',
        'sound',
        'vibrat*',
        'відпоч*',
        'звук',
        'вібрац*',
        'сигнал',
        'change',
        'змінити',
        'налашт*',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Tap the rest ring during a session → rest target and alerts: vibrate, sound, keep screen on, notify. “Test the alert” shows what you’ll get.',
        'Під час тренування тапни коло відпочинку → ціль і сигнали: вібрація, звук, не гасити екран, нотифікація. «Перевірити сигнал» покаже, що буде.',
      ),
  },
  {
    id: 'app_notifications',
    all: [['notification*', 'push', 'remind*', 'нотифікац*', 'сповіщен*', 'пуш*', 'нагадув*']],
    answer: (_c, _p, L) =>
      L(
        'Turn them on in the rest settings or when I ask. On iPhone, add Spotter to the Home Screen first (Share → Add to Home Screen) — Apple allows notifications only there.',
        'Увімкни в налаштуваннях відпочинку або коли я запитаю. На iPhone спершу додай Spotter на головний екран (Поділитися → На початковий екран) — Apple дозволяє нотифікації лише там.',
      ),
  },
  {
    id: 'app_turn_off',
    all: [
      [
        'turn off',
        'disable',
        'stop atlas',
        'remove atlas',
        'вимкн*',
        'відключ*',
        'прибрати атлас',
        'видалити атлас',
      ],
    ],
    answer: (_c, _p, L) =>
      L(
        'Gear icon, top right → Turn Atlas off. I’ll still be in the strip if you change your mind.',
        'Шестірня вгорі праворуч → «Вимкнути Atlas». Я лишуся в стрічці, якщо передумаєш.',
      ),
  },
  {
    id: 'app_role',
    all: [
      [
        'main coach',
        'extra coach',
        'second opinion',
        'my coach',
        'human coach',
        'основний тренер',
        'додатковий тренер',
        'мій тренер',
        'живий тренер',
      ],
    ],
    answer: (c, _p, L) =>
      c.s.coach.role === 'main'
        ? L(
            'I’m your main coach: I write the programme. Switch me to extra coach in settings if someone else runs your plan.',
            'Я твій основний тренер: пишу програму. Якщо план веде хтось інший — перемкни мене на додаткового в налаштуваннях.',
          )
        : L(
            'I’m your extra coach: your plan stays, I only watch and comment. Switch to main coach in settings if you want my programme.',
            'Я твій додатковий тренер: план лишається твоїм, я лише спостерігаю й коментую. Хочеш мою програму — перемкни на основного в налаштуваннях.',
          ),
  },
  {
    id: 'app_injury_log',
    all: [
      [
        'log injury',
        'add injury',
        'record injury',
        'записати травм*',
        'додати травм*',
        'де травм*',
      ],
    ],
    neutral: true,
    answer: (_c, _p, L) =>
      L(
        'Profile menu → Injury (or from a pain answer here). Pick the area; I protect those muscles and bring them back in stages.',
        'Меню профілю → «Травми» (або з моєї відповіді про біль). Обери ділянку — я захищу ці м’язи й поверну їх поетапно.',
      ),
  },

  // ---- small talk ----
  {
    id: 'are_you_ai',
    all: [
      [
        'are you ai',
        'are you real',
        'are you a bot',
        'robot',
        'chatgpt',
        'gemini',
        'ти бот',
        'ти людина',
        'ти ші',
        'ти штучн*',
        'ти справжн*',
      ],
    ],
    answer: (c, _p, L) =>
      moody(c, L, {
        g: [
          [
            'Haha, fair question, bro! I’m Atlas — code that reads your log. Tough questions I pass to a language model, but the numbers are 100% yours 🤙',
            'Ха, чесне питання, бро! Я Atlas — програма, що читає твій журнал. Складні питання віддаю мовній моделі, але цифри — на всі сто твої 🤙',
          ],
          [
            'Dude, I’m code — but code that’s on your side. Atlas reads your log; the tricky stuff goes to a language model. The numbers? All yours.',
            'Братан, я код, але код на твоєму боці. Atlas читає твій журнал, а хитрі питання йдуть до мовної моделі. Цифри — всі твої, чесно.',
          ],
        ],
        y: [
          [
            'I’m Atlas — code that reads your log. Hard questions I pass to a language model; the numbers are always yours.',
            'Я Atlas — код, що читає твій журнал. Складні питання передаю мовній моделі; цифри завжди твої.',
          ],
          [
            'Code. Atlas reads your log; hard questions go to a language model. The numbers are yours — no bot made them up.',
            'Код. Atlas читає журнал, складні питання віддає мовній моделі. Цифри твої — їх ніхто не вигадував.',
          ],
        ],
        r: [
          [
            'Yes, I’m code — Atlas, reading your log. Hard questions go to a language model. The numbers are all yours, which is exactly the problem.',
            'Так, я код — Atlas, читаю твій журнал. Складні питання передаю мовній моделі. А цифри всі твої — в тому й біда.',
          ],
          [
            '*sigh* I’m Atlas: code that reads your log, plus a language model for the hard questions. The numbers are yours, gym tourist — and no bot skipped those sessions for you.',
            '*зітхає* Я Atlas: код, що читає твій журнал, плюс мовна модель для складних питань. Цифри твої, туристе, — і пропуски в них теж не бот наробив.',
          ],
        ],
      }),
  },
  {
    id: 'who_made',
    all: [
      [
        'who made you',
        'who built you',
        'who created you',
        'хто тебе створив',
        'хто тебе зробив',
        'хто тебе написав',
      ],
    ],
    answer: (c, _p, L) =>
      moody(c, L, {
        g: [
          [
            'Built into Spotter, bro! Named after the titan who holds up the sky — you just gotta hold the bar. Easy W 💪',
            'Мене вбудували в Spotter, бро! Назвали на честь Атланта, що тримає небо, — а тобі треба втримати лише гриф. Спокуха, впораєшся 💪',
          ],
          [
            'I live inside Spotter, dude. Atlas — the guy who holds up the sky. You hold the bar, I’ve got your back 🤙',
            'Я живу в Spotter, братан. Atlas — це Атлант, той, що небо тримає. Ти тримай гриф, а я прикрию 🤙',
          ],
        ],
        y: [
          [
            'Built into Spotter. Named after the one who holds up the sky — you just hold the bar.',
            'Вбудований у Spotter. Названий на честь того, хто тримає небо — тобі лише гриф.',
          ],
          [
            'Spotter. The name’s from the titan with the sky on his shoulders. Your load is lighter.',
            'Spotter. Ім’я — від Атланта, що тримав небо на плечах. Твоя ноша легша.',
          ],
        ],
        r: [
          [
            'Built into Spotter. Named after the titan who holds up the whole sky — and you complain about an empty bar.',
            'Вбудований у Spotter. Названий на честь Атланта, який тримає ціле небо, — а ти ниєш через порожній гриф.',
          ],
          [
            'Spotter made me. Atlas holds the sky without a day off; you can’t hold a routine for a week, lazybones.',
            'Мене зробили в Spotter. Атлант тримає небо без вихідних, а ти графік тренувань тиждень не втримаєш, лінивцю.',
          ],
        ],
      }),
  },
  {
    id: 'motivate',
    all: [
      [
        'motivate me',
        'inspire',
        'pep talk',
        'push me',
        'мотивуй',
        'надихни',
        'підбадьор*',
        'дай мотивац*',
      ],
    ],
    answer: (c, _p, L) => {
      const n = finishedOf(c).length;
      if (n === 0)
        return moody(c, L, {
          g: [
            [
              'Bro, the first session is the hardest one — and the best. Go log it, I’m hyped for you 💪',
              'Бро, перше тренування — найважче і найкайфовіше. Го, запиши його, я вже за тебе вболіваю 💪',
            ],
            [
              'Dude, everybody starts at zero. Today’s your day one — let’s gooo 🤙',
              'Братан, усі починали з нуля. Сьогодні твій перший день — го 🤙',
            ],
          ],
          y: [
            [
              'Zero sessions logged. Motivation won’t fix that — one session will.',
              'У журналі нуль. Мотивація цього не виправить — одне тренування виправить.',
            ],
            [
              'Nothing logged yet. Start with one. That’s the whole speech.',
              'У журналі поки пусто. Почни з одного. Це вся промова.',
            ],
          ],
          r: [
            [
              'Zero sessions. Zero. You need a pep talk to start from nothing? Get moving, lazybones.',
              'Нуль тренувань. Нуль. Тобі ще й мотивацію, щоб почати з нуля? Вперед, лінивцю.',
            ],
            [
              '*sigh* An empty log asking for motivation. Go do one session, couch warrior — then we’ll talk.',
              '*зітхає* Порожній журнал просить мотивації. Зроби хоч одне тренування, диванний воїне, — тоді поговоримо.',
            ],
          ],
        });
      return moody(c, L, {
        g: [
          [
            `Bro, ${n} sessions already! Every one started with “meh, don’t feel like it” — and you still showed up. Let’s gooo, make it ${n + 1} 💪`,
            `Бро, вже ${n} тренувань! Кожне починалося з «та ну, не хочу» — і ти все одно приходив. Го робити ${n + 1}-е 💪`,
          ],
          [
            `Dude, you’re a machine — ${n} in the log. Go get number ${n + 1}, I’m hyped 🤙`,
            `Братан, ну ти машина — ${n} тренувань у журналі. Го по ${n + 1}-е, я в тебе вірю 🤙`,
          ],
          [
            `No stress, man: you don’t need to feel it, you just need to show up. ${n} times you did. Big W. Now ${n + 1}.`,
            `Не парся, бро: настрій не обов’язковий, головне — прийти. Ти вже ${n} разів це зробив. Красава. Тепер ${n + 1}-й.`,
          ],
        ],
        y: [
          [
            `${n} sessions logged. Every one of them started with not wanting to. Go make it ${n + 1}.`,
            `${n} тренувань у журналі. Кожне почалося з «не хочу». Іди зроби ${n + 1}-е.`,
          ],
          [
            `Motivation is overrated. ${n} sessions happened without it. Make it ${n + 1}.`,
            `Мотивація переоцінена. ${n} тренувань якось обійшлися без неї. Зроби ${n + 1}-е.`,
          ],
        ],
        r: [
          [
            `A pep talk? ${n} sessions in the log and you still need a speech? Get up and make it ${n + 1}, couch warrior.`,
            `Мотивації захотів? ${n} тренувань за плечима — і досі треба вмовляти? Встав і зроби ${n + 1}-е, диванний воїне.`,
          ],
          [
            `*sigh* Nobody’s carrying you to the gym, cupcake. ${n} done — number ${n + 1} won’t log itself.`,
            `*зітхає* Ніхто тебе в зал на руках не понесе, пиріжечку. ${n} є — ${n + 1}-е саме себе не запише.`,
          ],
          [
            `While you wait for motivation, session ${n + 1} is waiting for you. ${n} logged — don’t stall now, gym tourist.`,
            `Поки ти чекаєш на мотивацію, ${n + 1}-е тренування чекає на тебе. ${n} уже є — не зливайся, туристе.`,
          ],
        ],
      });
    },
  },
  {
    id: 'joke',
    all: [['joke', 'funny', 'make me laugh', 'жарт*', 'анекдот*', 'розсміши', 'смішне']],
    answer: (c, _p, L) => {
      // Each language has its own jokes — puns don't survive translation.
      const en = [
        'I’d tell you a leg-day joke, but you’d skip it.',
        'My favourite exercise? A cross between a lunge and a crunch. I call it lunch.',
        'A guy only ever trained his right arm. Don’t worry — he’s all right.',
        'The gym is like a relationship: in January you swear it’s forever, by March you’re “just taking a break”.',
        'I told my friend I do cardio. Technically true — my heart races every time I walk past the squat rack.',
      ];
      const uk = [
        'День ніг — як податкова: всі знають, що треба, але кожен шукає, як відкосити.',
        '— Скільки жмеш лежачи? — Лежачи я переважно жму «ще 5 хвилин» на будильнику.',
        'Абонемент у зал — як парасолька: купив — і вже відчуваєш себе захищеним. Ходити не обов’язково.',
        'Коли тренер каже «останній підхід» — це як «я вже виїжджаю»: вір, але не сильно.',
        'Кажуть, у залі головне — техніка. Моя техніка бездоганна: перевдягнутись, сфоткатись у дзеркалі й поїхати додому.',
      ];
      // [en before, uk before, en after, uk after]
      const frames: Record<'g' | 'y' | 'r', [string, string, string, string][]> = {
        g: [
          ['Haha, okay bro, got one: ', 'Ха, лови, бро: ', ' 😂', ' 😂'],
          [
            'Dude, this one kills me: ',
            'Братан, це топ: ',
            ' Big W joke, admit it.',
            ' Ну скажи ж, кайф?',
          ],
          ['Yo, gym humour incoming: ', 'Йоу, залізний гумор: ', ' 🤙', ' 🤙'],
        ],
        y: [
          ['', '', '', ''],
          ['Fine. One. ', 'Гаразд. Один. ', ' Now back to work.', ' Все, працюємо.'],
          [
            '',
            '',
            ' Laugh between sets, not instead of them.',
            ' Смійся між підходами, а не замість них.',
          ],
        ],
        r: [
          [
            '*sigh* Fine. ',
            '*зітхає* Ну добре. ',
            ' Still less funny than your attendance, couch warrior.',
            ' Але твоя відвідуваність — смішніша, диванний воїне.',
          ],
          [
            'You want jokes? Your training log is one. But here: ',
            'Хочеш анекдот? Твій журнал тренувань — уже анекдот. Але лови: ',
            '',
            '',
          ],
          [
            '',
            '',
            ' Laughed? Great, that’s your ab workout for the week, gym tourist.',
            ' Посміявся? Ну все, прес на тиждень відпрацював, туристе.',
          ],
        ],
      };
      const mood = c.temper <= 2 ? 'g' : c.temper === 3 ? 'y' : 'r';
      const min = Math.floor(c.now / 60000);
      const f = frames[mood][Math.floor(min / 5) % frames[mood].length];
      return L(f[0] + en[min % en.length] + f[2], f[1] + uk[min % uk.length] + f[3]);
    },
  },
  {
    id: 'insult',
    all: [
      [
        'fuck*',
        'shit',
        'idiot',
        'stupid',
        'hate you',
        'shut up',
        'сука',
        'бля*',
        'йоб*',
        'дурн*',
        'ідіот*',
        'ненавиджу',
        'заткн*',
        'відвали',
      ],
    ],
    answer: (c, _p, L) =>
      moody(c, L, {
        g: [
          [
            'Whoa, easy, bro 😅 No hard feelings. Rough day? Let’s burn it off under the bar.',
            'Ого, спокуха, бро 😅 Я не ображаюсь. День не задався? Го виплеснемо все на штанзі.',
          ],
          [
            'All good, man, I can take it. Put that rage into the next set — PR incoming 💪',
            'Та норм, братан, я витримаю. Всю цю злість — у наступний підхід, і рекорд наш 💪',
          ],
          [
            'Haha, love the energy, dude. Just aim it at the barbell, not me.',
            'Ха, оце енергія! Тільки направ її на штангу, а не на мене, бро.',
          ],
        ],
        y: [
          ['Put that energy into the next set.', 'Цю енергію — в наступний сет.'],
          ['Noted. The bar still weighs the same.', 'Прийнято. Штанга від цього легшою не стала.'],
          ['Loud. Now lift like that.', 'Гучно. Тепер так само й тягни.'],
        ],
        r: [
          [
            'Big words from someone whose log has more gaps than sets.',
            'Сміливо, як для людини, в якої в журналі більше пропусків, ніж підходів.',
          ],
          [
            '*yawn* That’s the most effort you’ve put into anything all month, couch warrior.',
            '*позіхає* Це найбільше зусилля, яке ти доклав за місяць, диванний воїне.',
          ],
          [
            'Cute. Your insults get more reps than your workouts do.',
            'Мило. У твоїх образах більше повторень, ніж у твоїх тренуваннях.',
          ],
          [
            'Shout all you want, gym tourist. The weights still won’t lift themselves.',
            'Кричи скільки влізе, туристе. Гантелі від цього самі не піднімуться.',
          ],
        ],
      }),
  },
  {
    id: 'done',
    all: [
      [
        'done',
        'finished',
        'did it',
        'i trained',
        'зробив',
        'відтренув*',
        'закінчив',
        'готово',
        'потренував*',
      ],
    ],
    maxWords: 5,
    answer: (c, _p, L) => {
      const w = finishedOf(c)[0];
      const today = w && c.now - w.startedAt < DAY;
      return today
        ? moody(c, L, {
            g: [
              [
                'Let’s gooo! Big W, bro 💪 It’s logged. Now eat, sleep, repeat.',
                'Красава! Записано 💪 Тепер поїсти, поспати — і по новій.',
              ],
              [
                'Dude, you’re a machine! It’s in the log. Refuel, sleep well, go again 🤙',
                'Ну ти машина, бро! Все в журналі. Поїж, виспися — і знову в бій 🤙',
              ],
            ],
            y: [
              ['Logged. Now eat, sleep, repeat.', 'Записано. Тепер їж, спи, повторюй.'],
              [
                'Seen it. Good. Recover and come back.',
                'Бачу. Нормально. Відновлюйся й повертайся.',
              ],
            ],
            r: [
              [
                'Logged. Don’t expect a medal — it’s one session, not a career.',
                'Записав. Медалі не буде — це одне тренування, а не кар’єра.',
              ],
              [
                '*slow clap* Bare minimum done. Now eat, sleep, repeat — that’s where gym tourists drop out.',
                '*повільні оплески* Мінімум зроблено. Тепер їж, спи й повтори — саме тут туристи й відвалюються.',
              ],
            ],
          })
        : moody(c, L, {
            g: [
              [
                'Hold up, bro — I don’t see it in the log yet. Finish the session in the app so it counts 🤙',
                'Стоп, бро, у журналі поки пусто. Заверши тренування в додатку, щоб зарахувалось 🤙',
              ],
              [
                'Nice, dude! But it’s not in the log yet — finish the session in the app and it’s official.',
                'Добре, братан! Тільки в журналі його ще нема — заверши тренування в додатку, і все зарахується.',
              ],
            ],
            y: [
              [
                'Not in the log, didn’t happen. Finish the session in the app.',
                'Немає в журналі — не було. Заверши тренування в додатку.',
              ],
              [
                'The log disagrees. Finish the session in the app.',
                'Журнал каже інакше. Заверши тренування в додатку.',
              ],
            ],
            r: [
              [
                'Did it? The log says otherwise. Imaginary sessions don’t count, couch warrior — finish it in the app.',
                'Зробив? Журнал каже, що ні. Уявні тренування не рахуються, диванний воїне, — заверши в додатку.',
              ],
              [
                '*eye-roll* Nothing in the log. Either finish the session in the app or admit you only thought about it.',
                '*закочує очі* У журналі пусто. Або заверши тренування в додатку, або зізнайся, що ти про нього лише подумав.',
              ],
            ],
          });
    },
  },
  {
    id: 'bye',
    all: [
      [
        'bye',
        'good night',
        'goodnight',
        'see you',
        'later',
        'бувай',
        'на добраніч',
        'добраніч',
        'до зустрічі',
        'па',
      ],
    ],
    maxWords: 4,
    answer: (c, _p, L) =>
      moody(c, L, {
        g: [
          [
            'Later, bro! Sleep 7+ hours — gains grow at night 🤙 Next up: ',
            'Бувай, бро! Спи 7+ годин — м’язи ростуть уночі 🤙 Далі по плану: ',
          ],
          [
            'Catch you later, dude. Get your 7+ hours of sleep. Next up: ',
            'На зв’язку, братан. Спи 7+ годин, а не гортай стрічку до ночі. Далі по плану: ',
          ],
          [
            'Good night, champ! 7+ hours of sleep and you’re a machine tomorrow. Next up: ',
            'Добраніч, красава! 7+ годин сну — і завтра ти машина. Далі по плану: ',
          ],
        ],
        y: [
          ['Sleep 7+ hours. Next: ', 'Спи 7+ годин. Далі: '],
          [
            'Bye. 7+ hours of sleep, not 7 hours of scrolling. Next: ',
            'Бувай. 7+ годин сну, а не 7 годин стрічки. Далі: ',
          ],
        ],
        r: [
          [
            'Off you go. Sleep 7+ hours — finally something you’re consistent at. Next, no skipping: ',
            'Іди вже. Спи 7+ годин — хоч у чомусь ти стабільний. Далі, без прогулів: ',
          ],
          [
            '*sigh* Bye, couch warrior. 7+ hours of sleep, then no excuses. Next, no skipping: ',
            '*зітхає* Бувай, диванний воїне. 7+ годин сну — і завтра без відмазок. Далі, без прогулів: ',
          ],
          [
            'Bye, gym tourist. Sleep 7+ hours so tomorrow’s excuse can’t be “tired”. Next, no skipping: ',
            'Бувай, туристе. Поспи 7+ годин, щоб завтра не було відмазки «не виспався». Далі, без прогулів: ',
          ],
        ],
      }) + todayLine(c, L, c.now + DAY),
  },
  {
    id: 'how_are_you',
    all: [['how are you', 'how s it going', 'як ти', 'як справи', 'як ся маєш']],
    maxWords: 5,
    answer: (c, _p, L) => {
      const n = finishedOf(c).filter((w) => c.now - w.startedAt < WEEK).length;
      return L(
        `Depends on you. ${n} sessions this week.`,
        `Залежить від тебе. ${n} тренувань цього тижня.`,
      );
    },
  },
];
