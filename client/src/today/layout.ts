/**
 * Today layout — the Bento model (design "Spotter — Today Configurator", v3).
 *
 * Today is a stack of sections:
 *   - core sections are everything Today had before (status banners, Atlas &
 *     clients, program + week, nudges & reminders, history). They can be moved
 *     and configured, never removed. Status always stays first.
 *   - custom sections are added by the user: a title, a layout (the grid of
 *     slots) and the widgets in those slots.
 *
 * Pure state + a tiny external store cached in localStorage and synced across
 * devices through `users/{uid}/meta/prefs` (see layoutSync.ts, wired in
 * store.ts — same pattern as activityPrefs). Every mutation returns a new object.
 */
import { useSyncExternalStore } from 'react';
import type { SectionLayout } from '../components/ui/WidgetGrid';
import type { WidgetSize } from '../components/ui/Widget';

export type CoreId = 'status' | 'atlas' | 'program' | 'nudges' | 'history';
export const CORE_IDS: CoreId[] = ['status', 'atlas', 'program', 'nudges', 'history'];

/** A widget placed in a slot. `size` follows the slot (XS = shortcut). */
export interface PlacedWidget {
  id: string;
  widget: string;
  size: WidgetSize | 'XS';
}

/* ---------- per-block options (design B6 / A2) ---------- */

export type ProgramStyle = 'compact' | 'standard' | 'detailed';
export interface ProgramOpts {
  style: ProgramStyle;
  /** Mon–Sun status pills under the card. */
  weekPills: boolean;
  /** Today's exercises on the card. */
  exercises: boolean;
  /** Ask which gym before a program day starts (off: the gym you're in, else your last one). */
  gymStep: boolean;
  /** "Log past session" link when today has no plan. */
  logPast: boolean;
}

export type AtlasLayout = 'together' | 'split';
/** `auto` = off when there are no new notes. */
export type AtlasView = 'note' | 'chat' | 'compact' | 'auto';
export type ClientsView = 'stories' | 'list';
export interface AtlasOpts {
  layout: AtlasLayout;
  atlasView: AtlasView;
  clientsView: ClientsView;
  order: 'atlas' | 'clients';
  liveFirst: boolean;
  hideInactive: boolean;
}

/** Every advisory card Today can show, each one switchable. */
export const NUDGE_KINDS = [
  'plan',
  'likely',
  'visit',
  'weigh',
  'analysis',
  'suggest',
  'readiness',
  'energy',
  'playbook',
  'learn',
  'sleep',
] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];
export interface NudgesOpts {
  /** Kinds switched off. */
  off: NudgeKind[];
}

export const HISTORY_DAYS = [3, 5, 7] as const;
export interface HistoryOpts {
  days: (typeof HISTORY_DAYS)[number];
  /** Which view History opens in (the header toggle switches it for the moment). */
  view: 'timeline' | 'calendar';
  /** Calendar: show upcoming planned program days (dashed). */
  planned: boolean;
}

export interface CoreOptsMap {
  atlas: AtlasOpts;
  program: ProgramOpts;
  nudges: NudgesOpts;
  history: HistoryOpts;
}
export type ConfigurableCore = keyof CoreOptsMap;
export type CoreOpts = CoreOptsMap[ConfigurableCore];
export const CONFIGURABLE: ConfigurableCore[] = ['atlas', 'program', 'nudges', 'history'];

/** Defaults = how Today behaved before blocks were configurable. */
export const CORE_DEFAULTS: CoreOptsMap = {
  atlas: {
    layout: 'together',
    atlasView: 'compact',
    clientsView: 'stories',
    order: 'atlas',
    liveFirst: true,
    hideInactive: false,
  },
  program: { style: 'standard', weekPills: true, exercises: false, gymStep: true, logPast: false },
  nudges: { off: [] },
  history: { days: 5, view: 'timeline', planned: true },
};

export function isConfigurable(id: string): id is ConfigurableCore {
  return (CONFIGURABLE as string[]).includes(id);
}

const oneOf = <T>(v: unknown, allowed: readonly T[], def: T): T =>
  allowed.includes(v as T) ? (v as T) : def;
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);

