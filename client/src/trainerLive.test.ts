import { describe, it, expect } from 'vitest';
import {
  classifyTrainee,
  activeTrainees,
  LIVE_OFFLINE_MS,
  FINISHED_LINGER_MS,
} from './trainerLive';
import type { LiveSession } from './types';

const now = 1_000_000_000_000;
const s = (over: Partial<LiveSession>): LiveSession => ({
  id: 'a',
  athleteName: 'A',
  trainerId: 't',
  startedAt: now - 60_000,
  updatedAt: now,
  finishedAt: null,
  ...over,
});

describe('classifyTrainee', () => {
  it('is live with a fresh heartbeat', () => {
    expect(classifyTrainee(s({ updatedAt: now - 10_000 }), now)).toBe('live');
  });
  it('is offline once the heartbeat goes stale', () => {
    expect(classifyTrainee(s({ updatedAt: now - LIVE_OFFLINE_MS - 1 }), now)).toBe('offline');
  });
  it('shows finished briefly, then drops', () => {
    expect(classifyTrainee(s({ finishedAt: now - 60_000 }), now)).toBe('finished');
    expect(classifyTrainee(s({ finishedAt: now - FINISHED_LINGER_MS - 1 }), now)).toBeNull();
  });
});

describe('activeTrainees ordering', () => {
  it('leads with the freshest live session, trails finished, drops stale', () => {
    const list: LiveSession[] = [
      s({ id: 'old', startedAt: now - 300_000, updatedAt: now }),
      s({ id: 'fresh', startedAt: now - 30_000, updatedAt: now }),
      s({ id: 'done', finishedAt: now - 60_000 }),
      s({ id: 'gone', finishedAt: now - FINISHED_LINGER_MS - 1 }),
    ];
    const out = activeTrainees(list, now);
    expect(out.map((c) => c.s.id)).toEqual(['fresh', 'old', 'done']);
    expect(out.map((c) => c.state)).toEqual(['live', 'live', 'finished']);
  });
  it('returns nothing when all sessions are stale/gone', () => {
    expect(activeTrainees([s({ finishedAt: now - FINISHED_LINGER_MS - 1 })], now)).toEqual([]);
  });
});
