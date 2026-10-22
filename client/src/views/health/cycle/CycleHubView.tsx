/** The Cycle hub (docs mockups): today card, calendar tinted by phase, actions, states. */
import { useState } from 'react';
import { PageHead } from '../../../components/ui/PageHead';
import { HealthDisclaimer } from '../../../legal/HealthDisclaimer';
import { Button } from '../../../components/ui/Button';
import { Calendar } from '../../../components/ui/Calendar';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { MonthGrid } from '../../../components/ui/MonthGrid';
import { Notice } from '../../../components/ui/Notice';
import { ConfirmDialog, Sheet } from '../../../components/ui/Overlays';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Tag } from '../../../components/ui/Tag';
import {
  calendarPhase,
  estimate,
  isStale,
  type CyclePhase,
  type CycleSettings,
} from '../../../cycle/cycleCore';
import { cyclePause, type CyclePause } from '../../../cycle/cycleView';
import { askForDeniedWrite, isHealthOn, openHealthPrompt } from '../../../data/healthConsentGate';
import {
  markMenopauseFromCycle,
  markPregnancyFromCycle,
  updateCycleAnchor,
  useCycle,
  useStoredLimits,
  useStore,
} from '../../../store';
import { timestampOfDay } from '../../../components/ui/calendarDays';
import { CYCLE_TONE, PHASE_TONE, dayText, todayKey, useCycleText } from './text';

const WEEK_MS = 7 * 86_400_000;