/** Validate stored options field by field; anything missing or wrong falls back to the default. */
export function sanitizeOpts<K extends ConfigurableCore>(id: K, raw: unknown): CoreOptsMap[K] {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = CORE_DEFAULTS[id];
  let out: CoreOpts;
  if (id === 'atlas') {
    const a = d as AtlasOpts;
    out = {
      layout: oneOf(r.layout, ['together', 'split'] as const, a.layout),
      atlasView: oneOf(r.atlasView, ['note', 'chat', 'compact', 'auto'] as const, a.atlasView),
      clientsView: oneOf(r.clientsView, ['stories', 'list'] as const, a.clientsView),
      order: oneOf(r.order, ['atlas', 'clients'] as const, a.order),
      liveFirst: bool(r.liveFirst, a.liveFirst),
      hideInactive: bool(r.hideInactive, a.hideInactive),
    } satisfies AtlasOpts;
  } else if (id === 'program') {
    const p = d as ProgramOpts;
    out = {
      style: oneOf(r.style, ['compact', 'standard', 'detailed'] as const, p.style),
      weekPills: bool(r.weekPills, p.weekPills),
      exercises: bool(r.exercises, p.exercises),
      gymStep: bool(r.gymStep, p.gymStep),
      logPast: bool(r.logPast, p.logPast),
    } satisfies ProgramOpts;
  } else if (id === 'nudges') {
    const off = Array.isArray(r.off) ? r.off : [];
    out = { off: NUDGE_KINDS.filter((k) => off.includes(k)) } satisfies NudgesOpts;
  } else {
    const h = d as HistoryOpts;
    out = {
      days: oneOf(r.days, HISTORY_DAYS, h.days),
      view: oneOf(r.view, ['timeline', 'calendar'] as const, h.view),
      planned: typeof r.planned === 'boolean' ? r.planned : h.planned,
    } satisfies HistoryOpts;
  }
  return out as CoreOptsMap[K];
}

const sameOpts = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface CoreSection {
  id: CoreId;
  kind: 'core';
  /** Block options (configurable blocks only); absent = defaults. */
  opts?: CoreOpts;
}

export interface CustomSection {
  id: string;
  kind: 'custom';
  title: string;
  layout: SectionLayout;
  items: PlacedWidget[];
}

export type TodaySection = CoreSection | CustomSection;

export interface TodayLayout {
  v: 1;
  sections: TodaySection[];
  updatedAt: number;
}

export const DEFAULT_LAYOUT: TodayLayout = {
  v: 1,
  sections: CORE_IDS.map((id) => ({ id, kind: 'core' as const })),
  updatedAt: 0,
};

/** The size a slot gives a widget, per layout and slot index. */
export function slotSize(layout: SectionLayout, index: number): WidgetSize | 'XS' {
  switch (layout) {
    case 'shortcuts':
      return 'XS';
    case 'pair':
    case 'quad':
      return 'S';
    case 'rows':
      return 'M';
    case 'wide':
      return 'L';
    case 'wide-pair':
      return index === 0 ? 'L' : 'S';
    case 'big':
      return 'XL';
  }
}

/** How many widgets a layout holds (shortcuts and rows are ranges; this is the max). */
export function slotCount(layout: SectionLayout): number {
  switch (layout) {
    case 'shortcuts':
      return 8;
    case 'pair':
      return 2;
    case 'quad':
      return 4;
    case 'rows':
      return 5;
    case 'wide':
      return 1;
    case 'wide-pair':
      return 3;
    case 'big':
      return 1;
  }
}

/** Make sure the core sections are all there once, and Status leads. */
export function normalize(layout: TodayLayout): TodayLayout {
  const seen = new Set<string>();
  const sections: TodaySection[] = [];
  for (const s of layout.sections) {
    if (seen.has(s.id)) continue;
    if (s.kind === 'core' && !CORE_IDS.includes(s.id)) continue;
    seen.add(s.id);
    sections.push(s.kind === 'core' ? normalizeCore(s) : resize(s));
  }
  for (const id of CORE_IDS) {
    if (!seen.has(id)) sections.push({ id, kind: 'core' });
  }
  const status = sections.findIndex((s) => s.id === 'status');
  if (status > 0) sections.unshift(...sections.splice(status, 1));
  return { ...layout, sections };
}

