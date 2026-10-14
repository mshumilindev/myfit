/** Pure helpers of the calendar views (no React): lanes for overlapping blocks, the hour range, block tones. */
import type { Tone } from '../../components/ui/tones';
import { endOf } from './model';
import { minOfTs } from './time';
import type { ScheduleSlot } from './types';

export interface Placed<T> {
  item: T;
  /** first column of the cluster this block sits in (0-based) */
  lane: number;
  /** how many columns the cluster has (the width of one column is 1 / lanes) */
  lanes: number;
  /** how many columns the block spans: it grows right into free columns, like Google / Teams calendar */
  span: number;
  /** index of the overlap cluster in this call (blocks that touch only by an edge are NOT one cluster) */
  cluster: number;
  /** true for the earliest block of a cluster of two or more: where a once-per-cluster marker belongs */
  first: boolean;
  /** size of the cluster */
  size: number;
  top: number;
  height: number;
}

interface Box {
  start: number;
  end: number;
}

/**
 * Column packing for blocks that overlap in time (Google / Teams calendar): a cluster is a chain of blocks that overlap
 * one another; each block takes the first free column, all columns of a cluster are equally wide, and a block then
 * grows to the right across columns that are free for its whole length (no staggered offsets). Blocks that only touch
 * (one ends when the next starts) are not overlapping. `top` / `height` are fractions of the visible range.
 */
export function placeBlocks<T>(
  items: readonly T[],
  box: (t: T) => Box,
  from: number,
  to: number,
): Placed<T>[] {
  const sorted = [...items].sort((a, b) => box(a).start - box(b).start || box(a).end - box(b).end);
  const out: Placed<T>[] = [];
  let cluster: { item: T; lane: number }[] = [];
  let clusterEnd = -Infinity;
  let clusterNo = 0;
  const laneEnds: number[] = [];
  const flush = () => {
    if (!cluster.length) return;
    const lanes = laneEnds.length || 1;
    cluster.forEach((c, idx) => {
      const b = box(c.item);
      let span = 1;
      while (c.lane + span < lanes) {
        const next = c.lane + span;
        const blocked = cluster.some((o) => {
          if (o === c || o.lane !== next) return false;
          const ob = box(o.item);
          return ob.start < b.end && ob.end > b.start;
        });
        if (blocked) break;
        span += 1;
      }
      const s = minOfTs(b.start);
      const e = Math.max(minOfTs(b.end) || 24 * 60, s + 15);
      out.push({
        item: c.item,
        lane: c.lane,
        lanes,
        span,
        cluster: clusterNo,
        first: cluster.length > 1 && idx === 0,
        size: cluster.length,
        top: Math.max(0, (s - from) / (to - from)),
        height: Math.max(0.01, (Math.min(e, to) - Math.max(s, from)) / (to - from)),
      });
    });
    clusterNo += 1;
    cluster = [];
    laneEnds.length = 0;
    clusterEnd = -Infinity;
  };
  for (const item of sorted) {
    const b = box(item);
    if (cluster.length && b.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = b.end;
    clusterEnd = Math.max(clusterEnd, b.end);
    cluster.push({ item, lane });
  }
  flush();
  return out;
}

/** Visible hours: 07:00 to 21:00 unless a session sits outside; always whole hours. */
export function hourRange(
  slots: readonly ScheduleSlot[],
  extra: readonly number[] = [],
): { from: number; to: number } {
  let from = 7 * 60;
  let to = 21 * 60;
  for (const s of slots) {
    from = Math.min(from, Math.floor(minOfTs(s.start) / 60) * 60);
    const e = minOfTs(endOf(s)) || 24 * 60;
    to = Math.max(to, Math.ceil(e / 60) * 60);
  }
  for (const t of extra) {
    from = Math.min(from, Math.floor(minOfTs(t) / 60) * 60);
    to = Math.max(to, Math.ceil((minOfTs(t) + 60) / 60) * 60);
  }
  return { from, to: Math.max(to, from + 60) };
}

export function toneOf(s: ScheduleSlot, clash: boolean): Tone | 'neutral' {
  if (clash) return 'danger';
  if (s.status === 'done') return 'ok';
  if (s.status === 'missed') return 'danger';
  if (s.status === 'moved') return 'neutral';
  return 'accent';
}

import { opaqueSlotKey } from './ids';
import { statusAt } from './model';
import type { RescheduleRequest } from './types';

/** Requests that refer to this session instance (any status). */
export const requestsOf = (
  slot: ScheduleSlot,
  requests: readonly RescheduleRequest[],
): RescheduleRequest[] => requests.filter((r) => r.slotKey === opaqueSlotKey(slot.key));

/** Open requests of this session at `now`. */
export const openRequestsOf = (
  slot: ScheduleSlot,
  requests: readonly RescheduleRequest[],
  now: number,
): RescheduleRequest[] => requestsOf(slot, requests).filter((r) => statusAt(r, now) === 'pending');

import { generateSlots } from './model';
import { dayOfTs } from './time';
import type { ScheduleDoc } from './types';

/** The session a request is about: its instance on the day it was proposed for (a moved one is found at the old place). */
export function slotOfRequest(
  docs: readonly ScheduleDoc[],
  requests: readonly RescheduleRequest[],
  r: RescheduleRequest,
  now: number,
): ScheduleSlot | undefined {
  const day = dayOfTs(r.fromStart);
  const list = generateSlots(docs, requests, { fromDay: day - 1, toDay: day + 1, now });
  const key = opaqueSlotKey;
  return (
    list.find((s) => key(s.key) === r.slotKey && s.status !== 'moved') ??
    list.find((s) => key(s.key) === r.slotKey)
  );
}
