/**
 * Answers put together on the spot rather than looked up: a programme for
 * your days, minutes, kit and sore spots; two exercises side by side; "what
 * happens if I train five times a week"; "and with dumbbells?". Everything
 * comes from the exercise library, the textbook rules the planner already
 * uses, and your own log — nothing is written per question.
 */
import { BUILT_IN_CATALOG, richExerciseByName, type MuscleGroup } from '../data/exercises';
import type { EquipmentId } from '../data/equipment';
import { rankExercisesForMuscle } from '../sessionBuilder';
import { SPLIT_SLOTS, type SplitDay } from '../starterPlan';
import { muscleSetsInWorkout, setTypeOf } from '../store';
import { usualSessionsPerWeek } from './facts';
import { allowedKit, type Frame } from './frame';
import { finishedOf, type AskCtx, type AtlasAction, type Tr } from './intentKit';
import { PART_LOADS, PART_NAME, soreParts, type BodyPart, type Goal } from './memory';

const WEEK = 7 * 86_400_000;

/** Textbook split for N days (the same table the programme writer uses). */
const SPLITS: Record<number, SplitDay[]> = {
  1: ['full'],
  2: ['full', 'full'],
  3: ['full', 'full', 'full'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['push', 'pull', 'legs', 'upper', 'lower'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
};
/** Slots past the first five, for longer sessions. */
const EXTRA: Record<SplitDay, MuscleGroup[]> = {
  full: ['core', 'biceps'],
  upper: ['biceps', 'triceps'],
  lower: ['core', 'calves'],
  push: ['triceps', 'shoulders'],
  pull: ['biceps', 'lats'],
  legs: ['core', 'glutes'],
};
/** When a slot can't be filled around a sore part, train a neighbour instead. */
const NEIGHBOUR: Partial<Record<MuscleGroup, MuscleGroup>> = {
  quads: 'glutes',
  shoulders: 'traps',
  lower_back: 'core',
  hamstrings: 'glutes',
  calves: 'core',
};

const SPLIT_NAME: Record<SplitDay, [string, string]> = {
  full: ['full body', 'усе тіло'],
  upper: ['upper', 'верх'],
  lower: ['lower', 'низ'],
  push: ['push', 'жими'],
  pull: ['pull', 'тяги'],
  legs: ['legs', 'ноги'],
};

function scheme(goal: Goal | null, compound: boolean, L: Tr): string {
  if (goal === 'strength') return compound ? '4×4–6' : '3×8–10';
  if (goal === 'fat_loss') return compound ? '3×8–12' : L('3×12–15', '3×12–15');
  if (goal === 'fitness') return '3×10–12';
  return compound ? '3×6–10' : '3×10–15';
}

function exercisesFor(minutes: number): number {
  return minutes <= 30 ? 4 : minutes <= 45 ? 5 : minutes <= 60 ? 6 : 7;
}

/** The part a lift would load, if any of the sore ones. */
function loads(name: string, muscle: MuscleGroup, sore: BodyPart[]): BodyPart | null {
  const t = `${name} ${muscle}`.toLowerCase();
  return sore.find((p) => PART_LOADS[p].some((k) => t.includes(k))) ?? null;
}

/** Your last working set on a lift, if you've done it. */
function lastSet(c: AskCtx, name: string): { kg: number; reps: number } | null {
  for (const w of finishedOf(c)) {
    const e = w.exercises.find((x) => x.name === name);
    const s = e?.sets.filter((x) => setTypeOf(x) !== 'warmup' && x.reps > 0);
    if (s?.length) {
      const top = s.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a));
      return { kg: top.weight ?? 0, reps: top.reps };
    }
  }
  return null;
}

interface Pick {
  name: string;
  muscle: MuscleGroup;
  compound: boolean;
}

/**
 * The lifts a coach actually writes into a programme, per muscle, best first,
 * across kit (barbell, machine, dumbbell, bodyweight). The library has 800+
 * entries — most are variations nobody opens a plan with.
 */
