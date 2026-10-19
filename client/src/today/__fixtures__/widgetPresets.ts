/** Synthetic Today-widget fixtures (see widgetHarness.tsx). */
import { NOW, DAY } from './widgetData';

import { renderHook } from '@testing-library/react';
import { setProgramMemory } from '../../data/programMemory';
import { giveUpChallenge, startChallenge, useChallenges } from '../../challenges';
import { syncNotifs, type Notif } from '../../notifications';
import { CATALOG } from '../../learn/catalog';
import { clearChat, pushChat } from '../../atlas/chatLog';

/** Device-local presets (localStorage / chat log) a widget reads besides the store. */
export const PROGRAM = {
  program: {
    id: 'p1',
    name: 'Upper Lower Push',
    weeks: 8,
    daysPerWeek: 3,
    dayNames: { '1': 'Push', '3': 'Legs', '5': 'Pull' },
    targetMuscles: {
      '1': ['chest', 'shoulders'],
      '3': ['quads', 'hamstrings'],
      '5': ['back', 'biceps'],
    },
    items: [
      {
        id: 'i1',
        day: 1,
        position: 0,
        name: 'Barbell Bench Press - Medium Grip',
        kind: 'strength',
        sets: 4,
        reps: 8,
        durationMin: null,
        equipment: [],
      },
      {
        id: 'i2',
        day: 1,
        position: 1,
        name: 'Barbell Shoulder Press',
        kind: 'strength',
        sets: 3,
        reps: 10,
        durationMin: null,
        equipment: [],
      },
      {
        id: 'i3',
        day: 3,
        position: 0,
        name: 'Barbell Squat',
        kind: 'strength',
        sets: 4,
        reps: 6,
        durationMin: null,
        equipment: [],
      },
      {
        id: 'i4',
        day: 3,
        position: 1,
        name: 'Barbell Deadlift',
        kind: 'strength',
        sets: 3,
        reps: 5,
        durationMin: null,
        equipment: [],
      },
      {
        id: 'i5',
        day: 5,
        position: 0,
        name: 'Pullups',
        kind: 'strength',
        sets: 4,
        reps: 8,
        durationMin: null,
        equipment: [],
      },
      {
        id: 'i6',
        day: 5,
        position: 1,
        name: 'Treadmill Running',
        kind: 'cardio',
        sets: 1,
        reps: 0,
        durationMin: 15,
        equipment: [],
      },
    ],
  },
  assignedBy: null,
  week: 3,
  done: 6,
  total: 24,
  expectedSoFar: 8,
  adherence: 0.75,
};

const startedChallenges: string[] = [];
const FEED: Notif[] = [
  {
    id: 'n1',
    kind: 'pr',
    ts: NOW - 20 * 60_000,
    title: 'New PR: Barbell Squat',
    subtitle: '120 kg x 5',
  },
  {
    id: 'n2',
    kind: 'feat',
    ts: NOW - 5 * 3_600_000,
    title: '250 sets',
    subtitle: 'Sets completed',
  },
  { id: 'n3', kind: 'streak', ts: NOW - 2 * DAY, title: '7-day streak', subtitle: 'Keep it going' },
  { id: 'n4', kind: 'challenge', ts: NOW - 6 * DAY, title: 'Challenge done', subtitle: 'Sessions' },
  { id: 'n5', kind: 'atlas', ts: NOW - 9 * DAY, title: 'Atlas noted', subtitle: 'Rest' },
  { id: 'n6', kind: 'trend', ts: NOW - 12 * DAY, title: 'Trend up', subtitle: 'Bench' },
];

function stopChallenges(): void {
  startedChallenges.splice(0);
  // Also drop challenges a test started through the UI ("Start challenge"): the list is module state.
  const hook = renderHook(() => useChallenges());
  for (const c of hook.result.current) giveUpChallenge(c.id);
  hook.unmount();
}

