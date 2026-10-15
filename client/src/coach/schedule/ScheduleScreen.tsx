import { useMemo } from 'react';
import { CalendarSettingsForm } from './CalendarSettingsForm';
import { useCalendarSettings } from './calendarSettings';
import { useGymWeeks } from './gymHours';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Notice } from '../../components/ui/Notice';
import { Segmented } from '../../components/ui/Segmented';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { UndoToast } from '../../components/ui/UndoToast';
import { useMinWidth, COACH_BREAKPOINT } from '../../components/ui/breakpoints';
import { UNDO_MS } from '../chat/types';
import { useScheduleT, type ScheduleStrings } from '../../i18n/coachSchedule';
import type { CoachWorldPort } from '../data/port';
import { coachClock } from '../format';
import { Header, Page, Toolbar } from '../layout/Layout';
import { SidePanel } from '../layout/SidePanel';
import type { CoachRoute } from '../routes';
import { DayAgenda } from './DayAgenda';
import { formatDraft, lastDuration, parseDraft, type CreateDraft } from './grid';
import { longDate, monthYear, rangeLabel } from './labels';
import { legendKeyOf, parseHidden, toggleHidden, type LegendKey } from './legend';
import { MonthView } from './MonthView';
import { peopleOf } from './model';
import { usePeople } from './people';
import { QuickCreate } from './QuickCreate';
import { StateMark } from './StateMark';
import { RescheduleForm } from './RescheduleForm';
import { ScheduleBuilder } from './ScheduleBuilder';
import type { SchedulePort } from './port';
import { SessionInspector } from './SessionInspector';
import { useSwipe } from './swipe';
import { dayOfTs, monthStartDay, weekStartDay } from './time';
import { useSchedule } from './useSchedule';
import { useScheduleParams } from './useScheduleParams';
import { WeekGrid } from './WeekGrid';
import { gymName, scheduleGyms } from './types';
import './Schedule.css';
import { CoachProblemState } from '../BackendNotice';
import { offlineOrUnknown } from '../data/problem';

const keepSlot = (
  s: { gymId: string; attendees: { clientId: string }[] },
  gym: string | null,
  who: string | null,
) => (!gym || s.gymId === gym) && (!who || s.attendees.some((a) => a.clientId === who));

/** The legend: each chip is a filter of the calendar (aria-pressed = shown). Swatch and icon are the card's own (`StateMark`). */
const LEGEND: { key: LegendKey; label: (t: ScheduleStrings) => string }[] = [
  { key: 'planned', label: (t) => t.scPlanned },
  { key: 'inprogress', label: (t) => t.scInProgress },
  { key: 'done', label: (t) => t.scDone },
  { key: 'missed', label: (t) => t.scMissed },
  { key: 'proposed', label: (t) => t.scProposed },
  { key: 'overlap', label: (t) => t.scOverlapTag },
];

export interface ScheduleScreenProps {
  onNavigate: (r: CoachRoute) => void;
  /** Stories and tests inject their own; the app uses the configured schedule port. */
  port?: SchedulePort;
  worldPort?: CoachWorldPort;
}

/**
 * Schedule (`#/c/schedule`): the trainer's calendar. Week and Day are a time grid (desktop) or a day strip with an
 * agenda (phone); Month is the kit month grid. A session opens in the inspector (side column, or a sheet when narrow)
 * with Move / Cancel / Mark missed; "Add sessions" and "Move session" are forms in a sheet. Loading is a skeleton,
 * offline reads the cached schedule, and failures are notices over data that stays usable. The legend under the
 * calendar filters it (Planned / Done / Missed / Proposed move / Overlap); the choice lives in the hash (`hide=`).
 */