const COMMON: Partial<Record<MuscleGroup, string[]>> = {
  quads: [
    'Barbell Squat',
    'Leg Press',
    'Goblet Squat',
    'Dumbbell Squat',
    'Dumbbell Lunges',
    'Bodyweight Walking Lunge',
    'Bodyweight Squat',
    'Leg Extensions',
  ],
  hamstrings: [
    'Romanian Deadlift',
    'Stiff-Legged Dumbbell Deadlift',
    'Kettlebell One-Legged Deadlift',
    'Lying Leg Curls',
    'Seated Leg Curl',
    'Glute Ham Raise',
  ],
  glutes: [
    'Barbell Hip Thrust',
    'Barbell Glute Bridge',
    'Single Leg Glute Bridge',
    'Butt Lift (Bridge)',
    'Glute Kickback',
  ],
  calves: ['Standing Calf Raises', 'Standing Dumbbell Calf Raise', 'Calf Raise On A Dumbbell'],
  core: ['Plank', 'Hanging Leg Raise', 'Cable Crunch', 'Dead Bug', 'Crunches', 'Russian Twist'],
  chest: [
    'Barbell Bench Press - Medium Grip',
    'Dumbbell Bench Press',
    'Incline Dumbbell Press',
    'Pushups',
    'Dips - Chest Version',
    'Dumbbell Flyes',
  ],
  lats: ['Pullups', 'Wide-Grip Lat Pulldown', 'Chin-Up', 'One-Arm Dumbbell Row', 'Inverted Row'],
  traps: [
    'Bent Over Barbell Row',
    'Seated Cable Rows',
    'One-Arm Dumbbell Row',
    'Bent Over Two-Dumbbell Row',
    'Inverted Row',
  ],
  shoulders: [
    'Standing Military Press',
    'Dumbbell Shoulder Press',
    'Arnold Dumbbell Press',
    'Side Lateral Raise',
    'Band Pull Apart',
  ],
  biceps: ['Barbell Curl', 'Dumbbell Bicep Curl', 'Hammer Curls'],
  triceps: [
    'Triceps Pushdown',
    'Close-Grip Barbell Bench Press',
    'Standing Dumbbell Triceps Extension',
    'Bench Dips',
  ],
  lower_back: ['Hyperextensions (Back Extensions)'],
};
/** Need a bar or a rack you may not have at home. */
const NEEDS_BAR = new Set([
  'Pullups',
  'Chin-Up',
  'Hanging Leg Raise',
  'Dips - Chest Version',
  'Inverted Row',
  'Hyperextensions (Back Extensions)',
]);

function kitOf(name: string): EquipmentId {
  const e = BUILT_IN_CATALOG.find((x) => x.names[0] === name)?.equipment;
  return e ?? (/bodyweight|walking lunge|inverted row/i.test(name) ? 'body' : 'other');
}

function pickFor(
  muscle: MuscleGroup,
  kit: Set<EquipmentId> | null,
  home: boolean,
  sore: BodyPart[],
  avoid: Set<string>,
  used: Set<string>,
  week: Map<string, number>,
  novice: boolean,
): Pick | null {
  const fits = (name: string, equip: EquipmentId) =>
    (!kit || kit.has(equip) || (equip === 'other' && kit.has('body'))) &&
    !(home && NEEDS_BAR.has(name)) &&
    // Limited kit: dips need parallel bars nobody mentioned.
    !(kit && /^Dips/.test(name)) &&
    !avoid.has(name) &&
    !used.has(name) &&
    !loads(name, muscle, sore);
  // The staples first; a lift already used this week drops behind a fresh one.
  const common = (COMMON[muscle] ?? []).filter((n) => fits(n, kitOf(n)));
  if (common.length) {
    const best = common
      .map((n, i) => ({ n, s: -i - (week.get(n) ?? 0) * 1.5 }))
      .sort((a, b) => b.s - a.s)[0].n;
    return { name: best, muscle, compound: richExerciseByName(best)?.mechanic === 'compound' };
  }
  const ranked = rankExercisesForMuscle(muscle, null).filter(
    (x) =>
      fits(x.name, (x.equipment ?? 'body') as EquipmentId) &&
      x.level !== 'expert' &&
      !(novice && x.level === 'intermediate' && !x.compound),
  );
  if (!ranked.length) return null;
  const best = [...ranked.slice(0, 25)].sort(
    (a, b) => (week.get(a.name) ?? 0) - (week.get(b.name) ?? 0),
  )[0];
  return { name: best.name, muscle, compound: best.compound };
}

export interface Composed {
  text: string;
  /** The "for you" line alone (a comparison's verdict) — for "so which one?". */
  verdict?: string;
  chips?: string[];
  action?: AtlasAction;
}

