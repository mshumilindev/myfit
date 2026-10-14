import type { TodayStrings } from '../../../i18n/coachToday';
import type { Category, Signal, CoachClient } from '../../domain/types';
import { Button } from '../../../components/ui/Button';
import { EvidenceChart } from '../../../components/ui/EvidenceChart';
import { Notice } from '../../../components/ui/Notice';
import { LockedRow } from '../../../components/ui/RosterRows';
import { Inspector } from '../../layout/Layout';
import { chatRoute, type CoachRoute } from '../../routes';
import { similarDecisions } from '../model';
import { signalChart } from '../signalCopy';

const LOCKABLE: readonly Category[] = ['sleep', 'nutrition', 'body'];

/** The evidence column: chart, locked categories with Ask, similar decisions, what the client shares. */
export function DecisionEvidence({
  t,
  signal,
  client,
  name,
  chart,
  line,
  similar,
  sharedList,
  onNavigate,
}: {
  t: TodayStrings;
  signal: Signal;
  client: CoachClient;
  name: string;
  chart: ReturnType<typeof signalChart>;
  line: string;
  similar: ReturnType<typeof similarDecisions>;
  sharedList: readonly string[];
  onNavigate: (r: CoachRoute) => void;
}) {
  const ev = signal.evidence[0];
  return (
    <Inspector label={t.evTitle} className="td-evidence">
      <h2 className="td-ev-h">{t.evTitle}</h2>
      {signal.facts.exercise != null && (
        <p className="td-ev-sub">{String(signal.facts.exercise)}</p>
      )}
      {chart ? (
        <EvidenceChart
          points={chart.points}
          xStart={chart.xStart}
          xEnd={chart.xEnd}
          unit={chart.unit}
          plan={chart.plan}
          tone={chart.tone}
          ariaLabel={chart.aria}
          table={chart.notEnough ? undefined : chart.table}
          tableVisible
          empty={chart.notEnough ? t.evNoData : undefined}
        />
      ) : (
        <p className="td-ev-sub">{line}</p>
      )}
      {ev && !ev.granular && chart && <p className="td-ev-note">{t.evNeedsFull}</p>}
      <div className="td-facts">
        {LOCKABLE.filter((c) => client.consent[c] === 'off').map((c) => (
          <LockedRow
            key={c}
            action={
              <Button
                variant="link"
                size="sm"
                aria-label={t.evAskFor(t.cat[c])}
                onClick={() => onNavigate(chatRoute(client.id))}
              >
                {t.evAsk}
              </Button>
            }
          >
            {t.evLocked(name, t.cat[c])}
          </LockedRow>
        ))}
      </div>
      {similar && (
        <Notice tone="neutral" icon="sparkle" className="td-similar">
          {t.evSimilar(similar.helped, similar.total)}
        </Notice>
      )}
      <p className="td-ev-note">
        {sharedList.length ? t.evShares(name, sharedList.join(', ')) : t.evSharesNothing(name)}
      </p>
      <Button
        variant="link"
        iconTrailing="arrow-right"
        onClick={() => onNavigate({ screen: 'client', cid: client.id })}
      >
        {t.openProfile(name)}
      </Button>
    </Inspector>
  );
}
