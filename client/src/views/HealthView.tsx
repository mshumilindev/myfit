/**
 * Health — the full page behind Start › Health (design docs/design/health,
 * F01–F10 mobile, W01–W03 web). It replaced the old "Rest & recovery" drawer.
 *
 *   Home     Now (active illness / rest / injuries, welcome back), Sleep, Start,
 *            Log the past, History preview.
 *   Forms    one grouped-list form for start / backfill / edit (HealthForm).
 *   History  List (edit, swipe to delete) | Timeline (view-only).
 *
 * Sleep details and the injury rehab plan stay their existing screens
 * (overlays 'sleep' and 'injury'). Web (≥720px): lists left, History (timeline
 * by default) right; forms and edits open in the right panel.
 */
import { BackButton } from '../components/ui/BackButton';
import { useEffect, useState, type ReactNode } from 'react';
import type { Shell } from '../App';
import { useT } from '../i18n';
import { illnessState } from '../illness';
import { sleepBlockedBy, SLEEP_BLOCK_KEY } from '../sleepGuard';
import { dayKey, endRestPeriod, liveSleep, startSleep, useStore } from '../store';
import { activeInjuries, inFullRest } from '../injury';
import { lastNight, nightDurationMin } from '../sleep';
import { fmtDurationHuman } from '../i18n';
import { rangeEnd, type HealthFormSpec, type HealthItem } from '../health';
import type { RestPeriod } from '../types';
import { ConfirmDialog, useIsDesktop } from '../ui';
import { HealthForm, type RehabPrefill } from './health/HealthForm';
import {
  HistControls,
  HistoryList,
  HistoryTimeline,
  useHealthItems,
  type HistFilter,
} from './health/HealthHistory';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { StickyActionBar } from '../components/ui/StickyActionBar';
import { ToneText } from '../components/ui/ToneText';
import {
  Ic,
  KIT_TONE,
  STAGE_TOTAL,
  fmtDay,
  fmtRange,
  fmtRangeWd,
  hhmm,
  iconOf,
  injuryLabel,
  itemLabel,
  periodLabel,
  stageNo,
  itemTone,
  toneOf,
  typeName,
} from './health/parts';
import { ConditionPage, ConditionsSection } from './health/Conditions';
import { NicotineHealthGroup } from './health/nicotine/NicotineSection';
import { NicotineScreens } from './health/nicotine/NicotineScreens';
import { AlcoholHealthRow } from './health/alcohol/AlcoholSection';
import { AlcoholScreens } from './health/alcohol/AlcoholScreens';
import { SupplementHealthRow } from './health/supplements/SupplementSection';
import { SupplementScreens } from './health/supplements/SupplementScreens';
import { SupplementQuickStartSheet } from './health/supplements/SupplementQuickStartSheet';
import { hasSupplementData } from '../supplements';
import { HealthPrivacyView } from './health/HealthPrivacyView';
import { isFlagOn } from '../data/flags';
import './Health.css';
import { Button } from '../components/ui/Button';

export interface HealthViewProps {
  shell: Shell;
  view?: 'history';
  hist?: 'list' | 'timeline';
  form?: HealthFormSpec;
  cond?: string;
  condKey?: string;
  /** A Nicotine page: the hub, What I use, Use in calculations. */
  nic?: 'hub' | 'products' | 'calc';
  /** An Alcohol page: the hub, What I drink, Usual days, Use in calculations. */
  alc?: 'hub' | 'products' | 'days' | 'calc';
  /** A Supplements page: the hub, What I take, Use in calculations. */
  sup?: 'hub' | 'products' | 'calc';
  /** Health › Privacy and sharing (all health privacy in one place). */
  priv?: boolean;
  onClose: () => void;
}