/** A week of training for the days, minutes, kit and sore spots given. */
export function programAnswer(c: AskCtx, f: Frame, L: Tr): Composed {
  const finished = finishedOf(c);
  const usual = usualSessionsPerWeek(finished, c.now);
  const days = Math.min(6, Math.max(1, f.days ?? c.mem?.days?.v ?? (usual >= 2 ? usual : 3)));
  const minutes = f.minutes ?? c.mem?.minutes?.v ?? 60;
  const goal = f.goal ?? c.mem?.goal?.v ?? null;
  const kit = allowedKit(f, c.mem);
  const sore = [...new Set([...(f.sore ? [f.sore] : []), ...soreParts(c.mem, c.now)])];
  const avoid = new Set(c.mem?.avoid ?? []);
  // At home a bar (pull-ups, hanging raises, dips) only when you said you have one.
  const home =
    (f.kit.includes('home') || (!f.kit.length && !!c.mem?.home) || (!!kit && !f.bar)) && !f.bar;
  const novice = finished.length < 6;
  const splits =
    novice && days <= 3 ? SPLITS[Math.max(1, days)].map(() => 'full' as SplitDay) : SPLITS[days];
  const n = exercisesFor(minutes);
  const week = new Map<string, number>();
  const moved: string[] = [];
  const lines: string[] = [];
  splits.forEach((split, i) => {
    const slots = [...SPLIT_SLOTS[split], ...EXTRA[split]].slice(0, n);
    const used = new Set<string>();
    const picks: Pick[] = [];
    for (const m0 of slots) {
      let m = m0;
      let p = pickFor(m, kit, home, sore, avoid, used, week, novice);
      if (!p && NEIGHBOUR[m0]) {
        m = NEIGHBOUR[m0]!;
        p = pickFor(m, kit, home, sore, avoid, used, week, novice);
        if (p) moved.push(`${m0}→${m}`);
      }
      if (!p) continue;
      used.add(p.name);
      week.set(p.name, (week.get(p.name) ?? 0) + 1);
      picks.push(p);
    }
    const items = picks.map((p) => {
      const last = lastSet(c, p.name);
      const you =
        last && last.kg
          ? L(
              ` (you: ${c.fmt.kg(last.kg)} × ${last.reps})`,
              ` (у тебе: ${c.fmt.kg(last.kg)} × ${last.reps})`,
            )
          : '';
      return `${c.fmt.exercise(p.name)} ${scheme(goal, p.compound, L)}${you}`;
    });
    const label = L(
      `Day ${i + 1} — ${SPLIT_NAME[split][0]}`,
      `День ${i + 1} — ${SPLIT_NAME[split][1]}`,
    );
    lines.push(`${label}: ${items.join(' · ')}.`);
  });

  const kitNote = kit
    ? f.kit.includes('home') || c.mem?.home
      ? L('home kit', 'домашній інвентар')
      : f.without.length
        ? L(`no ${f.without.join(', ')}`, `без ${f.without.map(kitUk).join(', ')}`)
        : L(
            `${[...(f.bar ? ['a pull-up bar'] : []), ...[...kit].filter((k) => k !== 'body')].join(', ') || 'bodyweight'} only`,
            `тільки ${[...(f.bar ? ['турнік'] : []), ...[...kit].filter((k) => k !== 'body').map(kitUk)].join(', ') || 'власна вага'}`,
          )
    : null;
  const soreNote = sore.length
    ? L(
        `easy on the ${sore.map((p) => PART_NAME[p][0]).join(', ')}`,
        `бережемо ${sore.map((p) => PART_NAME[p][1]).join(', ')}`,
      )
    : null;
  const head = L(
    `${days} day${days === 1 ? '' : 's'} a week, ~${minutes} min${kitNote ? `, ${kitNote}` : ''}${soreNote ? `, ${soreNote}` : ''}:`,
    `${days} ${days === 1 ? 'день' : days < 5 ? 'дні' : 'днів'} на тиждень, ~${minutes} хв${kitNote ? `, ${kitNote}` : ''}${soreNote ? `, ${soreNote}` : ''}:`,
  );
  const why =
    splits[0] === 'full'
      ? L(
          `Why this way: with ${days} day${days === 1 ? '' : 's'}, whole-body sessions hit every muscle ${days >= 2 ? `${days} times` : 'once'} a week — more often beats more per session.`,
          `Чому так: на ${days} ${days === 1 ? 'день' : 'дні'} краще все тіло — кожен м’яз ${days >= 2 ? `${days} рази` : 'раз'} на тиждень, частота важливіша за обсяг за раз.`,
        )
      : L(
          `Why this way: ${days} days split so each muscle gets about two sessions a week with 48 h between.`,
          `Чому так: ${days} дні(в) розбито так, щоб кожен м’яз працював ~2 рази на тиждень з перервою 48 год.`,
        );
  const soreWhy = sore.length
    ? L(
        ` Around the ${sore.map((p) => PART_NAME[p][0]).join(' and ')}: nothing that loads it${moved.length ? ', its slot goes to a neighbouring muscle' : ''} — if it still hurts in easy moves, get it checked.`,
        ` Через ${sore.map((p) => PART_NAME[p][1]).join(' і ')}: нічого, що його вантажить${moved.length ? ', його місце віддав сусідньому м’язу' : ''} — якщо болить навіть у легких рухах, покажися лікарю.`,
      )
    : '';
  const progress = L(
    ' Each week: when every set hits the top of the range, add weight next time.',
    ' Щотижня: коли всі підходи дійшли до верху діапазону — наступного разу додай вагу.',
  );
  return {
    text: `${head}\n${lines.join('\n')}\n${why}${soreWhy}${progress}`,
    chips: [
      L(`Make it ${days === 3 ? 4 : 3} days`, `Зроби на ${days === 3 ? 4 : 3} дні`),
      L(
        minutes > 30 ? 'Only 30 minutes?' : 'And 60 minutes?',
        minutes > 30 ? 'А на 30 хвилин?' : 'А на 60 хвилин?',
      ),
      L('How do I warm up?', 'Як розминатися?'),
    ],
    action: {
      type: 'plan',
      days,
      lengthMin: Math.min(120, Math.max(30, Math.round(minutes / 15) * 15)),
    },
  };
}

