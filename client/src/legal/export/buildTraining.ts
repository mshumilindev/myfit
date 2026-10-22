/** Export builders: training and the Atlas chat. Pure. */
import { isoTime } from './csv';
import type { CategoryResult, ExportSources, Missing } from './exportModel';

export function buildTraining(s: ExportSources): CategoryResult {
  const st = s.store;
  if (!st)
    return {
      id: 'training',
      files: [],
      missing: [{ item: 'Training data', reason: 'not-loaded' }],
    };
  const sets = st.workouts.flatMap((w) =>
    w.exercises.flatMap((e) =>
      e.sets.map((x, i) => [
        w.id,
        isoTime(w.startedAt),
        w.dayName ?? '',
        e.name,
        i + 1,
        x.type ?? (x.isWarmup ? 'warmup' : 'working'),
        x.reps,
        x.weight,
        x.rpe ?? '',
        x.durationMin ?? '',
        x.distanceKm ?? '',
        x.calories ?? '',
      ]),
    ),
  );
  const missing: Missing[] = [
    { item: 'Programs and plans a trainer assigned to you', reason: 'not-loaded' },
  ];
  return {
    id: 'training',
    missing,
    files: [
      {
        name: 'workouts.json',
        about:
          'Every session with its exercises and sets. Notes you typed may contain health details you typed.',
        content: { kind: 'json', value: st.workouts },
        rows: st.workouts.length,
      },
      {
        name: 'sets.csv',
        about: 'One row per set (weights in kg as stored).',
        content: {
          kind: 'csv',
          header: [
            'session_id',
            'session_start_utc',
            'day_name',
            'exercise',
            'set_no',
            'set_type',
            'reps',
            'weight_kg',
            'rpe',
            'duration_min',
            'distance_km',
            'calories',
          ],
          rows: sets,
        },
        rows: sets.length,
      },
      {
        name: 'activities.json',
        about: 'Cardio and recovery activities.',
        content: { kind: 'json', value: st.activities },
        rows: st.activities.length,
      },
      {
        name: 'activities.csv',
        about: 'The same activities as a table.',
        content: {
          kind: 'csv',
          header: [
            'id',
            'type',
            'category',
            'start_utc',
            'end_utc',
            'duration_min',
            'distance_km',
            'calories',
          ],
          rows: st.activities.map((a) => [
            a.id,
            a.type,
            a.category,
            isoTime(a.startedAt),
            isoTime(a.finishedAt),
            a.durationMin,
            a.distanceKm ?? '',
            a.calories ?? '',
          ]),
        },
        rows: st.activities.length,
      },
      {
        name: 'rest-periods.json',
        about: 'Planned rest, illness and vacation windows.',
        content: { kind: 'json', value: st.restPeriods },
        rows: st.restPeriods.length,
      },
      {
        name: 'gyms.json',
        about: 'Your saved gyms (name, place, equipment you ticked).',
        content: { kind: 'json', value: st.gyms },
        rows: st.gyms.length,
      },
      {
        name: 'goals-and-settings.json',
        about: 'Goals, home sets, training history, units.',
        content: {
          kind: 'json',
          value: { goals: st.goals, home: st.home, mastery: st.mastery, weightUnit: st.weightUnit },
        },
      },
    ],
  };
}

export function buildAtlas(s: ExportSources): CategoryResult {
  const chat = s.chat
    .filter((m) => !m.pending)
    .map((m) => ({
      id: m.id,
      at: m.at,
      atIso: isoTime(m.at),
      from: m.from,
      text: m.text,
      ...(m.ai ? { ai: m.ai } : {}),
      ...(m.notice ? { notice: true } : {}),
    }));
  const files: CategoryResult['files'] = [
    {
      name: 'chat.json',
      about:
        'The Atlas chat kept on this device (the last 100 messages). May contain health details you typed.',
      content: { kind: 'json', value: chat },
      rows: chat.length,
    },
  ];
  if (s.store)
    files.push({
      name: 'atlas-settings.json',
      about:
        'Atlas settings, what you told Atlas (memory) and its plan. May contain health details you typed.',
      content: { kind: 'json', value: s.store.coach },
    });
  return {
    id: 'atlas',
    files,
    missing: s.store ? [] : [{ item: 'Atlas settings and memory', reason: 'not-loaded' }],
  };
}
