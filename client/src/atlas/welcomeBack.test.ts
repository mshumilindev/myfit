import { describe, expect, it } from 'vitest';
import type { Workout } from '../types';
import type { AskCtx } from './intents';
import { welcome, welcomeBack } from './welcome';
import { COACH_DEFAULT } from './types';

// SPO-6: the long introduction is for the first conversation only; later ones greet briefly, in the temper's voice.
const DAY = 86_400_000;
const NOW = new Date(2026, 9, 7, 8).getTime();
const done = (daysAgo: number): Workout =>
  ({
    id: `W${daysAgo}`,
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + 3_600_000,
    gymId: null,
    exercises: [],
  }) as unknown as Workout;
const ctx = (locale: 'en' | 'uk', temper: 1 | 3 | 5): AskCtx => ({
  s: {
    workouts: [done(2), done(9)],
    coach: { ...COACH_DEFAULT, enabled: true, temper },
    injuries: [],
    sleeps: [],
    bodyMetrics: { weights: [] },
    restPeriods: [],
    exerciseRest: {},
  },
  now: NOW,
  locale,
  temper,
  fmt: { kg: (k) => `${k} kg`, mmss: (s) => `${s}s`, muscle: (m) => m, exercise: (e) => e },
});

describe('welcomeBack', () => {
  for (const temper of [1, 3, 5] as const)
    for (const locale of ['en', 'uk'] as const)
      it(`is a short greeting, not the introduction (temper ${temper}, ${locale})`, () => {
        const intro = welcome(ctx(locale, temper));
        const back = welcomeBack(ctx(locale, temper));
        expect(back.text.length).toBeGreaterThan(5);
        expect(back.text.length).toBeLessThan(intro.text.length / 2);
        expect(back.text).not.toContain("I'm not a doctor");
        expect(back.chips.length).toBeGreaterThan(0);
      });
});
