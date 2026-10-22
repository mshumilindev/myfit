/**
 * Export builder: body, sleep, health and nutrition. Pure. A person's own STORED health data is given back even where
 * the feature has no consent now (GDPR Art. 15 / 20: returning their data to their own device is not processing for the
 * feature, so it needs no re-consent); such parts are labelled in the README as hidden in the app.
 */
import { isoTime } from './csv';
import type {
  CategoryResult,
  ExportFile,
  ExportSources,
  HealthFeatureKey,
  Missing,
} from './exportModel';

const HIDDEN_LABEL: Record<HealthFeatureKey, string> = {
  injuries: 'Injuries',
  chronic: 'Long-term conditions',
  cycle: 'Cycle',
  nicotine: 'Nicotine',
  alcohol: 'Alcohol',
  supplements: 'Supplements',
};

const HIDDEN_NOTE = 'stored; hidden in the app because consent is off';

export function buildBody(s: ExportSources): CategoryResult {
  const missing: Missing[] = [];
  const files: ExportFile[] = [];
  const st = s.store;
  const hidden = s.hiddenHealth.map((f) => HIDDEN_LABEL[f]);
  if (!s.health) missing.push({ item: 'Health data', reason: 'not-loaded' });
  if (!st) {
    missing.push({ item: 'Body and sleep data', reason: 'not-loaded' });
  } else {
    const w = st.bodyMetrics.weights;
    files.push(
      {
        name: 'body.json',
        about: 'Height, composition and weigh-ins.',
        content: { kind: 'json', value: st.bodyMetrics },
      },
      {
        name: 'weigh-ins.csv',
        about: 'One row per weigh-in (kg).',
        content: {
          kind: 'csv',
          header: ['time_utc', 'weight_kg'],
          rows: w.map((x) => [isoTime(x.at), x.weight]),
        },
        rows: w.length,
      },
      {
        name: 'sleep.json',
        about: 'Logged nights and naps.',
        content: { kind: 'json', value: st.sleeps },
        rows: st.sleeps.length,
      },
      {
        name: 'sleep.csv',
        about: 'The same nights as a table.',
        content: {
          kind: 'csv',
          header: ['date', 'bedtime_utc', 'wake_utc', 'quality', 'source'],
          rows: st.sleeps.map((n) => [
            n.date,
            isoTime(n.bedtime),
            isoTime(n.wake),
            n.quality ?? '',
            n.source,
          ]),
        },
        rows: st.sleeps.length,
      },
      {
        name: 'sleep-settings.json',
        about: 'Your sleep rhythm and sleep settings.',
        content: {
          kind: 'json',
          value: { schedule: st.sleepSchedule, settings: st.sleepSettings },
        },
      },
    );
  }
  if (s.health) {
    const h = s.health;
    files.push({
      name: 'health.json',
      about: `Injuries, long-term conditions, cycle, nicotine, alcohol and supplements, as stored. Free-text notes may contain health details you typed.${hidden.length ? ` Hidden in the app now because consent is off, included here because it is your own data (${HIDDEN_NOTE}): ${hidden.join(', ')}.` : ''}`,
      content: {
        kind: 'json',
        value: {
          injuries: h.injuries,
          conditions: h.conditions,
          cycle: h.cycle,
          nicotine: h.nicotine,
          alcohol: h.alcohol,
          supplements: h.supplements,
        },
      },
    });
  }
  if (s.nutrition === null)
    missing.push({ item: 'Nutrition log, foods, goal and profile', reason: 'not-loaded' });
  else {
    const n = s.nutrition;
    const note = n.hidden ? ` Hidden in the app now because consent is off (${HIDDEN_NOTE}).` : '';
    files.push(
      {
        name: 'nutrition.json',
        about: `Food log, your own foods, goal and profile.${note}`,
        content: {
          kind: 'json',
          value: { entries: n.entries, foods: n.foods, goal: n.goal, profile: n.profile },
        },
        rows: n.entries.length,
      },
      {
        name: 'nutrition-log.csv',
        about: `One row per logged meal, snack or drink.${note}`,
        content: {
          kind: 'csv',
          header: ['day', 'logged_at', 'type', 'name', 'kcal', 'protein_g', 'fat_g', 'carbs_g'],
          rows: n.entries.map((e) => [
            e.day,
            e.loggedAt,
            e.type,
            e.name,
            e.macros.kcal,
            e.macros.protein,
            e.macros.fat,
            e.macros.carbs,
          ]),
        },
        rows: n.entries.length,
      },
    );
  }
  return { id: 'body', files, missing };
}
