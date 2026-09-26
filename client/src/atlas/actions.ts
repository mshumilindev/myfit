/**
 * Doing what Atlas offered in chat — always after the athlete tapped
 * "Do it". Each action returns the line Atlas says afterwards.
 */
import {
  addWeight,
  getOpenWorkout,
  latestWeight,
  pickSessionGym,
  setCoach,
  setExerciseRestSec,
  startGeneratedDay,
  startInjury,
  startRestPeriod,
  dayKey,
  startWorkout,
  type StoreState,
  getStoreState,
} from '../store';
import { bodyPart as bodyPartOf, loadCaps, protectedMuscles } from '../injury';
import { buildPlanDay, planDayFor } from './plan';
import { clearSaid, mergeMemory } from './memory';
import { memoryBuildHints } from './memoryPlan';
import type { AtlasAction, Tr } from './intentKit';

export interface ActionResult {
  text: string;
  /** Open this workout after the chat line (start). */
  openWorkoutId?: string;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function runAction(
  a: AtlasAction,
  s: StoreState,
  now: number,
  L: Tr,
  fmtEx: (n: string) => string,
): ActionResult {
  const mem = s.coach.memory;
  switch (a.type) {
    case 'many': {
      // One after another — each sees the store the previous one left.
      const done = a.actions.map((x) => runAction(x, getStoreState(), now, L, fmtEx));
      return {
        text: done.map((d) => d.text).join(' '),
        openWorkoutId: done.find((d) => d.openWorkoutId)?.openWorkoutId,
      };
    }
    case 'rest':
      setExerciseRestSec(a.exercise, a.sec);
      return {
        text: L(
          `Done — ${fmtEx(a.exercise)} rest is ${mmss(a.sec)}.`,
          `Готово — відпочинок для ${fmtEx(a.exercise)} ${mmss(a.sec)}.`,
        ),
      };
    case 'avoid':
      setCoach({
        memory: mergeMemory(mem, { avoid: [...new Set([...(mem?.avoid ?? []), a.exercise])] }),
      });
      return {
        text: L(
          `Done — no more ${fmtEx(a.exercise)} in your plans.`,
          `Готово — ${fmtEx(a.exercise)} у планах більше нема.`,
        ),
      };
    case 'swap': {
      const prefer = [
        ...(mem?.prefer ?? []).filter((x) => x.from !== a.from),
        { from: a.from, to: a.to },
      ];
      setCoach({ memory: mergeMemory(mem, { prefer }) });
      return {
        text: L(
          `Done — ${fmtEx(a.to)} instead of ${fmtEx(a.from)} from now on.`,
          `Готово — надалі ${fmtEx(a.to)} замість ${fmtEx(a.from)}.`,
        ),
      };
    }
    case 'moveDay': {
      const plan = s.coach.plan;
      if (!plan) return { text: L('No programme to change.', 'Нема програми, щоб змінювати.') };
      const days = plan.days.map((d) =>
        d.weekday === a.from
          ? { ...d, weekday: a.to }
          : d.weekday === a.to
            ? { ...d, weekday: a.from }
            : d,
      );
      setCoach({
        plan: { ...plan, days: days.sort((x, y) => ((x.weekday + 6) % 7) - ((y.weekday + 6) % 7)) },
      });
      return { text: L('Done — the programme is updated.', 'Готово — програму оновлено.') };
    }
    case 'start': {
      const open = getOpenWorkout();
      if (open)
        return {
          text: L('Opening your workout.', 'Відкриваю тренування.'),
          openWorkoutId: open.id,
        };
      const plan = s.coach.enabled && s.coach.role === 'main' ? s.coach.plan : null;
      const day = plan ? planDayFor(plan, now) : null;
      let w = null;
      if (plan && day) {
        const finished = s.workouts.filter((x) => x.finishedAt !== null);
        const built = buildPlanDay(plan, day, {
          finished,
          activities: s.activities,
          body: s.bodyMetrics,
          goals: s.goals,
          gym: pickSessionGym(),
          now,
          intent: 'muscle',
          protectedMuscles: [...protectedMuscles(s.injuries)],
          ...memoryBuildHints(mem, loadCaps(s.injuries), now),
          bodyKg: latestWeight(s.bodyMetrics)?.weight ?? null,
          sex: s.bodyMetrics.sex,
        });
        if (built.main.length) w = startGeneratedDay(built, pickSessionGym()?.id ?? null);
      }
      w ??= startWorkout(pickSessionGym()?.id ?? null);
      return w
        ? { text: L('Go. I’m watching.', 'Вперед. Я стежу.'), openWorkoutId: w.id }
        : {
            text: L(
              'Can’t start — something else is running (an activity or a night).',
              'Не можу почати — вже йде щось інше (активність чи сон).',
            ),
          };
    }
    case 'temper':
      setCoach({ temper: a.temper });
      return { text: L('Done. Better?', 'Готово. Так краще?') };
    case 'mute': {
      const d = new Date(now);
      d.setHours(24, 0, 0, 0);
      setCoach({ mutedUntil: d.getTime() });
      return {
        text: L('Muted until tomorrow. The chat still works.', 'Мовчу до завтра. Чат працює.'),
      };
    }
    case 'bodyweight':
      addWeight(a.kg, now);
      return { text: L(`Logged ${a.kg} kg.`, `Записав ${a.kg} кг.`) };
    case 'pause': {
      const today = dayKey(now);
      startRestPeriod({ mode: 'off', startDay: today, endDay: today + a.days - 1, note: 'Atlas' });
      return {
        text: L(
          `Done — plan paused for ${a.days} days, your streak is safe. Come back whenever you're ready.`,
          `Готово — план на паузі ${a.days} дн., серія збережена. Повертайся, коли будеш готовий.`,
        ),
      };
    }
    case 'illness': {
      const today = dayKey(now);
      startRestPeriod({
        mode: 'illness',
        startDay: today,
        endDay: today,
        open: true,
        note: 'Atlas',
      });
      return {
        text: L(
          "Logged — you're off sick until you say you're better. Plan paused, streak kept. Rest, drink, sleep.",
          'Записав — ти на лікарняному, доки не скажеш, що одужав. План на паузі, серія збережена. Відпочивай, пий, спи.',
        ),
      };
    }
    case 'injury': {
      const part = bodyPartOf(a.bodyPart);
      const today = dayKey(now);
      startInjury({
        reason: 'injury',
        bodyPart: a.bodyPart,
        muscles: part?.muscles ?? [],
        stage: a.stage,
        fullRestUntil: a.restDays ? today + a.restDays : null,
        note: a.note ?? 'Atlas',
        now,
      });
      return {
        text: L(
          a.restDays
            ? `Logged in Injuries: ${a.restDays} days of rest for that area, then we bring it back step by step by how it feels.`
            : a.stage === 'protect'
              ? 'Logged in Injuries: that area is out of your sessions for now; we bring it back step by step by how it feels.'
              : 'Logged in Injuries: that area trains light for now; after two pain-free sessions I offer the next step.',
          a.restDays
            ? `Записав у «Травми»: ${a.restDays} дн. відпочинку для цієї зони, далі повертаємо поступово, за самопочуттям.`
            : a.stage === 'protect'
              ? 'Записав у «Травми»: цю зону поки прибираю з тренувань, повертатимемо поступово, за самопочуттям.'
              : 'Записав у «Травми»: цю зону поки тренуємо легко; після двох тренувань без болю запропоную наступний крок.',
        ),
      };
    }
    case 'forget':
      setCoach({ memory: {} });
      clearSaid();
      return {
        text: L(
          'Forgotten. Clean slate — your log stays.',
          'Забув. Чистий аркуш — журнал лишається.',
        ),
      };
  }
}
