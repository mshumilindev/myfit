/**
 * How Atlas is doing, counted — never what you wrote. Only counters: how many
 * questions, how often it was unsure or had no answer, 👍/👎 per topic, chip
 * taps, actions accepted or cancelled. Stored with the coach settings (synced
 * like the rest of them), so the team can see which topics need work.
 */
export interface AtlasStats {
  since: number;
  asked: number;
  /** "Did you mean…" offered. */
  unsure: number;
  /** Nothing local — handed to Gemini or no answer at all. */
  none: number;
  /** The safety net answered. */
  safety: number;
  /** Questions that came from a tapped chip. */
  chip: number;
  up: number;
  down: number;
  actionsDone: number;
  actionsCancelled: number;
  /** Per topic: [answers, 👍, 👎]. */
  topics: Record<string, [number, number, number]>;
}

export type AtlasEvent =
  | { kind: 'ask'; intent: string | null; chip: boolean; escalated: boolean }
  | { kind: 'rate'; intent: string; up: boolean }
  | { kind: 'action'; done: boolean };

export function emptyStats(now: number): AtlasStats {
  return {
    since: now,
    asked: 0,
    unsure: 0,
    none: 0,
    safety: 0,
    chip: 0,
    up: 0,
    down: 0,
    actionsDone: 0,
    actionsCancelled: 0,
    topics: {},
  };
}

/** A new stats object with the event counted (pure — the caller saves it). */
export function countEvent(prev: AtlasStats | undefined, e: AtlasEvent, now: number): AtlasStats {
  const s: AtlasStats = prev ? { ...prev, topics: { ...prev.topics } } : emptyStats(now);
  const topic = (id: string) =>
    (s.topics[id] = [...(s.topics[id] ?? [0, 0, 0])] as [number, number, number]);
  if (e.kind === 'ask') {
    s.asked++;
    if (e.chip) s.chip++;
    if (!e.intent || e.escalated) s.none++;
    else if (e.intent === 'did_you_mean') s.unsure++;
    else if (e.intent.startsWith('safety_')) s.safety++;
    if (e.intent) topic(e.intent)[0]++;
  } else if (e.kind === 'rate') {
    if (e.up) s.up++;
    else s.down++;
    topic(e.intent)[e.up ? 1 : 2]++;
  } else if (e.done) s.actionsDone++;
  else s.actionsCancelled++;
  return s;
}