function kitUk(k: string): string {
  return (
    (
      {
        barbell: 'штанги',
        dumbbell: 'гантелі',
        machine: 'тренажери',
        cable: 'блоки',
        body: 'власна вага',
        kettlebell: 'гирі',
        bands: 'резинки',
        ezBar: 'EZ-гриф',
      } as Record<string, string>
    )[k] ?? k
  );
}
const KIT_EN: Record<string, string> = {
  barbell: 'a barbell',
  dumbbell: 'dumbbells',
  machine: 'a machine',
  cable: 'a cable stack',
  body: 'nothing but you',
  kettlebell: 'a kettlebell',
  bands: 'bands',
  ezBar: 'an EZ bar',
};

function equipOf(name: string): EquipmentId | null {
  return (
    BUILT_IN_CATALOG.find((e) => e.names[0] === name)?.equipment ??
    richExerciseByName(name)?.equipment ??
    null
  );
}

/** Two exercises side by side — from the library, then from your log. */
export function compareAnswer(c: AskCtx, a: string, b: string, L: Tr): Composed | null {
  const ra = richExerciseByName(a);
  const rb = richExerciseByName(b);
  if (!ra || !rb) return null;
  const n = (x: string) => c.fmt.exercise(x);
  const mus = (ms: MuscleGroup[]) => ms.map((m) => c.fmt.muscle(m)).join(', ');
  const load: Record<string, number> = {
    barbell: 5,
    machine: 4,
    cable: 3,
    dumbbell: 3,
    ezBar: 4,
    kettlebell: 2,
    body: 1,
    bands: 1,
  };
  const la = load[ra.equipment ?? 'body'] ?? 2;
  const lb = load[rb.equipment ?? 'body'] ?? 2;
  const lines: string[] = [];
  lines.push(
    L(
      `${n(a)}: ${mus(ra.primaryMuscles)}${ra.secondaryMuscles.length ? ` (+ ${mus(ra.secondaryMuscles.slice(0, 3))})` : ''}, ${ra.mechanic === 'compound' ? 'multi-joint' : 'isolation'}, ${KIT_EN[ra.equipment ?? 'body'] ?? ra.equipment}.`,
      `${n(a)}: ${mus(ra.primaryMuscles)}${ra.secondaryMuscles.length ? ` (+ ${mus(ra.secondaryMuscles.slice(0, 3))})` : ''}, ${ra.mechanic === 'compound' ? 'багатосуглобова' : 'ізолююча'}, ${kitUk(ra.equipment ?? 'body')}.`,
    ),
    L(
      `${n(b)}: ${mus(rb.primaryMuscles)}${rb.secondaryMuscles.length ? ` (+ ${mus(rb.secondaryMuscles.slice(0, 3))})` : ''}, ${rb.mechanic === 'compound' ? 'multi-joint' : 'isolation'}, ${KIT_EN[rb.equipment ?? 'body'] ?? rb.equipment}.`,
      `${n(b)}: ${mus(rb.primaryMuscles)}${rb.secondaryMuscles.length ? ` (+ ${mus(rb.secondaryMuscles.slice(0, 3))})` : ''}, ${rb.mechanic === 'compound' ? 'багатосуглобова' : 'ізолююча'}, ${kitUk(rb.equipment ?? 'body')}.`,
    ),
  );
  const heavier = la === lb ? null : la > lb ? a : b;
  const lighter = heavier === a ? b : a;
  if (heavier)
    lines.push(
      L(
        `${n(heavier)} is easier to load heavy and track in kilos; ${n(lighter)} is easier on the joints and needs less kit.`,
        `${n(heavier)} легше вантажити важко й відстежувати в кілограмах; ${n(lighter)} м’якша до суглобів і потребує менше обладнання.`,
      ),
    );
  // You: what you've actually done on each.
  const la2 = lastSet(c, a);
  const lb2 = lastSet(c, b);
  const you = [
    la2 && `${n(a)} ${c.fmt.kg(la2.kg)} × ${la2.reps}`,
    lb2 && `${n(b)} ${c.fmt.kg(lb2.kg)} × ${lb2.reps}`,
  ].filter(Boolean);
  if (you.length)
    lines.push(L(`In your log: ${you.join(', ')}.`, `У твоєму журналі: ${you.join(', ')}.`));
  // The verdict for you: home / sore part / goal, else "both, in this order".
  const sore = soreParts(c.mem, c.now);
  const hurtA = loads(a, ra.primaryMuscles[0], sore);
  const hurtB = loads(b, rb.primaryMuscles[0], sore);
  let verdict: string;
  if (hurtA && !hurtB)
    verdict = L(
      `For you now: ${n(b)} — ${n(a)} loads your ${PART_NAME[hurtA][0]}.`,
      `Тобі зараз: ${n(b)} — ${n(a)} вантажить ${PART_NAME[hurtA][1]}.`,
    );
  else if (hurtB && !hurtA)
    verdict = L(
      `For you now: ${n(a)} — ${n(b)} loads your ${PART_NAME[hurtB][0]}.`,
      `Тобі зараз: ${n(a)} — ${n(b)} вантажить ${PART_NAME[hurtB][1]}.`,
    );
  else if (c.mem?.home && heavier && la >= 4)
    verdict = L(`At home: ${n(lighter)}.`, `Удома: ${n(lighter)}.`);
  else if (heavier)
    verdict = L(
      `No need to choose: ${n(heavier)} first as the main lift, ${n(lighter)} after it for extra volume.`,
      `Обирати не треба: ${n(heavier)} першою як основну, ${n(lighter)} після неї — для додаткового обсягу.`,
    );
  else
    verdict = L(
      'Both work — pick the one you can do with clean form and add weight or reps to over weeks.',
      'Працюють обидві — бери ту, яку робиш чисто і в якій можеш додавати вагу чи повтори тижнями.',
    );
  lines.push(verdict);
  return {
    text: lines.join(' '),
    verdict,
    chips: [
      L(`How to do ${n(a)}?`, `Як робити ${n(a)}?`),
      L(`How to do ${n(b)}?`, `Як робити ${n(b)}?`),
    ],
  };
}

