import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { GroupedList, ListPanel, ListRow } from '../../../components/ui/GroupedList';
import { Notice } from '../../../components/ui/Notice';
import { LockedRow } from '../../../components/ui/RosterRows';
import { Tag } from '../../../components/ui/Tag';
import { ToneText } from '../../../components/ui/ToneText';
import { Icon } from '../../../ui';
import type { C360Strings } from '../../../i18n/coachClient360';
import type { LocaleId } from '../../../i18n';
import { workoutsCsv } from '../../domain/csv';
import type { CoachClient } from '../../domain/types';
import { gateWorkouts, groupByWeek, SESSIONS_PAGE } from '../../domain/workouts';
import { coachDayMonth, coachWeekday } from '../../format';
import { SetGrid } from './SetGrid';

/** The history part of the Workouts tab: notice / locked / empty / week groups with recaps + paging. */
export function WorkoutsHistory({
  gated,
  c,
  client,
  first,
  locale,
  askN,
  ask,
  groups,
  wkTitle,
  tonnes,
  open,
  setOpen,
  shown,
  setShown,
  sessionsCsv,
}: {
  gated: ReturnType<typeof gateWorkouts>;
  c: C360Strings;
  client: CoachClient;
  first: string;
  locale: LocaleId;
  askN: number;
  ask: () => void;
  groups: ReturnType<typeof groupByWeek>;
  wkTitle: (start: number) => string;
  tonnes: (kg: number) => string;
  open: string;
  setOpen: (id: string) => void;
  shown: number;
  setShown: (f: (n: number) => number) => void;
  sessionsCsv: ReturnType<typeof workoutsCsv>;
}) {
  if (gated.state === 'program')
    return (
      <Notice tone="neutral" icon="info">
        {c.wkProgramBody(first)}
      </Notice>
    );
  if (gated.state === 'locked')
    return (
      <Card>
        <LockedRow
          action={
            askN > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                icon="key"
                aria-label={c.lkAskFor(first, c.lkTotals)}
                onClick={ask}
              >
                {c.lkAsk(first)}
              </Button>
            ) : undefined
          }
        >
          <b>{c.wkLockedH(first)}.</b> {c.wkLockedBody}
        </LockedRow>
      </Card>
    );
  if (gated.entries.length === 0)
    return (
      <Card>
        <EmptyState titleAs="h2" icon="barbell" title={c.wkEmptyH} body={c.wkEmptyBody(first)} />
      </Card>
    );
  return (
    <>
      {gated.state === 'totals' && (
        <Card>
          <LockedRow
            action={
              <Button
                variant="secondary"
                size="sm"
                icon="key"
                aria-label={c.lkAskFor(first, c.lkSets)}
                onClick={ask}
              >
                {c.lkAsk(first)}
              </Button>
            }
          >
            <b>{c.wkTotalsOnlyH(first)}.</b>{' '}
            {c.wkTotalsOnlyBody(sessionsCsv.omitted.map((k) => c.exColWorkouts[k]).join(', '))}
          </LockedRow>
        </Card>
      )}
      {groups.map((g) => (
        <section key={g.start} className="c3t-grp" aria-label={wkTitle(g.start)}>
          <h3 className="c3t-grp-h">
            <span>{wkTitle(g.start)}</span>
            <small>
              {c.wkWeekMeta(g.items.length, Math.max(client.planned, g.items.length))}
              {gated.detail ? ` · ${c.wkWeekSets(g.sets, tonnes(g.tonnageKg))}` : ''}
            </small>
          </h3>
          <GroupedList list label={wkTitle(g.start)}>
            {g.items.map((x) => {
              const on = x.id === open;
              const sub = (
                <span className="c3t-sub">
                  {gated.detail
                    ? `${c.wkMin(x.minutes)} · ${c.wkSetsN(x.sets)} · ${tonnes(x.tonnageKg)}${x.gym ? ` · ${x.gym}` : ''}`
                    : c.wkMin(x.minutes)}
                  {x.withTrainer && (
                    <Tag tone="coach" icon={<Icon name="user-focus" />}>
                      {c.wkWithTrainer}
                    </Tag>
                  )}
                </span>
              );
              const date = (
                <span className="c3t-dt">
                  <b>{coachWeekday(x.at, locale)}</b>
                  <small>{coachDayMonth(x.at, locale)}</small>
                </span>
              );
              return (
                <li key={x.id}>
                  <ListRow
                    strong
                    time={date}
                    label={x.title}
                    sub={sub}
                    trailing={
                      gated.detail ? (
                        <span className="c3t-trail">
                          {x.pr && (
                            <Tag tone="ok" aria-label={c.wkPRFull} icon={<Icon name="trophy" />}>
                              {c.wkPR}
                            </Tag>
                          )}
                          <span className="c3t-adh" title={c.wkAdherenceTip}>
                            <b>
                              {x.compliance < 95 ? (
                                <ToneText tone="illness">{x.compliance}%</ToneText>
                              ) : (
                                `${x.compliance}%`
                              )}
                            </b>
                            <small>{c.wkAdherence}</small>
                          </span>
                          <Icon name={on ? 'caret-up' : 'caret-down'} />
                        </span>
                      ) : undefined
                    }
                    aria-expanded={gated.detail ? on : undefined}
                    aria-label={
                      gated.detail
                        ? `${x.title}, ${coachWeekday(x.at, locale)} ${coachDayMonth(x.at, locale)}${x.pr ? `, ${c.wkPRFull}` : ''}`
                        : undefined
                    }
                    onClick={gated.detail ? () => setOpen(on ? '' : x.id) : undefined}
                  />
                  {gated.detail && on && (
                    <ListPanel>
                      <div className="c3t-recap" role="group" aria-label={c.wkRecapLabel(x.title)}>
                        <dl className="c3t-facts">
                          <div>
                            <dt>{c.wkRecapSets}</dt>
                            <dd>{x.sets}</dd>
                          </div>
                          <div>
                            <dt>{c.wkRecapTonnage}</dt>
                            <dd>{tonnes(x.tonnageKg)}</dd>
                          </div>
                          <div>
                            <dt>{c.wkRecapMinutes}</dt>
                            <dd>{x.minutes}</dd>
                          </div>
                          <div>
                            <dt>{c.wkRecapPlan}</dt>
                            <dd>{x.compliance}%</dd>
                          </div>
                        </dl>
                        <SetGrid entry={x} c={c} />
                        <p className="c3-m c3t-ro">
                          <Icon name="lock-simple" /> {c.wkReadOnly(first)}
                        </p>
                        <div>
                          <Button variant="secondary" size="sm" icon="envelope" onClick={ask}>
                            {c.wkMessageAbout}
                          </Button>
                        </div>
                      </div>
                    </ListPanel>
                  )}
                </li>
              );
            })}
          </GroupedList>
        </section>
      ))}
      <div className="c3t-more">
        {shown < gated.entries.length ? (
          <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + SESSIONS_PAGE)}>
            {c.wkShowMore(Math.min(SESSIONS_PAGE, gated.entries.length - shown))}
          </Button>
        ) : (
          <small className="c3-m">{c.wkAllShown(gated.entries.length)}</small>
        )}
      </div>
    </>
  );
}
