/**
 * Starter sets offered in onboarding (SPO-500 I5): one question, a few ready sets, the recommended one preselected.
 * Pure data + rules; the step and the Today invite read it. Only items the role may actually enable are ever applied
 * (`enableAddons` drops the rest), so a stale or edited id never breaks anything.
 */
import type { Role } from '../api';
import type { Tone } from '../components/ui/tones';
import { ADDONS } from './manifest';
import { isAddonAllowed, isAddonBase, storeRole } from './enabledSet';

export interface StarterPack {
  id: 'train' | 'recover' | 'goal' | 'coach' | 'both' | 'min';
  icon: string;
  tone: Tone;
  /** Items the set switches on (parents come along). Empty = the base only. */
  ids: readonly string[];
  recommended?: boolean;
}

const MEMBER: readonly StarterPack[] = [
  { id: 'train', icon: 'barbell', tone: 'accent', ids: [], recommended: true },
  { id: 'recover', icon: 'moon', tone: 'sleep', ids: ['sleep', 'health'] },
  { id: 'goal', icon: 'target', tone: 'ok', ids: ['goals', 'sleep'] },
];
const COACH: readonly StarterPack[] = [
  {
    id: 'coach',
    icon: 'users',
    tone: 'accent',
    ids: ['coach-live', 'coach-notes', 'gym'],
    recommended: true,
  },
  {
    id: 'both',
    icon: 'barbell',
    tone: 'accent',
    ids: ['coach-live', 'coach-notes', 'sleep', 'gym'],
  },
  { id: 'min', icon: 'clipboard-text', tone: 'neutral', ids: [] },
];

/** The sets for a role; none for a role without a store (manager). Ids the role cannot enable or already has as base are dropped. */
export function packsFor(role: Role): StarterPack[] {
  if (!storeRole(role)) return [];
  const raw = role === 'member' ? MEMBER : COACH;
  return raw.map((p) => ({
    ...p,
    ids: p.ids.filter((id) => isAddonAllowed(id, role) && !isAddonBase(id, role)),
  }));
}

/** Items of a set worth showing a preview for: the first one is the headline. */
export function headlineOf(pack: StarterPack): string | null {
  return pack.ids.find((id) => ADDONS.some((a) => a.id === id && a.kind !== 'module')) ?? null;
}