/** Keep only valid options, and none at all when they equal the defaults. */
function normalizeCore(s: CoreSection): CoreSection {
  if (s.opts === undefined) return s;
  const { opts, ...rest } = s;
  if (!isConfigurable(s.id)) return rest;
  const clean = sanitizeOpts(s.id, opts);
  if (sameOpts(clean, CORE_DEFAULTS[s.id])) return rest;
  return sameOpts(clean, opts) ? s : { ...rest, opts: clean };
}

/** A core block's options, defaults filled in. */
export function coreOpts<K extends ConfigurableCore>(layout: TodayLayout, id: K): CoreOptsMap[K] {
  const s = layout.sections.find((x) => x.kind === 'core' && x.id === id);
  return sanitizeOpts(id, s?.kind === 'core' ? s.opts : undefined);
}

/** Change some options of a core block (`null` resets it to the defaults). */
export function setCoreOpts<K extends ConfigurableCore>(
  layout: TodayLayout,
  id: K,
  patch: Partial<CoreOptsMap[K]> | null,
  now = Date.now(),
): TodayLayout {
  const next = patch === null ? CORE_DEFAULTS[id] : { ...coreOpts(layout, id), ...patch };
  const clean = sanitizeOpts(id, next);
  return {
    ...layout,
    updatedAt: now,
    sections: layout.sections.map((s) => {
      if (s.kind !== 'core' || s.id !== id) return s;
      const { opts: _drop, ...rest } = s;
      void _drop;
      return sameOpts(clean, CORE_DEFAULTS[id]) ? rest : { ...rest, opts: clean };
    }),
  };
}

/** Move a section up (-1) or down (+1). Status can't move and nothing passes above it. */
export function moveSection(
  layout: TodayLayout,
  id: string,
  dir: -1 | 1,
  now = Date.now(),
): TodayLayout {
  const i = layout.sections.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || id === 'status' || j < 1 || j >= layout.sections.length) return layout;
  const sections = layout.sections.slice();
  [sections[i], sections[j]] = [sections[j], sections[i]];
  return { ...layout, sections, updatedAt: now };
}

/** Put a section at an index (desktop drag & drop). */
export function placeSection(
  layout: TodayLayout,
  id: string,
  index: number,
  now = Date.now(),
): TodayLayout {
  if (id === 'status') return layout;
  const from = layout.sections.findIndex((s) => s.id === id);
  if (from < 0) return layout;
  const sections = layout.sections.slice();
  const [s] = sections.splice(from, 1);
  sections.splice(Math.max(1, Math.min(index, sections.length)), 0, s);
  return { ...layout, sections, updatedAt: now };
}

export function addSection(
  layout: TodayLayout,
  section: Omit<CustomSection, 'kind' | 'items'> & { items?: PlacedWidget[] },
  afterId?: string,
  now = Date.now(),
): TodayLayout {
  const s: CustomSection = { kind: 'custom', items: [], ...section };
  const sections = layout.sections.slice();
  const at = afterId ? sections.findIndex((x) => x.id === afterId) + 1 : sections.length;
  sections.splice(Math.max(1, at || sections.length), 0, s);
  return { ...layout, sections, updatedAt: now };
}

/** Remove a custom section. Core sections can't be removed. */
export function removeSection(layout: TodayLayout, id: string, now = Date.now()): TodayLayout {
  const s = layout.sections.find((x) => x.id === id);
  if (!s || s.kind === 'core') return layout;
  return { ...layout, sections: layout.sections.filter((x) => x.id !== id), updatedAt: now };
}

function updateCustom(
  layout: TodayLayout,
  id: string,
  fn: (s: CustomSection) => CustomSection,
  now: number,
): TodayLayout {
  return {
    ...layout,
    updatedAt: now,
    sections: layout.sections.map((s) => (s.kind === 'custom' && s.id === id ? fn(s) : s)),
  };
}

/** Shortcut ids (`sc:…`) live only in a Shortcuts section; widgets only elsewhere. */
export const isShortcutId = (widget: string) => widget.startsWith('sc:');
/** An empty slot kept in place (fixed layouts), so later widgets don't shift. */
export const HOLE = '';
export const isHole = (widget: string) => widget === HOLE;
export const fitsLayout = (layout: SectionLayout, widget: string) =>
  isHole(widget) || (layout === 'shortcuts') === isShortcutId(widget);
/** Shortcuts and Rows flow (items close up); the others keep fixed positions. */
const flows = (layout: SectionLayout) => layout === 'shortcuts' || layout === 'rows';