export const PRESETS: Record<string, () => void> = {
  none: () => {
    clearChat();
    setProgramMemory(null);
    stopChallenges();
    syncNotifs([]);
  },
  /** One challenge already reached (target 1 session). */
  apexDone: () => {
    PRESETS.none();
    startedChallenges.push(startChallenge('sessions', 1, 14, NOW - 5 * DAY).id);
  },
  /** One challenge whose deadline has passed unreached. */
  apexTimeUp: () => {
    PRESETS.none();
    startedChallenges.push(startChallenge('sessions', 99, 2, NOW - 5 * DAY).id);
  },
  /** Two running challenges and a notifications feed (Apex). */
  apex: () => {
    PRESETS.none();
    startedChallenges.push(startChallenge('sets:total', 500, 30, NOW - 3 * DAY).id);
    startedChallenges.push(startChallenge('sessions', 12, 14, NOW - 5 * DAY).id);
    syncNotifs(FEED);
  },
  program: () => {
    clearChat();
    setProgramMemory(PROGRAM);
  },
  learnPartial: () => {
    const all = CATALOG.flatMap((t) => t.lessons.map((l) => l.id));
    const first = CATALOG[0].lessons.map((l) => l.id);
    localStorage.setItem('spotter.learn.completed', JSON.stringify(first.slice(0, 3)));
    localStorage.setItem(
      'spotter.learn.saved',
      JSON.stringify([all[1], all[4], all[9], all[12], all[15], all[20], 'gone']),
    );
  },
  learnAll: () => {
    localStorage.setItem(
      'spotter.learn.completed',
      JSON.stringify(CATALOG.flatMap((t) => t.lessons.map((l) => l.id))),
    );
    localStorage.setItem('spotter.learn.saved', JSON.stringify([CATALOG[0].lessons[0].id]));
  },
  learnCorrupt: () => {
    localStorage.setItem('spotter.learn.completed', '{not json');
    localStorage.setItem('spotter.learn.saved', '"text"');
  },
  /** Every widget-local value (`spotter.tw.<id>`) in a valid shape, plus a cached position. */
  local: () => {
    PRESETS.program();
    const tw = (id: string, v: unknown) =>
      localStorage.setItem(`spotter.tw.${id}`, JSON.stringify(v));
    tw('pr-forecast', { squat: 140, bench: 100, deadlift: 180, ohp: 60 });
    tw('one-rm-calc', { weight: 100, reps: 5, lift: 'bench', label: null });
    tw('rep-prs', 'Barbell Squat');
    tw('lr-balance', [
      { name: 'Dumbbell Curl', l: 20, r: 22, at: NOW - 5 * DAY },
      { name: 'Dumbbell Row', l: 30, r: 30, at: NOW - 1 * DAY },
      { name: 'Single Leg Press', l: 80, r: 70, at: NOW - 2 * DAY },
    ]);
    tw('weekly-goal', 4);
    tw('quick-session-builder', { len: 60, focus: 'push' });
    tw('rest-timer', { at: 0, delta: 30, skip: false, endsAt: NOW + 60_000, total: 90_000 });
    localStorage.setItem('spotter.tw.lift-record', 'Barbell Squat');
    const d = new Date(NOW);
    const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    tw('exercise-of-the-day', { day, n: 2 });
    tw('challenge-to-try', { day, n: 1 });
    localStorage.setItem('spotter.lastPos', JSON.stringify({ lat: 1, lng: 1 }));
  },
  /** The same keys holding garbage: a widget must fall back to its defaults. */
  localCorrupt: () => {
    for (const id of [
      'pr-forecast',
      'one-rm-calc',
      'rep-prs',
      'lr-balance',
      'weekly-goal',
      'quick-session-builder',
      'rest-timer',
      'lift-record',
      'exercise-of-the-day',
      'challenge-to-try',
    ])
      localStorage.setItem(`spotter.tw.${id}`, '{broken');
    localStorage.setItem('spotter.lastPos', '{broken');
  },
  chat: () => {
    clearChat();
    pushChat({ id: 'm1', at: NOW - 3_600_000, from: 'me', text: 'How is my squat going?' });
    pushChat({
      id: 'm2',
      at: NOW - 3_500_000,
      from: 'atlas',
      text: 'Up 5 kg in three weeks. Keep the bar path tight.',
    });
    pushChat({ id: 'm3', at: NOW - 60_000, from: 'me', text: 'Plan for tomorrow?' });
  },
  chatPending: () => {
    clearChat();
    pushChat({ id: 'm1', at: NOW - 60_000, from: 'me', text: 'Plan for tomorrow?' });
    pushChat({ id: 'm2', at: NOW - 50_000, from: 'atlas', text: '…', pending: true });
  },
};
