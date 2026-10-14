import type { ReactNode } from 'react';
import type { MoreMenuItem } from './MoreMenu';

/**
 * A rail destination that may collapse into the rail's "More" item when the rail is too short.
 * It is also a `MoreMenuItem`, so a hidden entry shows up in the More menu unchanged.
 */
export interface RailEntry extends MoreMenuItem {
  /**
   * Collapse priority: the HIGHER the number, the EARLIER it collapses. Default = its index
   * in the list, so with no priorities the list collapses from the end. Equal numbers
   * collapse later-index first.
   */
  priority?: number;
  /** Spoken after the name when `count` is shown ("3 unread"). */
  countLabel?: string;
  /** `aria-haspopup` for entries that open a dialog / sheet (Apps). */
  popup?: 'dialog';
  /** Live-session dot on the tile (Gym: Today while a workout is open). */
  live?: boolean;
  /** Spoken after the name while `live` is on. */
  liveLabel?: string;
}

/**
 * Fixed rail geometry (px), identical to the rail's CSS (Rail.css, styles.css). Tiles never change
 * size with viewport height: labelled rail 72x64, compact 44, default 46, 5.6px gap (--space-2).
 */
export const RAIL_TILE = { labelled: 64, compact: 44, default: 46 } as const;
export const RAIL_GAP = 5.6;

/**
 * How many of `n` fixed-size tiles stay visible.
 * `room` = the height the nav column would have with NO More tile in the foot (the measured nav
 * height plus the More tile and its gap when it is currently shown).
 *  - all `n` tiles fit in `room` -> `n` (no More);
 *  - otherwise More takes one pitch from the room and k tiles fit in what is left:
 *    k·pitch - gap <= room - pitch.
 * `room <= 0` means "not measured yet" and shows everything.
 */
export function fitCount(room: number, n: number, tile: number, gap = RAIL_GAP): number {
  if (n <= 0 || room <= 0) return n;
  const pitch = tile + gap;
  if (n * pitch - gap <= room + 1e-6) return n;
  const k = Math.floor((room - pitch + gap + 1e-6) / pitch);
  return Math.max(0, Math.min(n - 1, k));
}

/** Splits entries into the visible ones and the collapsed ones, both in original order. */
export function splitEntries<E extends { priority?: number }>(
  entries: E[],
  visibleCount: number,
): { visible: E[]; hidden: E[] } {
  if (visibleCount >= entries.length) return { visible: entries, hidden: [] };
  const order = entries
    .map((e, i) => ({ i, p: e.priority ?? i }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.i);
  const keep = new Set(order.slice(0, Math.max(0, visibleCount)));
  return {
    visible: entries.filter((_, i) => keep.has(i)),
    hidden: entries.filter((_, i) => !keep.has(i)),
  };
}

/**
 * An extra at the BOTTOM of the rail (foot widget: conditions shield, mastery ring, bell,
 * settings, an app's own button). Foot extras are the FIRST things to collapse into More when
 * the rail is too short, ALL AT ONCE; only then do the nav entries
 * start to collapse (from the end). The extras group is all-or-nothing: either every extra is
 * visible or all of them are in More. Apps and the avatar are not entries: they are pinned.
 *  - `count` / `live` of a HIDDEN extra light the More item (a hidden bell with unread shows its
 *    badge on More);
 *  - `node` replaces the default tile for custom widgets (the mastery ring); the More row is
 *    always built from `label` / `icon`.
 */
export interface RailFootEntry extends RailEntry {
  /** Custom tile shown while the entry is visible; default = an icon `RailItem`. */
  node?: ReactNode;
  /** Free-form badge on the default tile (the original bell look); `count` is used when absent. */
  badge?: ReactNode;
  /** Always-filled icon (the bell). */
  fill?: boolean;
}

/** Height of one foot extra (the icon tile; 46 on the unlabelled default rail). */
export const RAIL_EXTRA_TILE = { labelled: 44, compact: 44, default: 46 } as const;

/**
 * Layout of a rail whose nav and foot extras compete for height.
 * `room` = the height available to nav + More + extras with only the pinned foot (Apps, avatar)
 * below them (the measured nav column plus whatever the foot currently spends on extras; the More
 * item lives inside the nav column, so it is already part of the measured height).
 *  - everything fits -> all nav entries and all extras, no More;
 *  - otherwise More appears (right below the last visible nav entry, taking one nav pitch) and the
 *    foot extras go into it ALL AT ONCE: as soon as one extra does not fit none is shown (no
 *    one-by-one hiding). Only when the whole extras group is hidden and the nav still does not
 *    fit next to More do nav entries collapse, from the end.
 * `room <= 0` means "not measured yet" and shows everything.
 */
export function fitLayout(
  room: number,
  nav: number,
  tile: number,
  extras: number,
  extraTile: number,
  gap = RAIL_GAP,
): { nav: number; extras: number } {
  if (room <= 0) return { nav, extras };
  const p = tile + gap;
  const q = extraTile + gap;
  const navFull = nav > 0 ? nav * p - gap : 0;
  const eps = 1e-6;
  if (navFull + extras * q <= room + eps) return { nav, extras };
  const rest = room - p; // More takes a nav pitch
  if (rest + eps >= navFull) return { nav, extras: 0 };
  return { nav: Math.max(0, Math.min(nav - 1, Math.floor((rest + gap + eps) / p))), extras: 0 };
}
