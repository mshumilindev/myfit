import { describe, expect, it } from 'vitest';
import { classifyReady, renderPreflight } from '../scripts/lib/cpd-preflight.mjs';

describe('cpd preflight', () => {
  it('splits branches into must-include and already-merged', () => {
    const r = classifyReady([
      { name: 'ready-for-cpd/SPO-1', ahead: 3 },
      { name: 'ready-for-cpd/SPO-2', ahead: 0 },
    ]);
    expect(r.toInclude.map((b: { name: string }) => b.name)).toEqual(['ready-for-cpd/SPO-1']);
    expect(r.stale.map((b: { name: string }) => b.name)).toEqual(['ready-for-cpd/SPO-2']);
  });
  it('says cpd is not finished while a branch is still ahead of main', () => {
    const out = renderPreflight({
      branches: [{ name: 'ready-for-cpd/SPO-1', ahead: 2 }],
      unpushed: 0,
      dirty: 0,
    });
    expect(out).toContain('ВКЛЮЧИ в цей cpd: ready-for-cpd/SPO-1');
    expect(out).toContain('cpd НЕ завершений');
  });
  it('reports a clean state when there are no ready branches', () => {
    expect(renderPreflight({ branches: [], unpushed: 0, dirty: 0 })).toContain('немає');
  });
});
