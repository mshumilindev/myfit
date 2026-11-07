/**
 * XS shortcuts — one-tap actions on Today (design library › Shortcuts XS).
 * Ids: `sc:today`, `sc:home-set`, `sc:log-past`, `sc:sleep`, `sc:weigh`,
 * `sc:act:<activity type>` for any of the 34 activities.
 */
import type { ReactNode } from 'react';
import { ShortcutTile, type ShortcutState } from '../components/ui/ShortcutTile';
import type { Tone } from '../components/ui/tones';
import { ACTIVITY_TYPES, activityType } from '../activities';
import { dayKey, type StoreState } from '../store';
import type { WidgetCtx } from './registry';
import { setHash } from '../route';
import { useAddonAvailable } from '../addons/enabledSet';

export interface ShortcutCtx extends WidgetCtx {
  startToday: (() => void) | null;
  logPast: () => void;
}

export interface ShortcutDef {
  id: string;
  group: 'train' | 'activity' | 'health';
  icon: string;
  tone: Tone;
  primary?: boolean;
  label: (ctx: ShortcutCtx) => string;
  run: (ctx: ShortcutCtx) => void;
  state?: (ctx: ShortcutCtx) => { state: ShortcutState; meta?: ReactNode };
}

const catTone = (type: string): Tone => {
  const a = activityType(type);
  if (a?.sport) return 'sport';
  // Same colour families as History: sport green, recovery blue, conditioning orchid.
  return a?.category === 'recovery' ? 'rest' : 'conditioning';
};

const BASE: ShortcutDef[] = [
  {
    id: 'sc:today',
    group: 'train',
    icon: 'play',
    tone: 'accent',
    primary: true,
    label: ({ tw }) => tw.todaysDay,
    run: (c) => (c.startToday ? c.startToday() : c.shell.openStart()),
  },
  {
    id: 'sc:auto',
    group: 'train',
    icon: 'lightning',
    tone: 'accent',
    label: ({ tw }) => tw.scAuto,
    run: (c) => c.shell.openStart(),
  },
  {
    id: 'sc:home-set',
    group: 'train',
    icon: 'house',
    tone: 'accent',
    label: ({ t }) => t.homeSetTitle,
    run: (c) => c.shell.openStart(),
  },
  {
    id: 'sc:log-past',
    group: 'train',
    icon: 'clock-counter-clockwise',
    tone: 'neutral',
    label: ({ t }) => t.todayLogPastShort,
    run: (c) => c.logPast(),
  },
  {
    id: 'sc:sleep',
    group: 'health',
    icon: 'moon',
    tone: 'sleep',
    label: ({ tw }) => tw.logSleepShort,
    run: (c) => c.shell.openOverlay({ screen: 'sleep', mode: 'backfill' }),
  },
  {
    id: 'sc:active-rest',
    group: 'health',
    icon: 'person-simple-walk',
    tone: 'rest',
    label: ({ tw }) => tw.scActiveRest,
    run: (c) =>
      c.shell.openOverlay({
        screen: 'health',
        form: { kind: 'new', ctx: 'start', type: 'active' },
      }),
  },
  {
    id: 'sc:day-off',
    group: 'health',
    icon: 'airplane-tilt',
    tone: 'rest',
    label: ({ tw }) => tw.scDayOff,
    run: (c) =>
      c.shell.openOverlay({ screen: 'health', form: { kind: 'new', ctx: 'start', type: 'off' } }),
  },
  {
    id: 'sc:unwell',
    group: 'health',
    icon: 'thermometer-simple',
    tone: 'illness',
    label: ({ tw }) => tw.scUnwell,
    run: (c) =>
      c.shell.openOverlay({
        screen: 'health',
        form: { kind: 'new', ctx: 'start', type: 'illness' },
      }),
  },
  {
    id: 'sc:injury',
    group: 'health',
    icon: 'bandaids',
    tone: 'injury',
    label: ({ tw }) => tw.scInjury,
    run: (c) =>
      c.shell.openOverlay({
        screen: 'health',
        form: { kind: 'new', ctx: 'start', type: 'injury' },
      }),
  },
  {
    id: 'sc:next-lesson',
    group: 'health',
    icon: 'graduation-cap',
    tone: 'learn',
    label: ({ tw }) => tw.scNextLesson,
    run: () => {
      setHash('#/learn');
    },
  },
  {
    id: 'sc:ask-atlas',
    group: 'health',
    icon: 'sparkle',
    tone: 'atlas',
    label: ({ tw }) => tw.scAskAtlas,
    run: (c) => c.shell.openOverlay({ screen: 'coach' }),
  },
  {
    id: 'sc:weigh',
    group: 'health',
    icon: 'scales',
    tone: 'neutral',
    label: ({ tw }) => tw.weighIn,
    run: (c) => c.openWeight(),
  },
];

