import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { GroupedList, ListPanel, ListRow } from '../../components/ui/GroupedList';
import { SectionLabel } from '../../components/ui/SectionLabel';
import type { LocaleId } from '../../i18n';
import type { C360Strings } from '../../i18n/coachClient360';
import type { DecisionsStrings } from '../../i18n/coachDecisions';
import type { RosterStrings } from '../../i18n/coachRoster';
import type { TodayStrings } from '../../i18n/coachToday.en';
import type { DerivedWorld } from '../data/deriveWorld';
import type { CoachClient } from '../domain/types';
import { coachDayMonth } from '../format';
import type { CoachRoute } from '../routes';
import { DecisionRecordView } from './DecisionRecordView';
import { decisionRows, resultLabel, RESULT_TONE } from './decisionModel';
import { firstName } from './format';

export interface DecisionsTabProps {
  client: CoachClient;
  world: DerivedWorld;
  c: C360Strings;
  d: DecisionsStrings;
  r: RosterStrings;
  t: TodayStrings;
  locale: LocaleId;
  now: number;
  onNavigate: (r: CoachRoute) => void;
  onOpenDecision?: (signalKey: string) => void;
}

/** Client 360, Decisions tab: this client's decisions, each opening its Decision record inline. */
export function DecisionsTab({
  client,
  world,
  c,
  d,
  r,
  t,
  locale,
  now,
  onNavigate,
  onOpenDecision,
}: DecisionsTabProps) {
  const first = firstName(client.name);
  const rows = decisionRows(world, t).filter((x) => x.rec.clientId === client.id);
  const [open, setOpen] = useState('');
  if (rows.length === 0)
    return (
      <div className="c3-main c3t">
        <Card>
          <EmptyState titleAs="h2" icon="check-circle" title={c.drNoneForClient(first)} />
        </Card>
      </div>
    );
  return (
    <div className="c3-main c3t">
      <section aria-labelledby="c3t-dec">
        <SectionLabel
          id="c3t-dec"
          action={<span className="c3-meta">{d.dcCount(rows.length)}</span>}
        >
          {c.drForClient(first)}
        </SectionLabel>
        <GroupedList list label={c.drForClient(first)}>
          {rows.map((x) => {
            const on = x.rec.id === open;
            return (
              <li key={x.rec.id}>
                <ListRow
                  strong
                  label={x.title}
                  sub={coachDayMonth(x.rec.decidedAt, locale)}
                  trailing={
                    <Chip
                      tone={RESULT_TONE[x.result]}
                      icon={x.result === 'measuring' ? 'hourglass' : undefined}
                    >
                      {resultLabel(t, d, x.result)}
                    </Chip>
                  }
                  aria-expanded={on}
                  aria-label={`${c.drOpenRecord(x.title)}. ${resultLabel(t, d, x.result)}`}
                  onClick={() => setOpen(on ? '' : x.rec.id)}
                />
                {on && (
                  <ListPanel>
                    <DecisionRecordView
                      row={x}
                      c={c}
                      d={d}
                      r={r}
                      t={t}
                      locale={locale}
                      now={now}
                      program={client.program}
                      onOpenEvidence={() =>
                        onOpenDecision
                          ? onOpenDecision(x.rec.signal.key)
                          : onNavigate({ screen: 'agenda' })
                      }
                      onNewDecision={() => onNavigate({ screen: 'client', cid: client.id })}
                    />
                  </ListPanel>
                )}
              </li>
            );
          })}
        </GroupedList>
      </section>
    </div>
  );
}