/** Sets a muscle got in the last 4 weeks, per week. */
function weeklySets(c: AskCtx, m: MuscleGroup): number {
  const ws = finishedOf(c).filter((w) => c.now - w.startedAt < 4 * WEEK);
  let s = 0;
  for (const w of ws) s += muscleSetsInWorkout(w).get(m) ?? 0;
  return s / 4;
}

/** "What if I train N times a week?" — from your usual week and the textbook splits. */
export function whatIfDays(c: AskCtx, days: number, muscle: MuscleGroup | null, L: Tr): Composed {
  const finished = finishedOf(c);
  const usual = usualSessionsPerWeek(finished, c.now);
  const split = SPLITS[Math.min(6, days)] ?? SPLITS[6];
  const perMuscle = days <= 3 ? days : days === 4 ? 2 : days === 5 ? 2 : 2;
  const shape =
    days <= 3
      ? L(
          `whole-body sessions, each muscle ${perMuscle}× a week`,
          `тренування на все тіло, кожен м’яз ${perMuscle}× на тиждень`,
        )
      : L(
          `a ${split.map((x) => SPLIT_NAME[x][0]).join(' / ')} split, each muscle about 2× a week`,
          `спліт ${split.map((x) => SPLIT_NAME[x][1]).join(' / ')}, кожен м’яз приблизно 2× на тиждень`,
        );
  const now = usual
    ? L(
        `Now you train about ${usual}× a week.`,
        `Зараз ти тренуєшся приблизно ${usual}× на тиждень.`,
      )
    : L('Your log has no steady week yet.', 'У журналі ще нема сталого тижня.');
  let effect: string;
  if (usual && days > usual + 1)
    effect = L(
      `Going to ${days}: more weekly volume and practice — growth usually speeds up, as long as each session stays shorter and you sleep 7+ h. Add one day first, keep it 3–4 weeks, then the next.`,
      `Перехід на ${days}: більше тижневого обсягу й практики — ріст зазвичай пришвидшується, якщо кожне тренування коротшає, а сон 7+ год. Додавай по одному дню й тримай 3–4 тижні, потім наступний.`,
    );
  else if (usual && days < usual)
    effect = L(
      `Dropping to ${days}: you keep almost everything if each session stays hard — strength holds for weeks on less volume. Put the big lifts first.`,
      `Зменшення до ${days}: майже все збережеш, якщо кожне тренування лишиться важким — сила тримається тижнями на меншому обсязі. Базові — першими.`,
    );
  else
    effect = L(
      `${days} a week is close to what you do — the gain is steadiness, not a new result.`,
      `${days} на тиждень — майже як зараз: виграш у стабільності, не в новому результаті.`,
    );
  if (days >= 6)
    effect += L(
      ' Six or more leaves little recovery — only with short sessions and no muscle trained two days running.',
      ' Шість і більше — мало відновлення: лише короткі тренування й без того самого м’яза два дні поспіль.',
    );
  let m = '';
  if (muscle) {
    const cur = weeklySets(c, muscle);
    const next = Math.round(perMuscle * (days <= 3 ? 3 : 4));
    m = L(
      ` ${c.fmt.muscle(muscle)}: now ~${cur.toFixed(0)} sets a week; on ${days} days ≈ ${next}–${next + 4} sets over ${perMuscle} sessions.`,
      ` ${c.fmt.muscle(muscle)}: зараз ~${cur.toFixed(0)} сетів на тиждень; на ${days} днях ≈ ${next}–${next + 4} сетів за ${perMuscle} тренування.`,
    );
  }
  return {
    text: `${now} ${L(`On ${days}: ${shape}.`, `На ${days}: ${shape}.`)}${m} ${effect}`,
    chips: [
      L(`Make me a ${days}-day plan`, `Склади план на ${days} дні`),
      L('How much should I sleep?', 'Скільки треба спати?'),
    ],
  };
}