export function CycleHubView({
  onBack,
  onSettings,
  onPatterns,
  onOpenStates,
}: {
  onBack: () => void;
  onSettings: () => void;
  onPatterns: () => void;
  onOpenStates: () => void;
}) {
  const { t, phaseName, phaseHint } = useCycleText();
  const cycle = useCycle();
  const { conditions } = useStore();
  const [now] = useState(() => Date.now());
  const limits = useStoredLimits();
  // RESTRICTION: a stored pregnancy / menopause pauses the Cycle even with Chronic conditions off; it is only named when
  // the conditions are displayable (SPO-290 owner decision).
  const suppressed = cyclePause(conditions, limits.conditions, now);
  const s = cycle.settings as CycleSettings;
  /**
   * Pregnancy / menopause are chronic conditions: without that consent the button asks for it (the chronic prompt)
   * and nothing is saved or claimed.
   */
  const openState = (which: 'preg' | 'meno') => {
    if (!isHealthOn('chronic')) return openHealthPrompt('chronic');
    setSheet(which);
  };
  const today = todayKey();
  const stale = cycle.pendingDate || isStale(s, today);
  const [sheet, setSheet] = useState<null | 'preg' | 'meno' | 'date'>(null);
  const [pregStart, setPregStart] = useState(today - 28);
  const [newAnchor, setNewAnchor] = useState(today);

  if (suppressed)
    return <Suppressed kind={suppressed} onBack={onBack} onOpenStates={onOpenStates} />;

  const est = estimate(s, today);
  const logOnly = s.mode === 'log';
  const legend: CyclePhase[] = logOnly ? ['menses'] : ['menses', 'early', 'mid', 'late'];
  return (
    <div className="screen hl">
      <PageHead
        className="hl-pbar"
        back={{ label: t.backAction, onClick: onBack }}
        title={t.cycTitle}
      />
      <div className="hl-scroll">
        <div className="hl-cnt">
          <HealthDisclaimer />
          {stale ? (
            <Notice
              tone="illness"
              icon="calendar-blank"
              trail={
                <Button size="sm" variant="secondary" onClick={() => setSheet('date')}>
                  {t.cycStaleBtn}
                </Button>
              }
            >
              {cycle.pendingDate ? t.cycAfterPause : t.cycStale}
            </Notice>
          ) : logOnly ? (
            <Card pad="md" emphasis="hero">
              <div className="ul-flex ul-col ug-8">
                <span className="ut-sm ut-muted">{t.cycLogHead}</span>
                <span className="ut-lg">{t.cycLogLast(dayText(s.anchor))}</span>
                <span className="ut-sm ut-muted">{t.cycLogNote}</span>
              </div>
            </Card>
          ) : est ? (
            <Card pad="md" emphasis="hero">
              <div className="ul-flex ul-col ug-8">
                <div className="ul-flex ua-center ug-8">
                  <Tag tone={PHASE_TONE[est.phase]}>
                    {est.approximate ? t.cycLikely : t.cycApprox}
                  </Tag>
                  <span className="ut-sm ut-muted">{t.cycDayOf(est.dayOfCycle, s.length)}</span>
                </div>
                <span className="ut-lg">{phaseName[est.phase]}</span>
                <span className="ut-sm ut-muted">{phaseHint[est.phase]}</span>
                <ProgressBar
                  value={(est.dayOfCycle / s.length) * 100}
                  tone={PHASE_TONE[est.phase]}
                />
                <span className="ut-sm ut-muted">
                  {t.cycNextStart(
                    dayText(est.next.day - est.next.half),
                    dayText(est.next.day + est.next.half),
                  )}
                </span>
              </div>
            </Card>
          ) : null}
          {!stale && (
            <div className="ul-flex ul-col ug-8">
              <SectionLabel>{t.cycCalendar}</SectionLabel>
              <Card pad="sm" emphasis="card">
                <MonthGrid
                  month={today}
                  today={today}
                  label={t.cycCalendar}
                  day={(d) => {
                    const ph = calendarPhase(s, d, today);
                    return ph ? { tint: PHASE_TONE[ph] } : undefined;
                  }}
                />
              </Card>
              <div className="ul-flex ul-wrap ug-8">
                {legend.map((p) => (
                  <Tag key={p} tone={PHASE_TONE[p]}>
                    {logOnly ? t.cycLegendLogged : phaseName[p]}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          <GroupedList>
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="calendar-plus" />}
              label={t.cycUpdateDate}
              chevron
              onClick={() => setSheet('date')}
            />
            {!logOnly && (
              <ListRow
                icon={<IconTile tone="neutral" size={30} icon="chart-line" />}
                label={t.cycPatterns}
                sub={t.cycPatternsSub}
                chevron
                onClick={onPatterns}
              />
            )}
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="sliders-horizontal" />}
              label={t.cycSettings}
              value={
                { regular: t.cycModeRegular, irregular: t.cycModeIrregular, log: t.cycModeLog }[
                  s.mode
                ]
              }
              chevron
              onClick={onSettings}
            />
          </GroupedList>
          <GroupedList header={t.cycStates} footer={t.cycStatesFoot}>
            <ListRow
              icon={<IconTile tone="chronic" size={30} icon="heartbeat" />}
              label={t.cycMarkPreg}
              chevron
              onClick={() => openState('preg')}
            />
            <ListRow
              icon={<IconTile tone="chronic" size={30} icon="sun-horizon" />}
              label={t.cycMarkMeno}
              chevron
              onClick={() => openState('meno')}
            />
          </GroupedList>
        </div>
      </div>
      {sheet === 'date' && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="ul-flex ul-col ug-12">
            <span className="ut-lg ut-w7">{t.cycUpdateTitle}</span>
            <Calendar
              value={newAnchor}
              today={today}
              max={today}
              tone={CYCLE_TONE}
              onSelect={setNewAnchor}
            />
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                updateCycleAnchor(newAnchor);
                setSheet(null);
              }}
            >
              {t.cycUpdateSave}
            </Button>
          </div>
        </Sheet>
      )}
      {sheet === 'preg' && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="ul-flex ul-col ug-12">
            <span className="ut-lg ut-w7">{t.cycPregTitle}</span>
            <span className="ut-sm ut-muted">{t.cycPregBody}</span>
            <Calendar
              value={pregStart}
              today={today}
              max={today}
              tone="chronic"
              onSelect={setPregStart}
            />
            <Notice tone="chronic" icon="info">
              {t.cycPregInfo(
                Math.max(1, Math.floor((now - timestampOfDay(pregStart)) / WEEK_MS) + 1),
              )}
            </Notice>
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                // Refused (consent withdrawn meanwhile): the chronic prompt opens, the sheet stays.
                if (askForDeniedWrite(markPregnancyFromCycle(timestampOfDay(pregStart)))) return;
                setSheet(null);
              }}
            >
              {t.cycPregAdd}
            </Button>
          </div>
        </Sheet>
      )}
      {sheet === 'meno' && (
        <ConfirmDialog
          icon="sun-horizon"
          tone="chronic"
          title={t.cycMenoTitle}
          body={t.cycMenoBody}
          confirmLabel={t.cycMenoConfirm}
          cancelLabel={t.cycCancel}
          onCancel={() => setSheet(null)}
          onConfirm={() => {
            if (askForDeniedWrite(markMenopauseFromCycle())) return;
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}

function Suppressed({
  kind,
  onBack,
  onOpenStates,
}: {
  kind: CyclePause;
  onBack: () => void;
  onOpenStates: () => void;
}) {
  const { t } = useCycleText();
  return (
    <div className="screen hl">
      <PageHead
        className="hl-pbar"
        back={{ label: t.backAction, onClick: onBack }}
        title={t.cycTitle}
      />
      <div className="hl-scroll">
        <div className="hl-cnt">
          <HealthDisclaimer />
          <EmptyState
            icon={kind === 'menopause' ? 'sun-horizon' : 'heartbeat'}
            title={t.cycOffTitle}
            body={
              kind === 'hidden'
                ? t.cycOffNeutral
                : kind === 'pregnancy'
                  ? t.cycOffPregnancy
                  : t.cycOffMenopause
            }
            centered
          >
            {kind !== 'hidden' && (
              <Button variant="secondary" icon="arrow-right" onClick={onOpenStates}>
                {t.cycOpenStates}
              </Button>
            )}
          </EmptyState>
        </div>
      </div>
    </div>
  );
}
