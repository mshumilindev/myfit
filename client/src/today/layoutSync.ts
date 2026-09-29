/**
 * Cloud sync of the Today layout — same pattern and doc as the activity prefs
 * (activityPrefs.ts + store.ts): the layout rides on `users/{uid}/meta/prefs`
 * as its own last-write-wins field pair
 *
 *   todayLayout          — { v: 1, sections }
 *   todayLayoutUpdatedAt — the layout's `updatedAt`
 *
 * written with `{ merge: true }` so it never clobbers the other settings.
 * localStorage (layout.ts) stays the working copy: signed out or offline the
 * layout keeps working, and on the next snapshot the newer side wins — a newer
 * cloud copy is applied locally (always through `normalize`), a newer local one
 * is pushed. Synced values go through `applyRemoteTodayLayout`, which doesn't
 * notify the local-edit listeners, so they are never echoed back.
 *
 * Pure (no Firebase import): store.ts owns the listener and the write, so the
 * widget library / Storybook can import layout.ts without touching Firestore.
 */
import type { SectionLayout } from '../components/ui/WidgetGrid';
import {
  applyRemoteTodayLayout,
  getTodayLayout,
  normalize,
  onTodayLayoutLocalChange,
  type PlacedWidget,
  type TodayLayout,
  type TodaySection,
} from './layout';

export const LAYOUT_FIELD = 'todayLayout';
export const LAYOUT_STAMP_FIELD = 'todayLayoutUpdatedAt';

const LAYOUTS: SectionLayout[] = ['shortcuts', 'pair', 'quad', 'rows', 'wide', 'wide-pair', 'big'];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

function sectionFromDoc(raw: unknown): TodaySection | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  if (raw.kind === 'core') {
    // Unknown core ids and bad options are dropped / repaired by normalize().
    return (
      isObj(raw.opts) ? { id: raw.id, kind: 'core', opts: raw.opts } : { id: raw.id, kind: 'core' }
    ) as TodaySection;
  }
  if (raw.kind !== 'custom' || !LAYOUTS.includes(raw.layout as SectionLayout)) return null;
  const items: PlacedWidget[] = (Array.isArray(raw.items) ? raw.items : [])
    .filter(
      (w): w is Record<string, unknown> =>
        isObj(w) && typeof w.id === 'string' && typeof w.widget === 'string',
    )
    .map((w) => ({ id: w.id as string, widget: w.widget as string, size: 'S' }));
  return {
    id: raw.id,
    kind: 'custom',
    title: typeof raw.title === 'string' ? raw.title : '',
    layout: raw.layout as SectionLayout,
    items,
  };
}

/** Read the synced layout off the prefs doc (null when the field is missing or unusable). */
export function layoutFromDoc(data: Record<string, unknown>): TodayLayout | null {
  const raw = data[LAYOUT_FIELD];
  if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.sections)) return null;
  const at = data[LAYOUT_STAMP_FIELD];
  const sections = raw.sections.map(sectionFromDoc).filter((s): s is TodaySection => !!s);
  return normalize({ v: 1, sections, updatedAt: typeof at === 'number' ? at : 0 });
}

/** The prefs-doc fields for a layout (plain JSON — Firestore rejects `undefined`). */
export function layoutToDoc(layout: TodayLayout): Record<string, unknown> {
  const sections = JSON.parse(JSON.stringify(layout.sections)) as unknown;
  return {
    [LAYOUT_FIELD]: { v: 1, sections },
    [LAYOUT_STAMP_FIELD]: layout.updatedAt || Date.now(),
  };
}

const sameSections = (a: TodayLayout, b: TodayLayout) =>
  JSON.stringify(a.sections) === JSON.stringify(b.sections);

/**
 * Last-write-wins by `updatedAt` (`remote` is null when the field is missing).
 * `apply` → adopt the synced layout; `push` → the local one is newer (e.g.
 * edited offline or before sign-in) and should be written. Same rule as
 * `reconcileListPref`: on a tie the synced copy wins for stability.
 */
export function reconcileTodayLayout(
  local: TodayLayout,
  remote: TodayLayout | null,
): { apply: TodayLayout | null; push: boolean } {
  if (!remote) return { apply: null, push: local.updatedAt > 0 };
  if (remote.updatedAt > local.updatedAt) return { apply: remote, push: false };
  if (local.updatedAt > remote.updatedAt) return { apply: null, push: true };
  return { apply: sameSections(local, remote) ? null : remote, push: false };
}

export type PrefsWriter = (fields: Record<string, unknown>) => void;

/** Handle a prefs-doc snapshot: apply a newer cloud layout, or push a newer local one. */
export function syncTodayLayoutFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  const { apply, push } = reconcileTodayLayout(getTodayLayout(), layoutFromDoc(data));
  if (apply) applyRemoteTodayLayout(apply);
  if (push) write(layoutToDoc(getTodayLayout()));
}

/** Push every local edit (synced values don't fire this, so nothing echoes). */
export function pushTodayLayoutEdits(write: PrefsWriter): () => void {
  return onTodayLayoutLocalChange((layout) => write(layoutToDoc(layout)));
}
