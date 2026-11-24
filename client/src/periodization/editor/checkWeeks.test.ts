import { describe, expect, it } from 'vitest';
import { runCheck, type CheckEnv } from '../../tools/programEditor';
import { DEMO_ACTIVITIES, demoCatalog, demoDoc } from '../../tools/programEditor/stories/demoHost';
import { CYCLE_WEEK_KIND, cycleWeeksRule, describeCycleFinding } from './checkWeeks';
import { enableCycle, setWeekLabel, type CycleDoc } from './cycleOps';

const env = (): CheckEnv => ({
  catalog: demoCatalog,
  activities: DEMO_ACTIVITIES,
  checkRules: (b) => [...b, cycleWeeksRule],
});
const cycled = (): CycleDoc => enableCycle(demoDoc() as CycleDoc, 3);

describe('check of the other cycle weeks', () => {
  it('no cycle: nothing added', () => {
    const c = runCheck(demoDoc(), env());
    expect(c.findings.some((f) => f.kind === CYCLE_WEEK_KIND)).toBe(false);
  });
  it('one finding per week with something to fix, with the counts as facts', () => {
    const c = runCheck(cycled(), env());
    const w = c.findings.filter((f) => f.kind === CYCLE_WEEK_KIND);
    expect(w.map((f) => f.facts.week)).toEqual([2, 3]);
    expect(w[0]?.sev).toBe('fix');
    expect(Number(w[0]?.facts.fix)).toBeGreaterThan(0);
    expect(c.blocked).toBe(true);
  });
  it('a deload week is not held to the weekly volume ranges', () => {
    const c = runCheck(setWeekLabel(cycled(), 3, 'deload'), env());
    const weeks = c.findings.filter((f) => f.kind === CYCLE_WEEK_KIND).map((f) => f.facts.week);
    expect(weeks).toEqual([2]);
  });
  it('the rule does not run itself on a week (no endless recursion)', () => {
    expect(() => runCheck(cycled(), env())).not.toThrow();
  });
  it('words for the finding come in the person’s language', () => {
    const f = runCheck(cycled(), env()).findings.find((x) => x.kind === CYCLE_WEEK_KIND)!;
    expect(describeCycleFinding(f)?.title).toContain('2');
    expect(describeCycleFinding({ ...f, kind: 'range' })).toBeUndefined();
  });
});
