/**
 * Atlas answers that respect long-term limits ("can I squat today?", "is it ok to train legs?").
 * Privacy: a condition is never named in chat text. Wording stays at the level of effects
 * ("your limits say ..."); the limits themselves come from conditions.ts on this device.
 */
import { conditionLimits, exerciseFlag, NO_LIMITS, type Limits } from '../conditions';
import { muscleInfoByName, searchCatalog, type MuscleGroup } from '../data/exercises';
import type { RiskTag } from '../data/conditionCatalog';
import { isSupported, swapCandidates } from '../swaps';
import { exerciseNeeds } from '../store';
import type { AskCtx, Intent, Tr } from './intentKit';

const TAG_WORDS: Record<string, [string, string]> = {
  axial: ['heavy loading of the spine', 'важке навантаження на хребет'],
  shear: ['forward-bent loaded positions', 'навантаження в нахилі'],
  flexion: ['spinal flexion', 'згинання хребта'],
  extension: ['spinal extension', 'розгинання хребта'],
  rotation: ['twisting', 'скручування'],
  impact: ['impact and jumping', 'удари та стрибки'],
  overhead: ['overhead work', 'робота над головою'],
  valsalva: ['breath-holding heavy lifts', 'важкі підходи із затримкою дихання'],
  deep_knee: ['deep knee bend', 'глибоке згинання колін'],
  hang: ['hanging from the arms', 'висіння на руках'],
  wrist_load: ['load through the wrists', 'навантаження на зап’ястя'],
  inversion: ['head-down positions', 'положення головою вниз'],
  high_cardio: ['high-intensity cardio', 'інтенсивне кардіо'],
};

/** The person's stacked limits (empty when none or not in the context). */
export function limitsOf(c: AskCtx): Limits {
  const list = c.s.conditions;
  return list?.length ? conditionLimits(list, c.now) : NO_LIMITS;
}

const tagText = (tags: readonly RiskTag[], L: Tr): string =>
  tags
    .map((t) => TAG_WORDS[t])
    .filter(Boolean)
    .map((w) => L(w[0], w[1]))
    .join(', ');

/** Safer same-muscle lifts (limits already filtered out). */
function saferLifts(c: AskCtx, name: string, limits: Limits): string[] {
  const gym = c.s.gyms?.[0] ?? null;
  return swapCandidates(name, gym, 3, limits).map((x) => c.fmt.exercise(x.name));
}

function saferForMuscle(c: AskCtx, m: MuscleGroup, limits: Limits): string[] {
  const ok = searchCatalog('', 400, undefined, m)
    .map((e) => e.names[0])
    .filter((n) => muscleInfoByName(n)?.primary === m && exerciseFlag(n, limits).level === 'ok');
  const rank = (n: string) => (isSupported(n, exerciseNeeds(n)) ? 0 : 1);
  return [...ok]
    .sort((x, y) => rank(x) - rank(y))
    .slice(0, 3)
    .map((n) => c.fmt.exercise(n));
}

/** Tags that rule out (avoid) at least one main lift of the muscle. */
function avoidedTags(m: MuscleGroup, limits: Limits): RiskTag[] {
  const tags = new Set<RiskTag>();
  for (const e of searchCatalog('', 400, undefined, m)) {
    const n = e.names[0];
    if (muscleInfoByName(n)?.primary !== m) continue;
    const f = exerciseFlag(n, limits);
    if (f.level === 'avoid') f.tags.forEach((t) => tags.add(t));
  }
  return [...tags];
}

/**
 * One line for a lift under the limits: null when nothing applies (so callers add nothing).
 * 'avoid' → not advised + swaps; 'caution' → be careful.
 */