/** What switching a section to `next` would do to its items: which stay, and how
 *  many go because they're the wrong kind (shortcut ↔ widget) or don't fit. */
export function layoutChange(s: CustomSection, next: SectionLayout) {
  let compatible = s.items.filter((w) => fitsLayout(next, w.widget));
  if (flows(next)) compatible = compatible.filter((w) => !isHole(w.widget));
  const kept = compatible.slice(0, slotCount(next));
  // Trailing holes carry nothing.
  while (kept.length && isHole(kept[kept.length - 1].widget)) kept.pop();
  const real = (xs: PlacedWidget[]) => xs.filter((w) => !isHole(w.widget)).length;
  return {
    kept,
    wrongKind: real(s.items) - real(s.items.filter((w) => fitsLayout(next, w.widget))),
    overflow: real(compatible) - real(kept),
  };
}

/** Sizes follow the slots: re-derive after any change of order or layout.
 *  Items of the wrong kind for the layout are dropped (they could never render). */
function resize(s: CustomSection): CustomSection {
  return {
    ...s,
    items: layoutChange(s, s.layout).kept.map((w, i) => ({
      ...w,
      size: slotSize(s.layout, i),
    })),
  };
}

export function setWidget(
  layout: TodayLayout,
  sectionId: string,
  slot: number,
  widget: string,
  id: string,
  now = Date.now(),
): TodayLayout {
  return updateCustom(
    layout,
    sectionId,
    (s) => {
      const items = s.items.slice();
      const w: PlacedWidget = { id, widget, size: slotSize(s.layout, slot) };
      if (!flows(s.layout))
        while (items.length < slot)
          items.push({
            id: `${id}-h${items.length}`,
            widget: HOLE,
            size: slotSize(s.layout, items.length),
          });
      if (slot < items.length) items[slot] = w;
      else items.push(w);
      return resize({ ...s, items });
    },
    now,
  );
}

export function removeWidget(
  layout: TodayLayout,
  sectionId: string,
  widgetId: string,
  now = Date.now(),
): TodayLayout {
  return updateCustom(
    layout,
    sectionId,
    (s) =>
      resize({
        ...s,
        // Fixed layouts leave a hole so the other widgets keep their slots.
        items: flows(s.layout)
          ? s.items.filter((w) => w.id !== widgetId)
          : s.items.map((w) => (w.id === widgetId ? { ...w, widget: HOLE } : w)),
      }),
    now,
  );
}

export function moveWidget(
  layout: TodayLayout,
  sectionId: string,
  widgetId: string,
  dir: -1 | 1,
  now = Date.now(),
): TodayLayout {
  return updateCustom(
    layout,
    sectionId,
    (s) => {
      const i = s.items.findIndex((w) => w.id === widgetId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.items.length) return s;
      const items = s.items.slice();
      [items[i], items[j]] = [items[j], items[i]];
      return resize({ ...s, items });
    },
    now,
  );
}

/** Drag & drop inside a section: move an item to slot `to`. Flowing layouts
 *  (Shortcuts, Rows) close up — the item is taken out and put back at `to`;
 *  fixed layouts swap it with whatever sits in slot `to` (a widget or an empty
 *  slot), so every other widget keeps its place. */
export function placeWidget(
  layout: TodayLayout,
  sectionId: string,
  widgetId: string,
  to: number,
  now = Date.now(),
): TodayLayout {
  const sec = layout.sections.find((x) => x.kind === 'custom' && x.id === sectionId);
  if (!sec || sec.kind !== 'custom') return layout;
  const i = sec.items.findIndex((w) => w.id === widgetId);
  const last = flows(sec.layout) ? sec.items.length - 1 : slotCount(sec.layout) - 1;
  if (i < 0 || to < 0 || to > last || to === i) return layout;
  return updateCustom(
    layout,
    sectionId,
    (s) => {
      const items = s.items.slice();
      if (flows(s.layout)) {
        const [w] = items.splice(i, 1);
        items.splice(to, 0, w);
      } else {
        while (items.length <= to)
          items.push({
            id: `${widgetId}-h${items.length}`,
            widget: HOLE,
            size: slotSize(s.layout, items.length),
          });
        [items[i], items[to]] = [items[to], items[i]];
      }
      return resize({ ...s, items });
    },
    now,
  );
}