const ACTS: ShortcutDef[] = ACTIVITY_TYPES.map((a) => ({
  id: `sc:act:${a.key}`,
  group: 'activity' as const,
  icon: a.icon,
  tone: catTone(a.key),
  label: ({ t }) => t.actType[a.key] ?? a.key,
  run: (c) => c.shell.openOverlay({ screen: 'activity', newType: a.key }),
  state: ({ store, now }) => {
    const live = store.activities.find((x) => x.type === a.key && x.finishedAt === null);
    if (live) {
      const min = Math.max(0, Math.round((now - live.startedAt) / 60000));
      return { state: 'live', meta: `${min} min` };
    }
    const done = store.activities.some(
      (x) => x.type === a.key && x.finishedAt !== null && dayKey(x.startedAt) === dayKey(now),
    );
    return { state: done ? 'done' : 'default' };
  },
}));

export const SHORTCUTS: ShortcutDef[] = [...BASE, ...ACTS];
const BY_ID = new Map(SHORTCUTS.map((s) => [s.id, s]));
export function shortcutById(id: string): ShortcutDef | undefined {
  return BY_ID.get(id);
}

export function renderShortcut(
  def: ShortcutDef,
  ctx: ShortcutCtx,
  selected = false,
  onClick?: () => void,
) {
  const st = def.state?.(ctx) ?? { state: 'default' as ShortcutState };
  return (
    <ShortcutTile
      label={def.label(ctx)}
      icon={def.icon}
      tone={def.tone}
      primary={def.primary}
      state={selected ? 'selected' : st.state}
      meta={st.meta}
      onClick={onClick ?? (() => def.run(ctx))}
    />
  );
}

/**
 * Shortcuts that belong to an add-on (SPO-518); everything else (rest, day off, illness, training, Learn…) is core. Rest, illness
 * and day-off forms stay available without Health: they are base per the owner's rule.
 */
export const SHORTCUT_ADDON: Readonly<Record<string, string>> = {
  'sc:sleep': 'sleep',
  'sc:injury': 'injury-log',
  // Rest days and being unwell are Health too (owner 07.11: Health leaves the base entirely).
  'sc:active-rest': 'rest',
  'sc:day-off': 'rest',
  'sc:unwell': 'unwell',
  'sc:ask-atlas': 'atlas',
};
/** The shortcuts this person can use now. A hook: call it before any early return. Saved layouts keep their items either way. */
export function useShortcuts(): readonly ShortcutDef[] {
  const available = useAddonAvailable();
  return SHORTCUTS.filter((x) => {
    // Every `sc:act:*` shortcut belongs to Activities.
    const addon = x.id.startsWith('sc:act:') ? 'activities' : SHORTCUT_ADDON[x.id];
    return !addon || available(addon);
  });
}

/** Activity shortcuts by how often the type was logged, the chosen ids (if any) first. */
export function sortedActs(
  shortcuts: readonly ShortcutDef[],
  activities: StoreState['activities'],
  chosen: readonly string[] = [],
): ShortcutDef[] {
  const freq = new Map<string, number>();
  for (const a of activities) freq.set(a.type, (freq.get(a.type) ?? 0) + 1);
  const rank = (id: string) => (chosen.includes(id) ? 1 : 0);
  return shortcuts
    .filter((x) => x.group === 'activity')
    .sort(
      (a, b) =>
        rank(b.id) - rank(a.id) || (freq.get(b.id.slice(7)) ?? 0) - (freq.get(a.id.slice(7)) ?? 0),
    );
}
