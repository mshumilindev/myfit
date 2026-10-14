import { describe, expect, it } from 'vitest';
import { buildFixtureHistory } from '../data/__fixtures__/fixtureHistory';
import { buildFixtureWorld, FIXTURE_NOW } from '../data/__fixtures__/fixtures';
import { ALL_OFF } from './consent';
import { gateHistory, liftTrend } from './history';

const w = buildFixtureWorld();
const hist = buildFixtureHistory(w.clients, FIXTURE_NOW);

describe('gateHistory', () => {
  const h = hist.c1;
  it('sets full + totals full: everything', () => {
    const g = gateHistory(h, 'app', { ...ALL_OFF, totals: 'full', sets: 'full' });
    expect(g.lifts).toHaveLength(4);
    expect(g.sessions).toHaveLength(5);
    expect(g.weeks).toHaveLength(7);
  });
  it('totals only: lifts and sessions are null, the rhythm stays', () => {
    const g = gateHistory(h, 'app', { ...ALL_OFF, totals: 'full' });
    expect(g.lifts).toBeNull();
    expect(g.sessions).toBeNull();
    expect(g.weeks).toHaveLength(7);
  });
  it('shares nothing or program-only: nothing at all', () => {
    for (const mode of ['app', 'program'] as const) {
      const g = gateHistory(
        h,
        mode,
        mode === 'app' ? ALL_OFF : { ...ALL_OFF, totals: 'full', sets: 'full' },
      );
      expect(g).toEqual({ lifts: null, sessions: null, weeks: null });
    }
  });
  it('no history for the client: nothing', () => {
    expect(
      gateHistory(undefined, 'app', { ...ALL_OFF, totals: 'full', sets: 'full' }).lifts,
    ).toBeNull();
  });
});

describe('liftTrend', () => {
  it('flat when the last value equals the one four sessions back', () => {
    expect(liftTrend([111, 113, 116, 116, 116, 115, 116, 116])).toBe('flat');
  });
  it('rising when it moved up', () => {
    expect(liftTrend([80, 82, 83, 85, 86, 87, 88, 89])).toBe('rising');
  });
});

describe('fixture history', () => {
  it('Oleh matches the lab, program-only clients have none', () => {
    expect(hist.c1.lifts.map((l) => l.name)).toEqual([
      'Bench press',
      'Bent-over row',
      'Incline dumbbell press',
      'Lateral raise',
    ]);
    expect(hist.c1.sessions[0].tonnageKg).toBe(4700);
    expect(hist.c9).toBeUndefined();
  });
  it('every other active client has 3 lifts, 5 sessions (newest first) and 7 weeks', () => {
    for (const [id, x] of Object.entries(hist)) {
      if (id === 'c1') continue;
      expect(x.lifts).toHaveLength(3);
      expect(x.sessions).toHaveLength(5);
      expect(x.sessions[0].at).toBeGreaterThan(x.sessions[4].at);
      expect(x.weeks).toHaveLength(7);
    }
  });
});