/** Where `widget` would go in a section when added without a slot (a click in
 *  the desktop "Add to Today" panel): the first empty slot, or -1 when it's the
 *  wrong kind for the section, the section is full, or the shortcut is already
 *  there. */
export function freeSlot(s: CustomSection, widget: string): number {
  if (isHole(widget) || !fitsLayout(s.layout, widget)) return -1;
  if (s.layout === 'shortcuts' && s.items.some((w) => w.widget === widget)) return -1;
  const max = slotCount(s.layout);
  if (!flows(s.layout)) {
    const hole = s.items.findIndex((w) => isHole(w.widget));
    if (hole >= 0) return hole;
  }
  return s.items.length < max ? s.items.length : -1;
}

/** Add an item to a flowing section (Shortcuts, Rows) at `index` — the end
 *  when omitted — shifting the rest along. Refused (layout returned as is) when
 *  the section is full, the item is the wrong kind, or the shortcut is already
 *  in it. Fixed layouts take items through `setWidget` instead. */
export function insertWidget(
  layout: TodayLayout,
  sectionId: string,
  widget: string,
  id: string,
  index?: number,
  now = Date.now(),
): TodayLayout {
  const sec = layout.sections.find((x) => x.kind === 'custom' && x.id === sectionId);
  if (!sec || sec.kind !== 'custom' || !flows(sec.layout) || freeSlot(sec, widget) < 0)
    return layout;
  return updateCustom(
    layout,
    sectionId,
    (s) => {
      const items = s.items.slice();
      const at = Math.max(0, Math.min(index ?? items.length, items.length));
      items.splice(at, 0, { id, widget, size: slotSize(s.layout, at) });
      return resize({ ...s, items });
    },
    now,
  );
}

export function setSectionMeta(
  layout: TodayLayout,
  id: string,
  meta: { title?: string; layout?: SectionLayout },
  now = Date.now(),
): TodayLayout {
  return updateCustom(layout, id, (s) => resize({ ...s, ...meta }), now);
}

/* ---------- store ---------- */

const KEY = 'spotter.todayLayout';

function load(): TodayLayout {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as TodayLayout;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.sections)) return DEFAULT_LAYOUT;
    return normalize(parsed);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

let current: TodayLayout = load();
const listeners = new Set<() => void>();
/** Local edits only (not synced values) — the cloud push hooks in here. */
const localListeners = new Set<(layout: TodayLayout) => void>();

const sameSections = (a: TodayLayout, b: TodayLayout) =>
  JSON.stringify(a.sections) === JSON.stringify(b.sections);

function commit(next: TodayLayout): void {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode / quota — ignore */
  }
  listeners.forEach((l) => l());
}

export function getTodayLayout(): TodayLayout {
  return current;
}

/** A user edit: saved locally right away, then pushed to the cloud (when signed in). */
export function setTodayLayout(next: TodayLayout): void {
  const clean = normalize(next);
  if (sameSections(clean, current) && clean.updatedAt === current.updatedAt) return;
  // A local edit must beat the value it replaced, whatever stamp it carries.
  const updatedAt =
    clean.updatedAt > current.updatedAt
      ? clean.updatedAt
      : Math.max(Date.now(), current.updatedAt + 1);
  commit({ ...clean, updatedAt });
  localListeners.forEach((l) => l(current));
}

/**
 * A synced value (another device / the cloud copy). Normalized, applied only
 * when it isn't older than what we have, and never echoed back to the cloud.
 * Returns whether it was applied.
 */
export function applyRemoteTodayLayout(remote: TodayLayout): boolean {
  if (remote.updatedAt < current.updatedAt) return false;
  const clean = normalize(remote);
  if (sameSections(clean, current) && clean.updatedAt === current.updatedAt) return false;
  commit(clean);
  return true;
}

/** Subscribe to local edits (not synced values). */
export function onTodayLayoutLocalChange(fn: (layout: TodayLayout) => void): () => void {
  localListeners.add(fn);
  return () => {
    localListeners.delete(fn);
  };
}

/** Sign-out / wipe: back to the defaults, without touching the cloud copy. */
export function resetTodayLayout(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  current = DEFAULT_LAYOUT;
  listeners.forEach((l) => l());
}

export function useTodayLayout(): TodayLayout {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}
