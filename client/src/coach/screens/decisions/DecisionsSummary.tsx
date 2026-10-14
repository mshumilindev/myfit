import { Card } from '../../../components/ui/Card';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { SeverityDot } from '../../../components/ui/SeverityDot';
import type { C360Strings } from '../../../i18n/coachClient360';
import type { DecisionsStrings } from '../../../i18n/coachDecisions';
import type { OutcomeResult } from '../../domain/decisions';
import { OUTCOME_TONE } from './decisionsConfig';

/** The headline of the Decisions screen: how many improved, the stacked outcome bar with its legend, one insight. */
export function DecisionsSummary({
  summary,
  pct,
  parts,
  label,
  insight,
  c,
  d,
}: {
  summary: {
    total: number;
    improved: number;
    noChange: number;
    declined: number;
    measuring: number;
  };
  pct: number;
  parts: readonly { key: OutcomeResult; n: number }[];
  label: (r: OutcomeResult) => string;
  insight: string | null | undefined;
  c: C360Strings;
  d: DecisionsStrings;
}) {
  return (
    <Card pad="lg" className="dc-sum">
      <p className="dc-big">
        <b>{d.dcBig(summary.improved, summary.total)}</b> <span>{d.dcBigRest(pct)}</span>
      </p>
      <ProgressBar
        className="dc-bar"
        value={0}
        height={8}
        role="img"
        aria-label={c.drBarLabel(
          summary.improved,
          summary.noChange,
          summary.declined,
          summary.measuring,
        )}
        segments={parts.map((p) => ({ value: p.n, tone: OUTCOME_TONE[p.key] }))}
      />
      <div className="dc-legend" role="group" aria-label={c.drLegend}>
        {parts.map((p) => (
          <SeverityDot key={p.key} tone={OUTCOME_TONE[p.key]}>
            {label(p.key)} <b>{p.n}</b>
          </SeverityDot>
        ))}
      </div>
      {insight && <p className="dc-insight">{insight}</p>}
    </Card>
  );
}
