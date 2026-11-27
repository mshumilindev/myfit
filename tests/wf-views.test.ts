import { describe, expect, it } from 'vitest';
import { renderApprovals, renderCard, renderDigest } from '../scripts/lib/wf-views.mjs';

const state = {
  task: { id: 'SPO-9', title: 't', ts: 1 },
  items: [
    { id: 'A', text: 'one', kind: 'step', status: 'done', evidence: 'tests/a.test.ts' },
    { id: 'B', text: 'two', kind: 'step', status: 'blocked', needs: 'access', reason: 'ключ' },
    { id: 'C', text: 'three', kind: 'step', status: 'todo' },
  ],
  stall: 0,
};

describe('wf views', () => {
  it('approvals lists only blocked items with their need', () => {
    const out = renderApprovals(state as never);
    expect(out).toContain('B [access]');
    expect(out).not.toContain('A ');
  });
  it('approvals says nothing is waiting when nothing is blocked', () => {
    expect(renderApprovals({ ...state, items: [state.items[0]] } as never)).toContain('нічого');
  });
  it('card shows evidence for done items, what is left and a rollback line', () => {
    const out = renderCard(state as never);
    expect(out).toContain('1/3');
    expect(out).toContain('доказ: tests/a.test.ts');
    expect(out).toContain('Лишилось (2)');
    expect(out).toContain('Відкат');
  });
  it('digest includes CI numbers when a snapshot exists', () => {
    const out = renderDigest(state as never, {
      ci: { medianMin: 10.1, p90Min: 14.5, redPct: 34, runs: 29 },
    });
    expect(out).toContain('медіана 10.1 хв');
    expect(renderDigest(state as never, null)).not.toContain('CI на main');
  });
});