export function limitNoteForLift(c: AskCtx, exercise: string, L: Tr): string | null {
  const limits = limitsOf(c);
  if (!limits.keys.length) return null;
  const f = exerciseFlag(exercise, limits);
  const name = c.fmt.exercise(exercise);
  const why = tagText(f.tags, L);
  if (f.level === 'avoid') {
    const alt = saferLifts(c, exercise, limits);
    const tail = alt.length
      ? L(
          ` Safer for the same muscle: ${alt.join(', ')}.`,
          ` Безпечніше на той самий м’яз: ${alt.join(', ')}.`,
        )
      : '';
    return (
      L(
        `${name} is not advised with your limits${why ? ` (they say to skip ${why})` : ''}.`,
        `${name} не радять з твоїми обмеженнями${why ? ` (вони кажуть уникати: ${why})` : ''}.`,
      ) + tail
    );
  }
  if (f.level === 'caution')
    return L(
      `${name}: be careful, your limits flag it${why ? ` (${why})` : ''}. Keep it light and controlled, stop if anything feels off.`,
      `${name}: обережно, твої обмеження це позначають${why ? ` (${why})` : ''}. Легко й під контролем, зупинись, якщо щось не так.`,
    );
  if (f.level === 'info')
    return L(
      `${name}: your limits cap the load on this muscle, so keep the weight moderate.`,
      `${name}: твої обмеження зменшують навантаження на цей м’яз, тож вага помірна.`,
    );
  return null;
}

/** Same for a whole muscle group (uses the per-muscle load caps). */
export function limitNoteForMuscle(c: AskCtx, m: MuscleGroup, L: Tr): string | null {
  const limits = limitsOf(c);
  const cap = limits.effects.muscleCaps?.[m];
  const name = c.fmt.muscle(m);
  const alt = saferForMuscle(c, m, limits);
  if (cap == null || cap >= 1) {
    // No load cap, but some lifts of this muscle may still be ruled out by movement limits.
    const why = tagText(avoidedTags(m, limits), L);
    if (!limits.keys.length || !why) return null;
    return (
      L(
        `${name}: yes, train it, but skip the lifts with ${why}, your limits advise against them.`,
        `${name}: так, тренуй, але без вправ із таким: ${why}, твої обмеження це не радять.`,
      ) +
      (alt.length
        ? L(` Better picks: ${alt.join(', ')}.`, ` Краще обрати: ${alt.join(', ')}.`)
        : '')
    );
  }
  const tail = alt.length ? L(` Options: ${alt.join(', ')}.`, ` Варіанти: ${alt.join(', ')}.`) : '';
  return cap <= 0
    ? L(
        `${name}: your limits say to leave it out for now.`,
        `${name}: твої обмеження кажуть поки це пропустити.`,
      ) + tail
    : L(
        `${name}: train it, but your limits cap the load at about ${Math.round(cap * 100)}%. Go lighter.`,
        `${name}: тренуй, але твої обмеження знижують навантаження до ~${Math.round(cap * 100)}%. Легше.`,
      ) + tail;
}

/** Phrases of "is it ok to ..." questions. */
const OK_PHRASES = [
  'can i',
  'could i',
  'may i',
  'ok to',
  'okay to',
  'safe to',
  'можна',
  'чи можу',
  'чи варто',
  'чи безпечно',
];

/** True when the question asks whether something is ok/safe to do. */
export const asksIfOk = (phrase: string): boolean => {
  const t = ` ${phrase.toLowerCase()} `;
  return OK_PHRASES.some((w) => t.includes(` ${w} `));
};

export const INTENTS_HEALTH: Intent[] = [
  {
    id: 'ok_with_limits',
    all: [OK_PHRASES],
    neutral: true,
    // Only speaks when limits apply; otherwise the regular answers take over.
    answer: (c, p, L) => {
      if (p.exercise) return limitNoteForLift(c, p.exercise, L);
      if (p.muscle) return limitNoteForMuscle(c, p.muscle, L);
      return null;
    },
    ask: ['Can I squat today?', 'Чи можна мені присідати сьогодні?'],
  },
];