export function ScheduleScreen(p: ScheduleScreenProps) {
  const { s: t, locale } = useScheduleT();
  const prm = useScheduleParams();
  const sch = useSchedule(p.port, prm.d ?? undefined);
  const people = usePeople(p.worldPort);
  const wide = useMinWidth(COACH_BREAKPOINT);
  const { store, state } = sch;
  const cal = useCalendarSettings();
  const gymWeeks = useGymWeeks();
  /* The Gym filter lists the gyms the trainer ticked in the settings (every gym until one is ticked); the gym being
     filtered on stays listed so the select never shows a value it has no option for. */
  const allGyms = scheduleGyms();
  const chosenIds = cal.settings.gymIds.filter((id) => allGyms.some((g) => g.id === id));
  const filterGyms = allGyms.filter(
    (g) => chosenIds.length === 0 || chosenIds.includes(g.id) || g.id === prm.gym,
  );
  const hours = useMemo(
    () => ({ settings: cal.settings, gyms: gymWeeks }),
    [cal.settings, gymWeeks],
  );

  const today = dayOfTs(sch.now);
  const day = prm.d ?? today;
  const monday = weekStartDay(day);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => monday + i), [monday]);
  const shown = prm.view === 'day' && wide ? [day] : days;

  const hidden = useMemo(() => parseHidden(prm.hide), [prm.hide]);
  const slots = useMemo(
    () =>
      sch.slots.filter(
        (s) => keepSlot(s, prm.gym, prm.who) && !hidden.has(legendKeyOf(s, false, sch.now)),
      ),
    [sch.slots, prm.gym, prm.who, hidden, sch.now],
  );
  const ghosts = useMemo(
    () =>
      sch.ghosts.filter(
        (g) =>
          keepSlot(g.slot, prm.gym, prm.who) && !hidden.has(legendKeyOf(g.slot, true, sch.now)),
      ),
    [sch.ghosts, prm.gym, prm.who, hidden, sch.now],
  );
  /* the overlap flag is a legend filter too: off = no warning marks anywhere (the sessions stay) */
  const conflicts = useMemo(
    () => (hidden.has('overlap') ? new Set<string>() : sch.conflicts),
    [hidden, sch.conflicts],
  );

  const range =
    prm.view === 'month'
      ? [monthStartDay(day), monthStartDay(day, 1) - 1]
      : prm.view === 'day'
        ? [day, day]
        : [days[0], days[6]];
  const [from, until] = range;
  const counts = useMemo(() => {
    const n: Record<LegendKey, number> = {
      planned: 0,
      inprogress: 0,
      done: 0,
      missed: 0,
      proposed: 0,
      overlap: 0,
    };
    const inView = (d: number) => d >= from && d <= until;
    for (const s of sch.slots) {
      if (!keepSlot(s, prm.gym, prm.who) || !inView(dayOfTs(s.start))) continue;
      n[legendKeyOf(s, false, sch.now)] += 1;
      if (s.status !== 'moved' && sch.conflicts.has(s.id)) n.overlap += 1;
    }
    for (const g of sch.ghosts)
      if (keepSlot(g.slot, prm.gym, prm.who) && inView(dayOfTs(g.start))) n.proposed += 1;
    return n;
  }, [sch.slots, sch.ghosts, sch.conflicts, sch.now, prm.gym, prm.who, from, until]);
  const inRange = slots.filter(
    (s) => s.status !== 'moved' && dayOfTs(s.start) >= range[0] && dayOfTs(s.start) <= range[1],
  );
  const clashes = inRange.filter((s) => conflicts.has(s.id));
  const clashNames = [...new Set(clashes.flatMap((s) => peopleOf(s).map(people.first)))].join(', ');
  const open = ghosts.filter(
    (g) => dayOfTs(g.start) >= range[0] && dayOfTs(g.start) <= range[1],
  ).length;

  const selected = prm.open ? (sch.slots.find((s) => s.id === prm.open) ?? null) : null;
  const closeForm = () => prm.set({ form: null, slot: null, client: null, req: null });
  /* paging is a history entry: Back returns to the week before, a refresh stays on the page (`d` in the hash) */
  const step = (dir: -1 | 1) =>
    prm.set(
      {
        d:
          prm.view === 'month' ? monthStartDay(day, dir) : day + dir * (prm.view === 'day' ? 1 : 7),
        open: null,
      },
      true,
    );
  const goToday = () => prm.set({ d: null, open: null }, true);
  const showsToday = today >= from && today <= until;
  const swipe = useSwipe(step);
  const unit = prm.view === 'month' ? 'Month' : prm.view === 'day' ? 'Day' : 'Week';
  const prevLabel = t[`scPrev${unit}` as 'scPrevWeek'];
  const nextLabel = t[`scNext${unit}` as 'scNextWeek'];
  const label =
    prm.view === 'month'
      ? monthYear(day, locale)
      : prm.view === 'day'
        ? longDate(day, locale)
        : rangeLabel(days[0], days[6], locale);
  /* the create form lives in the hash too (`create=day.start.dur`): a refresh keeps it, a link or a story opens it */
  const draft = parseDraft(prm.create);
  const setDraft = (d: CreateDraft | null) =>
    prm.set({ create: d ? formatDraft(d) : null, ...(d ? { open: null } : {}) });
  const goChat = (id: string) => {
    window.location.assign(`#/c/chat?with=${id}`);
  };
  const ghostDur = lastDuration(); // a cheap read; changes after each save
  /* a click on the faint scrim: on a session behind it that selects that session (the panel swaps its content), else closes */
  const scrimClick = (e: React.MouseEvent<HTMLElement>) => {
    const hit = (document.elementsFromPoint?.(e.clientX, e.clientY) ?? []).find(
      (el) => el instanceof HTMLElement && el.matches('.sc-block'),
    );
    if (hit instanceof HTMLElement) hit.click();
    else prm.set({ open: null });
  };
  const firstClash = [...clashes].sort((a, b) => a.start - b.start)[0];

  const loadingFirst = sch.loading && state.docs.length === 0;
  const failedFirst = state.status === 'error' && state.docs.length === 0;
  /* no sessions yet: the calendar still shows (an empty grid), with a short hint above it instead of an empty state */
  const empty = state.status !== 'loading' && state.docs.length === 0 && !failedFirst;

  const inspector = selected && (
    <SessionInspector
      slot={selected}
      clash={sch.conflicts.has(selected.id)}
      slots={sch.slots}
      requests={state.requests}
      store={store}
      people={people}
      t={t}
      locale={locale}
      now={sch.now}
      onMove={(slot, clientId) =>
        prm.set({ form: 'move', slot: slot.id, client: clientId ?? null })
      }
      onOpenClient={(cid) => p.onNavigate({ screen: 'client', cid })}
      onMessage={goChat}
      onJump={(id) => prm.set({ open: id })}
    />
  );

  const view = (
    <>
      {prm.view === 'month' ? (
        <MonthView
          month={day}
          slots={slots}
          conflicts={conflicts}
          selected={prm.d}
          today={today}
          people={people}
          t={t}
          size={wide ? 'lg' : 'sm'}
          onSelect={(d) => prm.set({ view: 'day', d, open: null })}
        />
      ) : wide ? (
        <WeekGrid
          days={shown}
          slots={slots}
          ghosts={ghosts}
          conflicts={conflicts}
          now={sch.now}
          today={today}
          selected={prm.open}
          onSelect={(id) => prm.set({ open: id })}
          people={people}
          t={t}
          locale={locale}
          ghostDur={ghostDur}
          hours={hours}
          onCreate={setDraft}
        />
      ) : (
        <DayAgenda
          days={days}
          day={day}
          onDay={(d) => prm.set({ d, open: null })}
          slots={slots}
          conflicts={conflicts}
          selected={prm.open}
          onSelect={(id) => prm.set({ open: id })}
          people={people}
          t={t}
          locale={locale}
          today={today}
          now={sch.now}
          onCreate={(d) => setDraft({ day: d, start: 9 * 60, dur: null })}
        />
      )}
      <div className="sc-legend" role="group" aria-label={t.scLegend}>
        <span className="sc-legend-hint">{t.scLegendHint}</span>
        {LEGEND.map(({ key, label: name }) => (
          <Chip
            key={key}
            size="xs"
            selected={false}
            aria-pressed={!hidden.has(key)}
            className={hidden.has(key) ? 'sc-legend-off' : undefined}
            onClick={() => prm.set({ hide: toggleHidden(hidden, key), open: null })}
          >
            <StateMark state={key} />
            {name(t)}
            <span className="sc-legend-n">{counts[key]}</span>
          </Chip>
        ))}
        {wide && prm.view !== 'month' && <span className="sc-legend-create">{t.qcHint}</span>}
      </div>
    </>
  );

  const form =
    prm.form === 'settings' ? (
      cal.loaded ? (
        <CalendarSettingsForm t={t} locale={locale} today={today} onClose={closeForm} />
      ) : (
        <Skeleton height={240} />
      )
    ) : prm.form === 'plan' || prm.form === 'oneoff' ? (
      <ScheduleBuilder
        store={store}
        people={people}
        slots={sch.slots}
        t={t}
        locale={locale}
        today={today}
        mode={prm.form === 'oneoff' ? 'oneoff' : 'weekly'}
        clientIds={prm.client ? [prm.client] : []}
        onClose={closeForm}
      />
    ) : prm.form === 'move' || prm.form === 'pick' || prm.form === 'counter' ? (
      <RescheduleForm
        store={store}
        people={people}
        slots={sch.slots}
        requests={state.requests}
        t={t}
        locale={locale}
        now={sch.now}
        today={today}
        titleInPanel
        mode={prm.form === 'move' ? 'known' : prm.form}
        slot={prm.form === 'move' ? sch.slots.find((s) => s.id === prm.slot) : undefined}
        clientId={prm.client ?? undefined}
        counterOf={
          prm.form === 'counter' ? state.requests.find((r) => r.id === prm.req) : undefined
        }
        onClose={closeForm}
        onOpenChat={goChat}
      />
    ) : null;

  const failMsg =
    state.failed === 'save'
      ? t.scFailSave
      : state.failed === 'conflict'
        ? t.scFailConflict
        : state.failed === 'request'
          ? t.scFailRequest
          : state.failed === 'answer'
            ? t.scFailAnswer
            : state.failed === 'expired'
              ? t.scFailExpired
              : state.failed === 'vault-locked'
                ? t.scFailVault
                : state.failed === 'limit'
                  ? t.scFailLimit
                  : null;

  return (
    <Page className="sc-page">
      <Header
        eyebrow={t.scEyebrow}
        title={t.scTitle}
        actions={
          wide ? (
            <>
              <IconButton
                icon="sliders-horizontal"
                variant="secondary"
                label={t.hsOpen}
                onClick={() => prm.set({ form: 'settings' })}
              />
              <Button variant="secondary" icon="plus" onClick={() => prm.set({ form: 'oneoff' })}>
                {t.scOneOff}
              </Button>
              <Button icon="calendar-plus" onClick={() => prm.set({ form: 'plan' })}>
                {t.scAddSessions}
              </Button>
            </>
          ) : undefined
        }
      />

      <Toolbar label={t.scViewLabel} className="sc-toolbar">
        <div className="sc-nav" role="group" aria-label={t.scNavLabel}>
          <IconButton
            icon="caret-left"
            variant="secondary"
            label={prevLabel}
            onClick={() => step(-1)}
          />
          <span className="sc-nav-label" role="status" aria-live="polite">
            {label}
          </span>
          <IconButton
            icon="caret-right"
            variant="secondary"
            label={nextLabel}
            onClick={() => step(1)}
          />
          <Button variant="secondary" disabled={showsToday} onClick={goToday}>
            {t.scToday}
          </Button>
          {!wide && (
            <IconButton
              icon="calendar-plus"
              label={t.scAddSessions}
              onClick={() => prm.set({ form: 'plan' })}
            />
          )}
        </div>
        <Segmented
          label={t.scViewLabel}
          value={prm.view}
          onChange={(view) => prm.set({ view, open: null })}
          options={[
            { value: 'week', label: t.scWeek },
            { value: 'day', label: t.scDay },
            { value: 'month', label: t.scMonth },
          ]}
        />
        <div className="sc-toolbar-filters">
          <Select
            labelInline
            label={t.scGymLabel}
            value={prm.gym ?? ''}
            onChange={(e) => prm.set({ gym: e.target.value || null, open: null })}
          >
            <option value="">{t.scAllGyms}</option>
            {filterGyms.map((g) => (
              <option key={g.id} value={g.id}>
                {gymName(g.id)}
              </option>
            ))}
          </Select>
          <Select
            labelInline
            label={t.scClientLabel}
            value={prm.who ?? ''}
            onChange={(e) => prm.set({ who: e.target.value || null, open: null })}
          >
            <option value="">{t.scAllClients}</option>
            {people.list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {!wide && (
            <IconButton
              icon="sliders-horizontal"
              variant="secondary"
              className="sc-filters-btn"
              label={t.hsOpen}
              onClick={() => prm.set({ form: 'settings' })}
            />
          )}
        </div>
      </Toolbar>

      <div className="sc-notices">
        {state.status === 'offline' && (
          <Notice tone="note" icon="cloud-slash" role="status">
            {t.scOfflineNote}
          </Notice>
        )}
        {state.status === 'stale' && state.asOf != null && (
          <Notice tone="neutral" icon="arrows-clockwise" role="status">
            {t.scStaleNote(coachClock(state.asOf))}
          </Notice>
        )}
        {failMsg && (
          <Notice
            tone="danger"
            icon="warning"
            role="alert"
            trail={
              <Button variant="secondary" size="sm" onClick={store.clearFailed}>
                {t.scDismiss}
              </Button>
            }
          >
            {failMsg}
          </Notice>
        )}
      </div>

      {loadingFirst ? (
        <div className="sc-loading" role="status" aria-label={t.scLoading}>
          <Skeleton height={24} />
          <Skeleton height={320} />
        </div>
      ) : failedFirst ? (
        <CoachProblemState inline problem={offlineOrUnknown()} onRetry={store.retry} />
      ) : (
        <>
          {empty && (
            <Notice tone="neutral" icon="calendar-blank" role="status">
              <strong>{t.scEmptyH}.</strong> {t.scEmptyB}
            </Notice>
          )}
          <div className="sc-summary" role="status">
            <strong>{t.scSummary(inRange.length)}</strong>
            {open > 0 && <span>{t.scRequestsN(open)}</span>}
            {firstClash && (
              <Chip
                tone="danger"
                size="xs"
                icon="warning"
                className="sc-overlap-pill"
                aria-label={t.scOverlapOpen(clashNames)}
                onClick={() => prm.set({ open: firstClash.id })}
              >
                {t.scOverlap(clashNames)}
              </Chip>
            )}
            {(prm.who || prm.gym) && (
              <Button variant="link" size="sm" onClick={() => prm.set({ who: null, gym: null })}>
                {t.scClearFilter}
              </Button>
            )}
          </div>
          <Card pad="none" className="sc-view" {...(wide && prm.view !== 'month' ? {} : swipe)}>
            {view}
          </Card>
        </>
      )}

      {selected && !form && !draft && (
        <SidePanel
          open
          onClose={() => prm.set({ open: null })}
          title={t.scInspectorH}
          closeLabel={t.scInspectorClose}
          scrim="light"
          onScrimClick={scrimClick}
        >
          {inspector}
        </SidePanel>
      )}
      {form && (
        <SidePanel
          open
          onClose={closeForm}
          title={
            prm.form === 'settings'
              ? t.hsTitle
              : prm.form === 'plan' || prm.form === 'oneoff'
                ? t.bdTitle
                : prm.form === 'counter'
                  ? t.rfTitleCounter
                  : t.rfTitle
          }
          closeLabel={t.scClosePanel}
        >
          {form}
        </SidePanel>
      )}
      {draft && !form && (
        <SidePanel
          open
          onClose={() => setDraft(null)}
          title={t.qcTitle}
          closeLabel={t.scClosePanel}
        >
          <QuickCreate
            key={`${draft.day}:${draft.start}:${draft.dur ?? ''}`}
            store={store}
            people={people}
            slots={sch.slots}
            t={t}
            locale={locale}
            now={sch.now}
            draft={draft}
            onClose={() => setDraft(null)}
          />
        </SidePanel>
      )}
      {state.pendingSave && (
        <UndoToast
          position="fixed"
          text={state.pendingSave.label}
          icon="calendar-check"
          undoLabel={t.scUndo}
          countdownLabel={t.scUndoCount}
          durationMs={UNDO_MS}
          onUndo={() => void store.undoSave()}
        />
      )}
    </Page>
  );
}