export function HealthView(props: HealthViewProps) {
  const { shell } = props;
  const { t, locale } = useT();
  const store = useStore();
  const web = useIsDesktop();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const today = dayKey(now);
  const [filter, setFilter] = useState<HistFilter>('all');
  const [webHist, setWebHist] = useState<'list' | 'timeline'>(
    props.view === 'history' ? 'list' : 'timeline',
  );
  const [recover, setRecover] = useState<RestPeriod | null>(null);
  const [endRest, setEndRest] = useState<RestPeriod | null>(null);
  const [supQuick, setSupQuick] = useState(false);

  const go = (o: Omit<HealthViewProps, 'shell' | 'onClose'>, replace = false) => {
    const next = { screen: 'health' as const, ...o };
    if (replace) shell.replaceOverlay(next);
    else shell.openOverlay(next);
  };
  /** Forms: a new page on mobile; the right panel on web (replaced, not stacked). */
  const openForm = (form: HealthFormSpec) =>
    go({ view: props.view, hist: props.hist, form }, web && !!props.form);
  const closeForm = () => props.onClose();
  const onRehab = (p: RehabPrefill) => shell.replaceOverlay({ screen: 'injury', prefill: p });

  const openItem = (it: HealthItem) => {
    if (it.injury && it.ongoing) return shell.openOverlay({ screen: 'injury', injuryId: it.id });
    if (it.injury) return openForm({ kind: 'edit-injury', injuryId: it.id });
    openForm({ kind: 'edit', periodId: it.id });
  };

  // --- current state -----------------------------------------------------------
  const covering = store.restPeriods
    .filter((p) => p.startDay <= today && (p.open === true || p.endDay >= today))
    .sort((a, b) => b.createdAt - a.createdAt);
  const illness = covering.find((p) => p.mode === 'illness') ?? null;
  const rest = covering.find((p) => p.mode !== 'illness') ?? null;
  const upcoming = store.restPeriods
    .filter((p) => p.startDay > today)
    .sort((a, b) => a.startDay - b.startDay);
  const injuries = activeInjuries(store.injuries);
  const ill = illnessState(store.restPeriods, store.workouts, now);
  const ret = illness || ill.phase !== 'returning' ? null : ill;
  const lastIll = ret ? (store.restPeriods.find((r) => r.id === ret.periodId) ?? null) : null;
  const items = useHealthItems(now);
  const recent = items.filter((i) => !i.ongoing && !i.future).slice(0, 2);

  const fd = (d: number) => fmtDay(d, locale, today);

  // --- Now ----------------------------------------------------------------------
  const nowGroups: ReactNode[] = [];
  if (illness) {
    const dayN = today - illness.startDay + 1;
    nowGroups.push(
      <GroupedList key="ill" header={t.hlNowWhat(t.restModeIllness)} footer={t.hlIllnessFoot}>
        <ListRow
          icon={<Ic tone="ill" name="thermo" />}
          label={periodLabel(illness, t)}
          sub={
            illness.open
              ? t.hlSinceNoEnd(fd(illness.startDay))
              : fmtRange(illness.startDay, illness.endDay, locale, today)
          }
          value={t.hlDayN(dayN)}
          valueTone="illness"
          valueStrong
          chevron
          onClick={() => openForm({ kind: 'edit', periodId: illness.id })}
        />
        <ListRow icon={<Ic tone="neu" name="shield" />} label={t.hlStreakProgram} />
        <ListRow
          action
          tone="illness"
          label={t.illnessRecovered}
          onClick={() => setRecover(illness)}
        />
      </GroupedList>,
    );
  }
  if (rest) {
    const total = rest.endDay - rest.startDay + 1;
    const dayN = today - rest.startDay + 1;
    const tone = KIT_TONE[toneOf(rest.mode)];
    nowGroups.push(
      <GroupedList key="rest" header={t.hlNowWhat(typeName(rest.mode, t))}>
        <ListRow
          icon={<Ic tone={toneOf(rest.mode)} name={iconOf(rest.mode)} />}
          label={periodLabel(rest, t)}
          sub={
            rest.open
              ? t.hlSinceNoEnd(fd(rest.startDay))
              : fmtRange(rest.startDay, rest.endDay, locale, today)
          }
          value={rest.open ? t.hlDayN(dayN) : t.restDayOf(Math.min(dayN, total), total)}
          valueTone={tone}
          valueStrong
          chevron
          onClick={() => openForm({ kind: 'edit', periodId: rest.id })}
        />
        <ListRow
          icon={<Ic tone="neu" name={rest.mode === 'active' ? 'pulse' : 'shield'} />}
          label={rest.mode === 'active' ? t.restCardActiveNote : t.restCardOffNote}
        />
        <ListRow action tone={tone} label={t.restEndNow} onClick={() => setEndRest(rest)} />
      </GroupedList>,
    );
  }
  if (ret && lastIll) {
    nowGroups.push(
      <GroupedList
        key="back"
        header={t.hlNow}
        footer={t.hlNowInHistory(fmtRange(lastIll.startDay, lastIll.endDay, locale, today))}
      >
        <ListRow
          icon={<Ic tone="gym" name="sun" />}
          label={t.hlWelcomeBack}
          sub={ret.steps > 0 ? t.illRetTitle(ret.step, ret.steps) : t.hlTakeEasy}
          value={t.today}
        />
        <ListRow
          icon={<Ic tone="neu" name="shield" />}
          label={t.hlOutDays(ret.days)}
          sub={t.hlNoStreakLost}
          value={t.hlStreakKept}
        />
        <ListRow
          icon={<Ic tone="neu" name="pause" />}
          label={t.hlProgram}
          sub={t.hlLighterToday}
          value={t.hlResumed}
        />
      </GroupedList>,
    );
  }
  for (const inj of injuries) {
    const full = inFullRest(inj, today);
    nowGroups.push(
      <GroupedList key={inj.id} header={t.hlNowWhat(injuryLabel(inj, t))}>
        <ListRow
          icon={<Ic tone="inj" name="bandage" />}
          label={t.hlRehabPlan}
          sub={
            <>
              {t.hlStageOf(stageNo(inj), STAGE_TOTAL)} ·{' '}
              <ToneText tone="injury">
                {full ? t.injStage0 : (t.injStage[inj.stage] ?? inj.stage)}
              </ToneText>
            </>
          }
          chevron
          onClick={() => shell.openOverlay({ screen: 'injury', injuryId: inj.id })}
        />
        <ListRow
          icon={<Ic tone="inj" name="clock" />}
          label={t.hlNextCheckin}
          sub={t.hlHowFelt}
          value={
            full ? t.injStage0Left((inj.fullRestUntil ?? today) - today) : t.hlAfterNextSession
          }
        />
      </GroupedList>,
    );
  }
  if (upcoming.length > 0) {
    nowGroups.push(
      <GroupedList key="up" header={t.hlComingUp}>
        {upcoming.map((p) => (
          <ListRow
            key={p.id}
            icon={<Ic tone={toneOf(p.mode)} name={iconOf(p.mode)} />}
            label={periodLabel(p, t)}
            sub={fmtRange(p.startDay, rangeEnd(p, today), locale, today)}
            value={t.hlStartsIn(p.startDay - today)}
            chevron
            onClick={() => openForm({ kind: 'edit', periodId: p.id })}
          />
        ))}
      </GroupedList>,
    );
  }
  if (nowGroups.length === 0) {
    nowGroups.push(
      <GroupedList key="clear" header={t.hlNow} footer={t.hlNothingActive}>
        <ListRow icon={<Ic tone="neu" name="shield" />} label={t.hlStatus} value={t.hlAllClear} />
      </GroupedList>,
    );
  }

  // --- Sleep ----------------------------------------------------------------------
  const live = liveSleep(store.sleeps);
  const last = lastNight(store.sleeps);
  const sleepBlock = sleepBlockedBy(store);
  const sleepGroup = (
    <GroupedList key="sleep" header={t.sleepTitle}>
      <ListRow
        icon={<Ic tone="slp" name="moon" />}
        label={t.hlLastNight}
        sub={last && last.wake ? `${hhmm(last.bedtime)}–${hhmm(last.wake)}` : t.sleepNoLastNight}
        value={last && last.wake ? fmtDurationHuman(nightDurationMin(last) * 60000) : undefined}
        chevron
        // Last night's own details (same screen History opens for a night);
        // no night yet → the sleep page, where one can be logged.
        onClick={() =>
          shell.openOverlay(
            last ? { screen: 'sleep', mode: 'edit', nightId: last.id } : { screen: 'sleep' },
          )
        }
      />
      <ListRow
        icon={<Ic tone="slp" name="clock" />}
        label={
          <ToneText tone="sleep" strong>
            {live ? t.sleepAsleepSince(hhmm(live.bedtime)) : t.sleepStart}
          </ToneText>
        }
        sub={!live && sleepBlock ? t[SLEEP_BLOCK_KEY[sleepBlock]] : undefined}
        disabled={!live && !!sleepBlock}
        onClick={() => {
          if (live || startSleep()) shell.openOverlay({ screen: 'sleep' });
        }}
      />
      <ListRow
        icon={<Ic tone="slp" name="calClock" />}
        label={t.hlSleepDetails}
        sub={t.hlSleepDetailsSub}
        chevron
        onClick={() => shell.openOverlay({ screen: 'sleep' })}
      />
    </GroupedList>
  );

  // --- Start / Log the past -----------------------------------------------------------
  const isSel = (f: HealthFormSpec) =>
    web &&
    props.form?.kind === 'new' &&
    f.kind === 'new' &&
    props.form.ctx === f.ctx &&
    (props.form.type === f.type ||
      (f.ctx === 'past' && f.type === 'off' && props.form.type === 'active'));
  const startRow = (f: HealthFormSpec & { kind: 'new' }, label: string, sub: string) => (
    <ListRow
      icon={<Ic tone={toneOf(f.type)} name={iconOf(f.type)} />}
      label={label}
      sub={sub || undefined}
      chevron
      selected={isSel(f)}
      aria-current={isSel(f) ? 'true' : undefined}
      onClick={() => openForm(f)}
    />
  );
  const startGroup = (
    <GroupedList key="start" header={t.hlStart} footer={t.hlStartFoot}>
      {startRow({ kind: 'new', ctx: 'start', type: 'off' }, t.hlFullRest, t.hlFullRestSub)}
      {startRow({ kind: 'new', ctx: 'start', type: 'active' }, t.restModeActive, t.hlActiveSub)}
      {illness ? (
        <ListRow
          dim
          icon={<Ic tone="ill" name="thermo" />}
          label={t.restModeIllness}
          sub={t.hlUnwellSub}
          value={t.hlActiveTag}
        />
      ) : (
        startRow({ kind: 'new', ctx: 'start', type: 'illness' }, t.restModeIllness, t.hlUnwellSub)
      )}
      <ListRow
        icon={<Ic tone="inj" name="bandage" />}
        label={t.hlInjuryRehab}
        sub={t.hlInjuryRehabSub}
        chevron
        onClick={() => shell.openOverlay({ screen: 'injury' })}
      />
    </GroupedList>
  );
  const pastGroup = (
    <GroupedList key="past" header={t.hlLogPast} footer={t.hlLogPastNote}>
      {startRow({ kind: 'new', ctx: 'past', type: 'illness' }, t.hlWasUnwell, '')}
      {startRow({ kind: 'new', ctx: 'past', type: 'off' }, t.hlTookBreak, t.hlTookBreakSub)}
      {startRow({ kind: 'new', ctx: 'past', type: 'injury' }, t.hlGotHurt, '')}
    </GroupedList>
  );
  const conditionsGroup = isFlagOn('conditions') ? (
    <ConditionsSection key="cond" onOpen={(cond) => go({ cond })} />
  ) : null;
  const lifestyleGroup = (
    <NicotineHealthGroup key="life" onOpen={() => go({ nic: 'hub' })}>
      <AlcoholHealthRow onOpen={() => go({ alc: 'hub' })} />
      <SupplementHealthRow
        onOpen={() =>
          hasSupplementData(store.supplements) ? go({ sup: 'hub' }) : setSupQuick(true)
        }
      />
    </NicotineHealthGroup>
  );
  const sharingLabel = (l: 'off' | 'effects' | 'full') =>
    ({ off: t.nicPrivOff, effects: t.nicPrivEffects, full: t.nicPrivFull })[l];
  const levels = [
    ...(isFlagOn('conditions') ? [store.conditionsShare] : []),
    store.nicotine.settings.sharing,
    store.alcohol.settings.sharing,
    store.supplements?.settings.sharing ?? 'off',
  ];
  const privacyGroup = (
    <GroupedList key="priv" header={t.hlPrivacy}>
      <ListRow
        icon={<IconTile tone="neutral" size={30} icon="lock" />}
        label={t.hlPrivRow}
        value={
          levels.every((l) => l === levels[0])
            ? t.hlPrivCoach(sharingLabel(levels[0]))
            : t.hlPrivMixed
        }
        chevron
        onClick={() => go({ priv: true })}
      />
    </GroupedList>
  );
  const historyGroup = (
    <GroupedList key="hist" header={t.hlHistory}>
      {recent.map((it) => (
        <ListRow
          key={it.id}
          icon={
            <Ic tone={itemTone(it)} name={iconOf(it.kind === 'injury' ? 'injury' : it.mode!)} />
          }
          label={itemLabel(it, t)}
          sub={t.hlTypeDays(
            it.injury ? t.hlFilter.injury : typeName(it.mode!, t),
            it.endDay - it.startDay + 1,
          )}
          value={fmtRange(it.startDay, it.endDay, locale, today)}
          chevron
          onClick={() => openItem(it)}
        />
      ))}
      <ListRow
        label={
          <ToneText tone="accent" strong>
            {t.hlSeeAll}
          </ToneText>
        }
        value={t.hlListTimeline}
        chevron
        onClick={() => go({ view: 'history', hist: 'list' })}
      />
    </GroupedList>
  );

  // --- sheets / dialogs ------------------------------------------------------------------
  const overlays = (
    <>
      {supQuick && (
        <SupplementQuickStartSheet
          onClose={() => setSupQuick(false)}
          onMore={() => {
            setSupQuick(false);
            go({ sup: 'products' });
          }}
        />
      )}
      {recover && (
        <RecoveredSheet
          period={recover}
          today={today}
          onStill={() => setRecover(null)}
          onConfirm={() => {
            endRestPeriod(recover.id, now);
            setRecover(null);
          }}
        />
      )}
      {endRest && (
        <ConfirmDialog
          title={t.restEndTitle}
          body={t.restEndBody}
          confirmLabel={t.restEndNow}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            endRestPeriod(endRest.id, now);
            setEndRest(null);
          }}
          onCancel={() => setEndRest(null)}
        />
      )}
    </>
  );

  // A form for a period / injury that no longer exists (deleted elsewhere, or a
  // stale #/health/edit/<id> link) falls back to the page itself.
  const formOk =
    !!props.form &&
    (props.form.kind === 'new' ||
      (props.form.kind === 'edit' &&
        store.restPeriods.some((p) => p.id === (props.form as { periodId: string }).periodId)) ||
      (props.form.kind === 'edit-injury' &&
        store.injuries.some((i) => i.id === (props.form as { injuryId: string }).injuryId)));
  const form =
    props.form && formOk ? (
      <HealthForm
        key={JSON.stringify(props.form)}
        spec={props.form}
        now={now}
        web={web}
        onCancel={closeForm}
        onDone={closeForm}
        onRehab={onRehab}
      />
    ) : null;
  const condPage =
    !form && props.cond && isFlagOn('conditions') ? (
      <ConditionPage
        cond={props.cond}
        condKey={props.condKey}
        web={web}
        onBack={props.onClose}
        onPickKey={(key) => go({ cond: 'new', condKey: key }, true)}
      />
    ) : null;

  // Privacy and Nicotine pages replace the whole Health overview (mobile and web).
  if (props.priv) return <HealthPrivacyView onBack={props.onClose} />;
  if (props.nic)
    return (
      <NicotineScreens screen={props.nic} onOpen={(nic) => go({ nic })} onBack={props.onClose} />
    );
  if (props.alc)
    return (
      <AlcoholScreens screen={props.alc} onOpen={(alc) => go({ alc })} onBack={props.onClose} />
    );
  if (props.sup)
    return (
      <SupplementScreens screen={props.sup} onOpen={(sup) => go({ sup })} onBack={props.onClose} />
    );

  // ============================ mobile ============================
  if (!web) {
    if (form) return form;
    if (condPage) return condPage;
    if (props.view === 'history') {
      const mode = props.hist ?? 'list';
      return (
        <div className="screen hl">
          <div className="hl-pbar">
            <BackButton label={t.backAction} onClick={props.onClose} />
            <h1 className="hl-pt">{t.hlHistoryTitle}</h1>
          </div>
          <div className="hl-scroll">
            <div className="hl-cnt">
              <HistControls
                mode={mode}
                filter={filter}
                onMode={(m) => go({ view: 'history', hist: m }, true)}
                onFilter={setFilter}
              />
              {mode === 'list' ? (
                <HistoryList now={now} filter={filter} web={false} onOpen={openItem} />
              ) : (
                <>
                  <HistoryTimeline now={now} filter={filter} web={false} />
                  <GroupedList header={t.hlNotOnTimeline}>
                    <ListRow
                      icon={<Ic tone="slp" name="calClock" />}
                      label={t.hlSleepDetails}
                      sub={t.hlSleepOwnHistory}
                      chevron
                      onClick={() => shell.openOverlay({ screen: 'sleep' })}
                    />
                  </GroupedList>
                </>
              )}
            </div>
          </div>
          {mode === 'list' && (
            <StickyActionBar>
              <Button
                variant="primary"
                fullWidth

                onClick={() => openForm({ kind: 'new', ctx: 'past', type: 'illness' })}
              >
                {t.hlLogPast}
              </Button>
            </StickyActionBar>
          )}
        </div>
      );
    }
    return (
      <div className="screen hl">
        <div className="hl-pbar">
          <BackButton label={t.backAction} onClick={props.onClose} />
          <h1 className="hl-pt">{t.startHealthTitle}</h1>
        </div>
        <div className="hl-scroll">
          <div className="hl-cnt">
            {nowGroups}
            {sleepGroup}
            {startGroup}
            {pastGroup}
            {conditionsGroup}
            {lifestyleGroup}
            {historyGroup}
            {privacyGroup}
          </div>
        </div>
        {overlays}
      </div>
    );
  }

  // ============================ web ============================
  // The overview stays on the left in both history modes; the right pane
  // switches between the list and the timeline (no separate full-width page).
  const left = (
    <section className="hl-pane" aria-label={t.startHealthTitle}>
      <div className="hl-wc">
        {form || condPage ? (
          <>
            {nowGroups}
            {sleepGroup}
            {startGroup}
            {pastGroup}
            {conditionsGroup}
            {lifestyleGroup}
            {privacyGroup}
          </>
        ) : (
          <div className="hl-cols">
            <div className="hl-col">
              {nowGroups}
              {sleepGroup}
            </div>
            <div className="hl-col">
              {startGroup}
              {pastGroup}
              {conditionsGroup}
              {lifestyleGroup}
              {privacyGroup}
            </div>
          </div>
        )}
      </div>
    </section>
  );
  const right = form ? (
    form
  ) : condPage ? (
    condPage
  ) : (
    <section className="hl-pane hl-hist" aria-labelledby="hl-hist-h">
      <div className="hl-wc tight">
        <div className="hl-phd">
          <h2 id="hl-hist-h">{t.hlHistory}</h2>
        </div>
        <HistControls mode={webHist} filter={filter} onMode={setWebHist} onFilter={setFilter} />
        {webHist === 'list' ? (
          <HistoryList now={now} filter={filter} web onOpen={openItem} />
        ) : (
          <HistoryTimeline now={now} filter={filter} web />
        )}
      </div>
    </section>
  );
  return (
    <div className="screen hl hl-web">
      <header className="hl-top">
        <BackButton label={t.backAction} onClick={props.onClose} />
        <h1 className="hl-pt">{t.startHealthTitle}</h1>
        <div className="tsub">{t.hlSub}</div>
        <span className="hl-val">{t.hlTodayIs(fd(today))}</span>
      </header>
      <div className="hl-wbody">
        {left}
        {right}
      </div>
      {overlays}
    </div>
  );
}

