import { describe, expect, it } from 'vitest';
import { answerLocally, didYouMean } from './intents';
import { mergeMemory } from './memory';
import { similarity, teach, unteach } from './teach';
import { richCtx } from './testCtx';

describe('learning your way of asking', () => {
  it("near-identical wordings match, different ones don't", () => {
    expect(
      similarity('how do i get bigger arms', 'how can I get bigger arms'),
    ).toBeGreaterThanOrEqual(0.66);
    expect(similarity('how do i get bigger arms', 'how do i get a bigger chest')).toBeLessThan(
      0.66,
    );
  });

  it("a pick from 'did you mean…' teaches that wording", () => {
    const c = richCtx('en');
    // Find a wording Atlas is unsure about.
    // A wording Atlas is unsure about (the first of a few that still are).
    const odd = [
      'how heavy on bench this time',
      'time to bump up my deadlift weight?',
      'how far has my deadlift come',
      'what am i hitting this afternoon',
      'what should i do once i finish lifting',
      'my thing feels off after the gym lately',
      'that afternoon thing',
    ].find((q) => answerLocally(q, c)?.intent === 'did_you_mean')!;
    expect(odd).toBeTruthy();
    const first = answerLocally(odd, c)!;
    const offered = first.convo.pendingTeach!.offered;
    // The first option whose chip leads to that very topic.
    const i = offered.findIndex((id, k) => {
      const a = answerLocally(first.chips![k], c, first.convo);
      return a?.intent === id && !!a.learned?.taught?.length;
    });
    expect(i).toBeGreaterThanOrEqual(0);
    const pick = offered[i];
    const second = answerLocally(first.chips![i], c, first.convo);
    expect(second?.intent).toBe(pick);
    expect(second?.learned?.taught?.[0]).toMatchObject({ q: odd, id: pick });
    // Next time the same words go straight there.
    const mem = mergeMemory(c.mem, second!.learned!);
    const third = answerLocally(odd, { ...c, mem });
    expect(third?.intent).toBe(pick);
    expect(third?.convo.pendingTeach).toBeUndefined();
  });

  it('👍 pins a wording to a topic; 👎 takes the topic away', () => {
    const c = richCtx('en');
    const q = 'how is my bench going';
    const a = answerLocally(q, c);
    expect(a?.intent).toBe('progress_lift');
    const down = unteach(c.mem, q, a!.intent, c.now);
    const b = answerLocally(q, { ...c, mem: mergeMemory(c.mem, down) });
    expect(b?.intent).not.toBe('progress_lift');
    const up = teach(mergeMemory(c.mem, down), q, 'best', c.now);
    expect(up.wrong).toHaveLength(1);
    const d = answerLocally("how's my bench going", { ...c, mem: mergeMemory(c.mem, up) });
    expect(d?.intent).toBe('best');
  });

  it('alternatives after 👎 skip the rejected topic', () => {
    const c = richCtx('en');
    const alts = didYouMean('how long should i rest', c, ['rest']);
    expect(alts.map((x) => x.id)).not.toContain('rest');
    expect(alts.length).toBeGreaterThan(0);
  });
});
