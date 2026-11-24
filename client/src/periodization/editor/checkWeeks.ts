/**
 * The pre-send check of the weeks of a cycle (Periodization chunk). The tool checks one week (the program's own); this rule,
 * added through `host.checkRules`, checks every other cycle week the same way and reports ONE finding per week that has
 * something to fix or review, so a 12-week cycle does not bury the report. A deload or test week is not held to the weekly
 * volume ranges (a lighter week is its purpose); everything else (restrictions, empty days, missing pictures) still applies.
 */
import { runCheck, type CheckRule, type Finding } from '../../tools/programEditor';
import type { CycleLabel } from '../../views/programs/model';
import { getLocale } from '../../i18n';
import { fill } from '../strings';
import { labelOfWeek, weekView, type CycleDoc } from './cycleOps';
import { EDITOR_STRINGS } from './editorStrings';

const EXEMPT_FROM_VOLUME: readonly CycleLabel[] = ['deload', 'test'];
/** Findings that read the whole program, not one week: the planned activities are the same every week. */
const SAME_EVERY_WEEK = new Set(['cardio']);
const VOLUME = new Set(['range', 'open', 'pushPull', 'onceAWeek']);

export const CYCLE_WEEK_KIND = 'cycleWeek';

export const cycleWeeksRule: CheckRule = {
  id: 'cycleWeeks',
  run: ({ doc, env }) => {
    const full = doc as CycleDoc;
    const c = full.cycle;
    if (!c) return [];
    const out: Finding[] = [];
    // The built-in rules only: this rule must not run itself again on a week.
    const plain = { ...env, checkRules: undefined };
    for (let cw = 2; cw <= c.length; cw++) {
      const label = labelOfWeek(full, cw);
      const exempt = !!label && EXEMPT_FROM_VOLUME.includes(label);
      const res = runCheck(weekView(full, cw), plain);
      const bad = res.findings.filter(
        (f) =>
          (f.sev === 'fix' || f.sev === 'review') &&
          !SAME_EVERY_WEEK.has(String(f.kind)) &&
          !(exempt && VOLUME.has(String(f.kind))),
      );
      if (bad.length === 0) continue;
      const fix = bad.filter((f) => f.sev === 'fix').length;
      out.push({
        id: `${CYCLE_WEEK_KIND}-${cw}`,
        kind: CYCLE_WEEK_KIND,
        sev: fix > 0 ? 'fix' : 'review',
        facts: { week: cw, fix, review: bad.length - fix },
      });
    }
    return out;
  },
};

/** The words of a `cycleWeek` finding (the tool asks the host for kinds it does not know). */
export function describeCycleFinding(f: Finding): { title: string; body: string } | undefined {
  if (f.kind !== CYCLE_WEEK_KIND) return undefined;
  const s = EDITOR_STRINGS[getLocale()];
  const v = { n: Number(f.facts.week), fix: Number(f.facts.fix), review: Number(f.facts.review) };
  return { title: fill(s.ckWeekTitle, v), body: fill(s.ckWeekBody, v) };
}