/** F10 — "I'm recovered" confirmation as a bottom sheet over Health. */
function RecoveredSheet(props: {
  period: RestPeriod;
  today: number;
  onConfirm: () => void;
  onStill: () => void;
}) {
  const { t, locale } = useT();
  const { period, today } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onStill();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);
  // Recovering ends the period yesterday (endRestPeriod): today is a normal day.
  const lastDay = today - 1;
  const n = lastDay - period.startDay + 1;
  return (
    <>
      <div className="hl-dim" onClick={props.onStill} aria-hidden="true" />
      <div className="hl-sheet" role="dialog" aria-modal="true" aria-labelledby="hl-sh-t">
        <div className="hl-grab" />
        <h2 className="hl-sh-t" id="hl-sh-t">
          {t.illnessRecoveredTitle}
        </h2>
        <p className="hl-sh-b">
          {n >= 1
            ? t.hlRecoveredBody(fmtRangeWd(period.startDay, lastDay, locale, today), n)
            : t.hlRecoveredBodyToday}
        </p>
        <GroupedList surface="raised">
          <ListRow icon={<Ic tone="neu" name="shield" />} label={t.hlStreak} value={t.hlKept} />
          <ListRow
            icon={<Ic tone="neu" name="pause" />}
            label={t.hlProgram}
            value={t.hlResumesToday}
          />
        </GroupedList>
        <div className="hl-stk">
          <Button variant="primary" fullWidth onClick={props.onConfirm}>
            {t.illnessRecoveredConfirm}
          </Button>
          <Button variant="secondary" fullWidth onClick={props.onStill}>
            {t.illnessStillUnwell}
          </Button>
        </div>
      </div>
    </>
  );
}
