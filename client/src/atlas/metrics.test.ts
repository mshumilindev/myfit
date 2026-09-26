import { describe, expect, it } from 'vitest';
import { countEvent } from './metrics';

describe('metrics — counters, never text', () => {
  it('counts asks, unsure, none, safety, chips, ratings and actions', () => {
    let s = countEvent(
      undefined,
      { kind: 'ask', intent: 'rest', chip: false, escalated: false },
      1,
    );
    s = countEvent(s, { kind: 'ask', intent: 'did_you_mean', chip: true, escalated: false }, 2);
    s = countEvent(s, { kind: 'ask', intent: null, chip: false, escalated: false }, 3);
    s = countEvent(s, { kind: 'ask', intent: 'safety_cardiac', chip: false, escalated: false }, 4);
    s = countEvent(s, { kind: 'rate', intent: 'rest', up: false }, 5);
    s = countEvent(s, { kind: 'action', done: true }, 6);
    expect(s).toMatchObject({
      since: 1,
      asked: 4,
      unsure: 1,
      none: 1,
      safety: 1,
      chip: 1,
      down: 1,
      actionsDone: 1,
    });
    expect(s.topics.rest).toEqual([1, 0, 1]);
    expect(JSON.stringify(s)).not.toMatch(/[а-яі]/);
  });
});
