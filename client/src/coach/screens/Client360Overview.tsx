import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { InfoTable } from '../../components/ui/InfoTable';
import { StatTile } from '../../components/ui/StatTile';
import { ConsentChips } from '../../components/ui/ConsentControls';
import { DataTable } from '../../components/ui/DataTable';
import { EvidenceChart } from '../../components/ui/EvidenceChart';
import { Notice } from '../../components/ui/Notice';
import { RhythmChart } from '../../components/ui/RhythmChart';
import { LockedRow, StatusLabel } from '../../components/ui/RosterRows';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Tag } from '../../components/ui/Tag';
import { coachClock, coachMoment } from '../format';
import { useT } from '../../i18n';
import { useTodayT } from '../../i18n/coachToday';
import { injuryName, restrictionLine } from './injuryLabel';
import type { RosterStrings } from '../../i18n/coachRoster';
import { Icon } from '../../ui';
import type { DerivedWorld } from '../data/deriveWorld';
import { askable, effectiveConsent } from '../domain/consent';
import { gateHistory } from '../domain/history';
import { hasClient, headcount } from '../domain/slots';
import { DAY } from '../domain/time';
import { DOWS, type CoachClient, type Signal } from '../domain/types';
import { chatRoute, type CoachRoute } from '../routes';
import { requestsOf } from '../today/model';
import { useScheduleRequestPort } from '../schedule/requestPort';
import { type RescheduleRequestPort } from '../today/requestPort';
import { severityTone, signalChart, signalHero } from '../today/signalCopy';
import { liftColumns, rhythmBarsOf, sessionColumns } from './overview/overviewTables';
import { Inspector, Split } from '../layout/Layout';
import {
  consentItems,
  firstName,
  modeDescription,
  signalBody,
  signalTitle,
  statusLabel,
  trainerDaysText,
} from './format';
import { ClientRequests } from './overview/ClientRequests';

export interface OverviewProps {
  client: CoachClient;
  top?: Signal;
  world: DerivedWorld;
  r: RosterStrings;
  now: number;
  /** false = phone: the lab keeps lifts, sessions and rhythm for the wide layout. */
  wide: boolean;
  requestPort?: RescheduleRequestPort;
  onNavigate: (r: CoachRoute) => void;
  onOpenDecision?: (signalKey: string) => void;
}

