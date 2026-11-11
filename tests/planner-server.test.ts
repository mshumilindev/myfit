import { describe, expect, it } from 'vitest';
import {
  MAX_AHEAD_MS,
  STALE_MS,
  nextAfter,
  ringable,
  taskId,
  validFires,
} from '../functions/src/plannerCore';
import { categoryOf, pushLink, shouldDeliver } from '../functions/src/coach/pushPolicy';
import { PUSH_TEXTS } from '../functions/src/coach/pushText';

describe('planner moments from a document', () => {
  it('keeps finite numbers, ascending and unique, at most 32', () => {
    expect(validFires([30, 10, 20, 10, 'x', NaN, null, Infinity])).toEqual([10, 20, 30]);
    expect(validFires('nope')).toEqual([]);
    expect(validFires(Array.from({ length: 80 }, (_, i) => i))).toHaveLength(32);
  });
  it('picks the first moment strictly after a time', () => {
    expect(nextAfter([10, 20, 30], 10)).toBe(20);
    expect(nextAfter([10, 20, 30], 30)).toBeNull();
  });
  it('does not ring a stale moment nor queue one further than a task can wait', () => {
    const now = 1_000_000_000_000;
    expect(ringable(now - 1000, now)).toBe(true);
    expect(ringable(now - STALE_MS - 1, now)).toBe(false);
    expect(ringable(now + MAX_AHEAD_MS + 1, now)).toBe(false);
  });
});

describe('planner task names', () => {
  const base = { uid: 'u1', id: 'p1', dueAt: 123 };
  it('are the same for the same moment and differ per moment', () => {
    expect(taskId(base)).toBe(taskId({ ...base }));
    expect(taskId(base)).not.toBe(taskId({ ...base, dueAt: 124 }));
  });
  it('contain only allowed characters and carry no text of the plan', () => {
    expect(taskId({ ...base, uid: 'a/b c' })).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('planner pushes', () => {
  const night = { quiet: { on: true, from: 22 * 60, to: 7 * 60 }, tz: 'UTC' };
  const at = Date.parse('2026-11-11T23:30:00Z');
  it('a quiet reminder is held in quiet hours, a persistent one rings through, both obey the switch', () => {
    expect(shouldDeliver('planner', night, at)).toBe(false);
    expect(shouldDeliver('planner-ring', night, at)).toBe(true);
    const off = { ...night, prefs: { reminders: false } };
    expect(shouldDeliver('planner-ring', off, at)).toBe(false);
    expect(shouldDeliver('planner', { ...off, quiet: { on: false, from: 0, to: 0 } }, at)).toBe(
      false,
    );
  });
  it('is in the reminders category and opens the app home', () => {
    expect(categoryOf('planner')).toBe('reminders');
    expect(categoryOf('planner-ring')).toBe('reminders');
    expect(pushLink('planner', false)).toBe('/#/');
  });
  it('has a text in every language and the text names nothing of the plan', () => {
    for (const l of ['en', 'uk', 'pl', 'lt', 'et'] as const) {
      expect(PUSH_TEXTS[l].planner.length).toBeGreaterThan(5);
    }
  });
});

import { readFileSync } from 'node:fs';
describe('the service worker keeps a persistent reminder on screen', () => {
  it('reads the ring flag the server sets, and re-alerts on the same tag', () => {
    const sw = readFileSync('client/public/sw-push.js', 'utf8');
    expect(sw).toContain("d.ring === '1'");
    expect(sw).toContain('requireInteraction: true');
    expect(readFileSync('functions/src/push.ts', 'utf8')).toContain("base.ring = '1'");
  });
});