/** The same movement with other kit: bench → dumbbell bench, squat → goblet squat. */
export function variantOf(name: string, kit: EquipmentId): string | null {
  const rich = richExerciseByName(name);
  if (!rich) return null;
  if (rich.equipment === kit) return name;
  const muscle = rich.primaryMuscles[0];
  const stop = new Set([
    'barbell',
    'dumbbell',
    'dumbbells',
    'cable',
    'machine',
    'smith',
    'kettlebell',
    'band',
    'bands',
    'with',
    'on',
    'the',
    'a',
    '-',
    'medium',
    'grip',
    'one',
    'arm',
    'two',
    'ez',
    'bar',
    'ez-bar',
  ]);
  const key = (n: string) =>
    n
      .toLowerCase()
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !stop.has(w));
  const base = new Set(key(name));
  let best: { n: string; s: number } | null = null;
  for (const c of rankExercisesForMuscle(muscle, null)) {
    if ((c.equipment ?? 'body') !== kit) continue;
    const r = richExerciseByName(c.name);
    if (r && rich.force && r.force && r.force !== rich.force) continue;
    const words = key(c.name);
    const shared = words.filter((w) => base.has(w)).length;
    const s =
      shared * 3 -
      Math.abs(words.length - base.size) * 0.5 +
      (c.compound === (rich.mechanic === 'compound') ? 1 : 0);
    if (!best || s > best.s) best = { n: c.name, s };
  }
  return best && best.s > 0 ? best.n : null;
}

export { equipOf };
