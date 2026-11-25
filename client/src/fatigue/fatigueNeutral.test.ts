/**
 * SPO-558 (F1): without Fatigue / Readiness the numbers that steer the app read an empty history (everything ready, nothing
 * tired), and the stored workouts are untouched; with them installed they read the real history.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { fatigueSource, readinessSource } from '../fatigueApi';
import { muscleFatigue, stalledMuscles } from '../fatigue';
import { directReadiness, fatigueByGroup, readinessByGroup } from '../picker';
import { cachedPersonalLandmarks, personalLandmarks } from '../personalize';
import type { Exercise, Workout } from '../types';

afterEach(() => addonsPref.reset());

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 23, 12);
const ex = (name: string, n: number, tag = ''): Exercise => ({
  id: name,
  name,
  position: 0,
  sets: Array.from({ length: n }, (_, i) => ({
    id: `s${tag}${i}`,
    reps: 6,
    weight: 90,
    isWarmup: false,
    position: i,
    loggedAt: NOW,
  })),
});
const HISTORY: Workout[] = [1, 2, 3, 4, 5].map((d) => ({
  id: `w${d}`,
  startedAt: NOW - d * DAY,
  finishedAt: NOW - d * DAY + 3600000,
  autoFinished: false,
  exercises: [ex('Incline Dumbbell Press', 14, `w${d}`)],
}));

describe('neutral values without the add-on', () => {
  it('the sources hand over the history only while the module is installed', () => {
    addonsPref.set(['fatigue-readiness']);
    expect(fatigueSource(HISTORY)).toEqual([]);
    expect(readinessSource(HISTORY)).toEqual([]);
    addonsPref.set(['fatigue-readiness', 'fatigue']);
    expect(fatigueSource(HISTORY)).toBe(HISTORY);
    expect(readinessSource(HISTORY)).toEqual([]);
    addonsPref.set(['fatigue-readiness', 'fatigue', 'readiness']);
    expect(readinessSource(HISTORY)).toBe(HISTORY);
  });

  it('the picker reads an empty history: nothing tired, chest ready', () => {
    const tiredWith = () => fatigueByGroup(HISTORY, NOW).get('chest')?.level;
    const readyWith = () => directReadiness(['chest'], 'chest', HISTORY, NOW);
    addonsPref.set(['fatigue-readiness', 'fatigue', 'readiness']);
    expect(tiredWith()).not.toBe('fresh');
    expect(readyWith().state).not.toBe('ready');
    addonsPref.set([]);
    expect(fatigueByGroup(HISTORY, NOW)).toEqual(
      muscleFatigue([], NOW, personalLandmarks([], NOW)),
    );
    expect(tiredWith()).toBe('fresh');
    expect(readyWith()).toEqual(directReadiness(['chest'], 'chest', [], NOW));
    expect(readyWith().days).toBeNull();
    for (const r of readinessByGroup(HISTORY, NOW).values()) expect(r.days).toBeNull();
  });

  it('personal landmarks are read again when the add-on comes or goes (what is stalled changes)', () => {
    addonsPref.set(['fatigue-readiness', 'fatigue']);
    const on = cachedPersonalLandmarks(HISTORY, NOW);
    expect(cachedPersonalLandmarks(HISTORY, NOW)).toBe(on);
    addonsPref.set([]);
    expect(cachedPersonalLandmarks(HISTORY, NOW)).not.toBe(on);
  });

  it('what is stalled (drop tolerance in a live session) reads an empty history without the add-on', () => {
    addonsPref.set([]);
    expect(stalledMuscles(fatigueSource(HISTORY), NOW).size).toBe(0);
    addonsPref.set(['fatigue-readiness', 'fatigue']);
    expect(stalledMuscles(fatigueSource(HISTORY), NOW)).toEqual(stalledMuscles(HISTORY, NOW));
  });

  it('never changes the stored history', () => {
    const before = JSON.stringify(HISTORY);
    addonsPref.set([]);
    fatigueByGroup(HISTORY, NOW);
    readinessByGroup(HISTORY, NOW);
    expect(JSON.stringify(HISTORY)).toBe(before);
  });
});