/** Client 360 Overview (S-03): today, what needs attention, the week, lifts, sessions, rhythm + the side column. */
export function Overview({
  client,
  top,
  world,
  r,
  now,
  wide,
  requestPort,
  onNavigate,
  onOpenDecision,
}: OverviewProps) {
  const first = firstName(client.name);
  const { t: tt, locale } = useTodayT();
  const { t: app } = useT();
  const injuries = client.injuries ?? [];
  const program = client.mode === 'program';
  const consent = effectiveConsent(client.mode, client.consent);
  const allOff = !program && Object.values(client.consent).every((l) => l === 'off');
  const injuryOff = consent.injury === 'off';
  const slots = world.slots;
  const today = Math.floor(now / DAY);
  const todaySlot = slots.find(
    (s) => Math.floor(s.start / DAY) === today && hasClient(s, client.id),
  );
  const askN = askable(client.mode, client.consent).length;
  const gated = gateHistory(world.history[client.id], client.mode, client.consent);
  const reqs = requestsOf(world).filter((q) => q.client.id === client.id);
  const schedulePort = useScheduleRequestPort();
  const port = requestPort ?? schedulePort;

  /* The engine already cut the evidence to consent; cut it again so a locked category never draws. */
  const topShown: Signal | undefined = top && {
    ...top,
    evidence: top.evidence.filter((e) => consent[e.category] !== 'off'),
  };
  const hero = topShown ? signalHero(tt, topShown) : null;
  const chart = topShown ? signalChart(tt, topShown, now, locale, 'weekly') : null;

  const kg = (v: number) => r.c3Kg(String(v));
  const tonnes = (v: number) =>
    r.c3Tonnes(
      new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
        v / 1000,
      ),
    );

  const liftCols = liftColumns(r, kg);
  const sessionCols = sessionColumns(r, locale, tonnes);
  const weeks = gated.weeks;
  const rhythmBars = rhythmBarsOf(r, weeks, program, client.done);

  const groupSlots = slots.filter((s) => s.kind !== 'solo' && hasClient(s, client.id));

  return (
    <Split ratio="8-4">
      <div className="c3-main">
        {allOff && (
          <Notice tone="neutral" icon="lock-simple">
            <b>{r.c3LockedH(first)}</b> {r.c3LockedBody(first)}
          </Notice>
        )}
        {program && (
          <Notice tone="neutral" icon="info">
            {r.c3OfflineBanner(first)}
          </Notice>
        )}

        <section aria-labelledby="c3-today">
          <SectionLabel id="c3-today">{r.c3Today}</SectionLabel>
          <GroupedList>
            <ListRow
              strong
              chevron
              label={todaySlot ? r.c3SessionToday(coachClock(todaySlot.start)) : r.c3RestDay}
              sub={!todaySlot ? r.c3NoSession : undefined}
              aria-label={`${todaySlot ? r.c3SessionToday(coachClock(todaySlot.start)) : r.c3RestDay}. ${r.c3OpenWorkouts}`}
              onClick={() => onNavigate({ screen: 'client', cid: client.id, tab: 'workouts' })}
            />
          </GroupedList>
        </section>

        <section aria-labelledby="c3-needs">
          <SectionLabel id="c3-needs">{r.c3Needs}</SectionLabel>
          {top ? (
            <Card pad="lg" className="c3-att">
              <div className="c3-needs">
                <Tag tone={severityTone(top.severity)}>{statusLabel(r, top.severity)}</Tag>
              </div>
              <h2 className="c3-h">{signalTitle(r, top)}</h2>
              <p className="c3-m c3-body">{signalBody(r, top)}</p>
              {(hero || chart) && (
                <div className="c3-metric">
                  {hero && (
                    <StatTile
                      big
                      label={hero.label}
                      value={hero.value}
                      unit={hero.unit}
                      sub={hero.sub}
                    />
                  )}
                  {chart && !chart.notEnough && (
                    <EvidenceChart
                      className="c3-chart"
                      points={chart.points}
                      xStart={chart.xStart}
                      xEnd={chart.xEnd}
                      unit={chart.unit}
                      plan={chart.plan}
                      tone={chart.tone}
                      ariaLabel={chart.aria}
                      table={chart.table}
                      height={72}
                    />
                  )}
                </div>
              )}
              <div className="c3-btns">
                <Button
                  variant="primary"
                  size="lg"
                  iconTrailing="arrow-right"
                  onClick={() =>
                    onOpenDecision ? onOpenDecision(top.key) : onNavigate({ screen: 'decisions' })
                  }
                >
                  {r.sgOpenDecision}
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <span className="c3-none">
                <StatusLabel status="none">{statusLabel(r, 'none')}</StatusLabel>{' '}
                {r.c3NeedsNone(first)}
              </span>
            </Card>
          )}
        </section>

        <section aria-labelledby="c3-week">
          <SectionLabel
            id="c3-week"
            action={
              <span className="c3-meta">
                {program ? r.c3WeekNotLogged : r.c3WeekSummary(client.done, client.planned)}
              </span>
            }
          >
            {r.c3Week}
          </SectionLabel>
          <Card pad="lg">
            <InfoTable
              label={r.c3Week}
              rows={[
                {
                  id: 'sessions',
                  label: r.c3Sessions,
                  value: program ? r.c3NotLogged : r.c3SessionsOf(client.done, client.planned),
                },
                {
                  id: 'streak',
                  label: r.c3Streak,
                  value: program ? r.c3NotLogged : r.roWeeksN(client.streakWeeks),
                },
                { id: 'logging', label: r.c3Logging, value: modeDescription(r, client.mode) },
                {
                  id: 'restriction',
                  label: r.c3Restriction,
                  value: injuryOff ? (
                    <LockedRow>{r.c3RestrictionLocked(first)}</LockedRow>
                  ) : (
                    (restrictionLine(app, client.injuries) ??
                    client.restriction ??
                    r.roNoneDeclared)
                  ),
                },
              ]}
            />
          </Card>
          {!injuryOff && injuries.length > 0 && (
            <Card pad="lg">
              <SectionLabel>{r.c3Injuries}</SectionLabel>
              <InfoTable
                label={r.c3Injuries}
                rows={injuries.map((i) => ({
                  id: i.id,
                  label: (
                    <>
                      {injuryName(app, i)}
                      {i.note?.split('\n')[0] && (
                        <span className="c3-info-sub">{i.note.split('\n')[0]}</span>
                      )}
                    </>
                  ),
                  value: i.healed ? r.c3InjHealed : (app.injStage[i.stage] ?? i.stage),
                }))}
              />
              <p className="c3-meta">{r.c3InjFoot}</p>
            </Card>
          )}
        </section>

        {wide && (
          <>
            <section aria-labelledby="c3-lifts">
              <SectionLabel
                id="c3-lifts"
                action={gated.lifts ? <span className="c3-meta">{r.c3LiftsMeta}</span> : undefined}
              >
                {r.c3Lifts}
              </SectionLabel>
              {gated.lifts ? (
                <DataTable
                  label={r.c3LiftsLabel}
                  columns={liftCols}
                  rows={gated.lifts.slice(0, 4)}
                  rowKey={(l) => l.id}
                  footer={
                    <Button
                      variant="link"
                      size="sm"
                      iconTrailing="arrow-right"
                      onClick={() =>
                        onNavigate({ screen: 'client', cid: client.id, tab: 'strength' })
                      }
                    >
                      {r.c3AllLifts}
                    </Button>
                  }
                />
              ) : (
                <Card>
                  <LockedRow>
                    {program ? r.c3OfflineLifts(first) : r.c3LiftsTotalsOnly(first)}
                  </LockedRow>
                </Card>
              )}
            </section>

            {!program && (
              <section>
                <SectionLabel>{r.c3Last5}</SectionLabel>
                {gated.sessions ? (
                  <DataTable
                    label={r.c3SessionsLabel}
                    columns={sessionCols}
                    rows={gated.sessions.slice(0, 5)}
                    rowKey={(s) => s.id}
                  />
                ) : (
                  <Card>
                    <LockedRow>{r.c3SessionsLocked(first)}</LockedRow>
                  </Card>
                )}
              </section>
            )}

            {rhythmBars && (
              <section aria-labelledby="c3-rhythm">
                <SectionLabel
                  id="c3-rhythm"
                  action={<span className="c3-meta">{r.c3RhythmMeta}</span>}
                >
                  {r.c3Rhythm}
                </SectionLabel>
                <Card pad="lg">
                  <RhythmChart
                    label={r.c3RhythmMeta}
                    bars={rhythmBars}
                    plan={client.planned}
                    legendDone={r.c3RhythmDone}
                    legendPlan={r.c3RhythmPlan(client.planned)}
                  />
                </Card>
              </section>
            )}
          </>
        )}
      </div>

      <Inspector label={r.c3Shares(first)} bare>
        <div className="c3-aside">
          {reqs.length > 0 && (
            <Card
              as="section"
              pad="lg"
              aria-labelledby="c3-resched"
              header={
                <span role="heading" aria-level={2} id="c3-resched">
                  {r.c3Reschedule}
                </span>
              }
            >
              <ClientRequests reqs={reqs} port={port} locale={locale} />
            </Card>
          )}
          <Card
            as="section"
            pad="lg"
            aria-labelledby="c3-days"
            header={
              <span role="heading" aria-level={2} id="c3-days">
                {r.c3TrainingDays}
              </span>
            }
          >
            <div className="c3-days" role="list" aria-label={r.c3TrainingDays}>
              {DOWS.map((d) => {
                const on = client.trainerDays.includes(d);
                return (
                  <Tag
                    key={d}
                    tone={on ? 'accent' : 'neutral'}
                    solid={on}
                    role="listitem"
                    aria-label={on ? r.c3DayWith(r.c3Dow[d]) : r.c3Dow[d]}
                  >
                    {r.c3Dow[d]}
                  </Tag>
                );
              })}
            </div>
            <p className="c3-m c3-days-n">
              {client.trainerDays.length
                ? r.c3YourSessions(first, trainerDaysText(r, client.trainerDays))
                : r.c3NoDays(first)}
            </p>
            {groupSlots.map((s) => (
              <p key={s.id} className="c3-m c3-group">
                <Icon name="users" />
                {r.c3GroupLine(s.title ?? '', headcount(s), s.capacity ?? headcount(s))} ·{' '}
                {coachMoment(s.start, locale)}
              </p>
            ))}
            {reqs.some((q) => q.kind === 'answer') && <p className="c3-m">{r.c3WaitingAnswer}</p>}
          </Card>
          <Card
            as="section"
            pad="lg"
            aria-labelledby="c3-shares"
            header={
              <span role="heading" aria-level={2} id="c3-shares">
                {r.c3Shares(first)}
              </span>
            }
          >
            {program ? (
              <p className="c3-m">{r.c3OfflineShares}</p>
            ) : (
              <ConsentChips
                label={r.c3SharesList}
                items={consentItems(r, client.name, client.consent, client.mode)}
                action={
                  askN > 0 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="key"
                      onClick={() => onNavigate(chatRoute(client.id))}
                    >
                      {r.c3AskShare(first, askN)}
                    </Button>
                  ) : undefined
                }
              />
            )}
          </Card>
        </div>
      </Inspector>
    </Split>
  );
}

export { ClientRequests };
