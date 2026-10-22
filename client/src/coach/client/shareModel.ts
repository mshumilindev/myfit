/**
 * Pure model of the ONE sharing list (SPO-107): ten settings in three groups. Six are the trainer's grants
 * (`SHARE_CATEGORIES`), four are on-device levels published to any coach (`meta/coachShare`). No React, no store.
 * Levels are the stored enum; words and layout live in the screens.
 */
import type { HealthFeature } from '../../legal/consents';
import type { Level } from '../domain/types';
import { LEVELS } from '../domain/types';
import { SHARE_CATEGORIES, type ShareCategory } from './domain';

/** The four settings that live on the device and reach a coach through `meta/coachShare`, not through a grant. */
export const LOCAL_CATEGORIES = ['conditions', 'nicotine', 'alcohol', 'supplements'] as const;
export type LocalCategory = (typeof LOCAL_CATEGORIES)[number];
export type ShareId = ShareCategory | LocalCategory;
export const SHARE_IDS: readonly ShareId[] = [...SHARE_CATEGORIES, ...LOCAL_CATEGORIES];

export type ShareGroupId = 'training' | 'body' | 'life';
/** Order of the page. Nutrition sits in Body (owner decision Q5). */
export const SHARE_GROUPS: readonly { id: ShareGroupId; ids: readonly ShareId[] }[] = [
  { id: 'training', ids: ['totals', 'sets'] },
  { id: 'body', ids: ['body', 'sleep', 'nutrition'] },
  { id: 'life', ids: ['injury', 'conditions', 'nicotine', 'alcohol', 'supplements'] },
];

export const isLocalCategory = (id: ShareId): id is LocalCategory =>
  (LOCAL_CATEGORIES as readonly string[]).includes(id);

export type ShareLevels = Record<ShareId, Level>;
export const allOffLevels = (): ShareLevels =>
  Object.fromEntries(SHARE_IDS.map((k) => [k, 'off'])) as ShareLevels;

/** Alcohol never shares amounts, so it has no Full (owner decision Q2: the others keep Full). */
export function allowedLevels(id: ShareId): readonly Level[] {
  return id === 'alcohol' ? ['off', 'effects'] : LEVELS;
}
/** A level the setting does not offer falls back to Off, like the normaliser and the publisher do (an old build can have stored `full`). */
export const clampLevel = (id: ShareId, l: Level): Level =>
  allowedLevels(id).includes(l) ? l : 'off';

/** The health feature whose consent switches the setting's data on (SPO-290); none for the workout categories. */
export const FEATURE_OF: Partial<Record<ShareId, HealthFeature>> = {
  injury: 'injuries',
  nutrition: 'nutrition',
  conditions: 'chronic',
  nicotine: 'nicotine',
  alcohol: 'alcohol',
  supplements: 'supplements',
};

/** Why a row cannot be shared: its feature has no consent (`off`), or the consent records are not known yet (`pending`). */
export type RowBlock = 'off' | 'pending' | null;
export function rowBlock(
  id: ShareId,
  on: Partial<Record<HealthFeature, boolean>>,
  ready: boolean,
): RowBlock {
  const f = FEATURE_OF[id];
  if (!f) return null;
  if (!ready) return 'pending';
  return on[f] ? null : 'off';
}

export type ShareBlocks = Partial<Record<ShareId, RowBlock>>;

/**
 * What counts as shared. An on-device setting is shared when it is not blocked and above Off (a blocked one publishes
 * nothing, whatever is stored). A trainer GRANT (injury, nutrition, ...) is real on the server whatever the feature switch
 * says, so it counts by its own level even when its row is blocked: the summary and Stop must not hide it.
 */
const isShared = (id: ShareId, levels: ShareLevels, blocks: ShareBlocks = {}): boolean =>
  (isLocalCategory(id) ? !blocks[id] : true) && levels[id] !== 'off';

/** A grant that is still above Off while its feature has no consent: shown as "shared, feature off" and switched off. */
export const isStaleGrant = (id: ShareId, levels: ShareLevels, blocks: ShareBlocks = {}): boolean =>
  !isLocalCategory(id) && blocks[id] === 'off' && levels[id] !== 'off';

export interface ShareSummary {
  effects: ShareId[];
  full: ShareId[];
}
/** Ids by level in the order of the page, for the one summary over all ten settings. */
export function buildSummary(levels: ShareLevels, blocks: ShareBlocks = {}): ShareSummary {
  const ordered = SHARE_GROUPS.flatMap((g) => g.ids).filter((id) => isShared(id, levels, blocks));
  return {
    effects: ordered.filter((id) => levels[id] === 'effects'),
    full: ordered.filter((id) => levels[id] === 'full'),
  };
}
export const sharedCountAll = (levels: ShareLevels, blocks: ShareBlocks = {}): number =>
  SHARE_IDS.filter((id) => isShared(id, levels, blocks)).length;
export const sharesNothingAll = (levels: ShareLevels, blocks: ShareBlocks = {}): boolean =>
  sharedCountAll(levels, blocks) === 0;

/** Stop sharing: every one of the ten settings goes to Off. */
export const stoppedLevels = (): ShareLevels => allOffLevels();

/** The local settings that must be written to Off by Stop sharing (only the ones that are not Off), with what to restore. */
export function localsToStop(
  locals: Record<LocalCategory, Level>,
): Partial<Record<LocalCategory, Level>> {
  const out: Partial<Record<LocalCategory, Level>> = {};
  for (const k of LOCAL_CATEGORIES) if (locals[k] !== 'off') out[k] = locals[k];
  return out;
}
