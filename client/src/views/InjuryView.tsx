/**
 * InjuryView — the Injury & Rehab ("Comeback") flow, built to match the design
 * file "Spotter - Injury Rehab Full.dc.html" screen for screen. A guided,
 * feel-driven plan (not a passive countdown): Protect → Reintroduce → Rebuild →
 * Return, advanced by a green/amber/red check-in. An optional clinician no-load
 * window is a date-bound Stage 0 · Full rest (rest-blue) before it.
 */
import { BackButton } from '../components/ui/BackButton';
import { useState } from 'react';
import { Button, IconButton } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { NumberStepper } from '../components/ui/NumberStepper';
import { Segmented } from '../components/ui/Segmented';
import './InjuryView.css';
import {
  useStore,
  startInjury,
  logRehabCheckin,
  advanceInjury,
  dismissAdvance,
  healInjury,
  deleteInjury,
  dayKey,
} from '../store';
import {
  BODY_PARTS,
  bodyPart,
  feelToStage,
  GENERAL_REASONS,
  REHAB_STAGES,
  stageIndex,
  inFullRest,
  activeInjuries,
} from '../injury';
import type { Injury, RehabStageId, CheckinFeel, RehabReason, InjurySide } from '../types';
import type { MuscleGroup } from '../data/exercises';
import { useT } from '../i18n';
import { Icon, Sheet, ConfirmDialog, useIsDesktop } from '../ui';

const REASON_ICON: Record<RehabReason, string> = {
  injury: 'bandaids',
  surgery: 'first-aid-kit',
  illness: 'virus',
  break: 'hourglass-medium',
  cautious: 'shield-check',
};
const FEEL_ICON: Record<'cant' | 'sore' | 'almost', string> = {
  cant: 'hand-palm',
  sore: 'hand-tap',
  almost: 'thumbs-up',
};

export function InjuryView({
  injuryId,
  checkin,
  prefill,
  onClose,
}: {
  injuryId?: string;
  checkin?: boolean;
  /** Health › I got hurt → Still healing: body part, side and the day it
   *  happened are known — setup opens at "How does it feel today?". */
  prefill?: { bodyPart: string; side: InjurySide; startDay: number };
  onClose: () => void;
}) {
  const store = useStore();
  const active = activeInjuries(store.injuries);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const wanted = createdId ?? injuryId;
  const current = (wanted && active.find((i) => i.id === wanted)) || active[0] || null;
  const [mode, setMode] = useState<'plan' | 'setup'>(current && !prefill ? 'plan' : 'setup');

  if (mode === 'setup' || !current) {
    return (
      <InjurySetup
        prefill={createdId ? undefined : prefill}
        onClose={onClose}
        onDone={(id) => {
          setCreatedId(id);
          setMode('plan');
        }}
      />
    );
  }
  return (
    <InjuryPlan
      inj={current}
      startCheckin={!!checkin}
      onNew={() => setMode('setup')}
      onClose={onClose}
    />
  );
}

type Step = 'where' | 'general' | 'feel' | 'clinician';

function SetupStepper({ active }: { active: 1 | 2 | 3 }) {
  const { t } = useT();
  return (
    <div className="step">
      <span className={`s${active === 1 ? ' on' : active > 1 ? ' done' : ''}`}>
        <span className="n">{active > 1 ? <Icon name="check" weight="bold" /> : 1}</span>
        {t.injStepWhere}
      </span>
      <span className="line" />
      <span className={`s${active === 2 ? ' on' : active > 2 ? ' done' : ''}`}>
        <span className="n">{active > 2 ? <Icon name="check" weight="bold" /> : 2}</span>
        {t.injStepFeel}
      </span>
      <span className="line" />
      <span className={`s${active === 3 ? ' on' : ''}`}>
        <span className="n">3</span>
        {t.injStepPlan}
      </span>
    </div>
  );
}

function InjurySetup({
  onClose,
  onDone,
  prefill,
}: {
  onClose: () => void;
  onDone: (injuryId: string) => void;
  prefill?: { bodyPart: string; side: InjurySide; startDay: number };
}) {
  const { t } = useT();
  const [step, setStep] = useState<Step>(prefill ? 'feel' : 'where');
  const [part, setPart] = useState<string | null>(prefill?.bodyPart ?? null);
  const [side, setSide] = useState<InjurySide>(prefill?.side ?? 'left');
  const [reason, setReason] = useState<RehabReason>('injury');
  const [feel, setFeel] = useState<'cant' | 'sore' | 'almost'>('sore');
  const [hasTimeframe, setHasTimeframe] = useState(false);
  const [amount, setAmount] = useState(6);
  const [unit, setUnit] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [today] = useState(() => dayKey(Date.now()));

  const muscles: MuscleGroup[] = part ? (bodyPart(part)?.muscles ?? []) : [];

  const commit = () => {
    let fullRestUntil: number | null = null;
    if (hasTimeframe) {
      const mult = unit === 'days' ? 1 : unit === 'weeks' ? 7 : 30;
      fullRestUntil = today + amount * mult;
    }
    const isGeneral = reason !== 'injury';
    const inj = startInjury({
      reason,
      bodyPart: isGeneral ? '' : (part ?? 'knee'),
      side: isGeneral ? undefined : side,
      muscles: isGeneral ? [] : muscles,
      stage: hasTimeframe ? 'protect' : feelToStage(feel),
      fullRestUntil,
      startDay: prefill?.startDay,
    });
    onDone(inj.id);
  };

  const back = () => {
    if (step === 'where') onClose();
    else if (step === 'general') setStep('where');
    else if (step === 'feel') setStep('where');
    else setStep(reason === 'injury' ? 'feel' : 'general');
  };

  return (
    <div className="rx">
      <div className="topbar">
        <BackButton label={t.backAction} onClick={back} />
        <span className="tt">
          {step === 'general'
            ? t.injGeneralTitle
            : step === 'clinician'
              ? t.injClinicianTitle
              : t.injWhereTitle}
        </span>
      </div>

      {step === 'where' && (
        <>
          <SetupStepper active={1} />
          <div className="sub umt-18">{t.injWhereHint}</div>
          <div className="chips umt-14">
            {BODY_PARTS.map((b) => (
              <Chip
                key={b.id}
                selected={part === b.id}
                icon={part === b.id ? 'target' : undefined}
                onClick={() => setPart(b.id)}
              >
                {t.injBodyParts[b.id] ?? b.id}
              </Chip>
            ))}
          </div>
          {part && (
            <>
              <div className="umt-16">
                <Segmented
                  options={(['left', 'right', 'both'] as const).map((sd) => ({
                    value: sd,
                    label: t.injSide[sd],
                  }))}
                  value={side}
                  onChange={setSide}
                />
              </div>
              <div className="card r umt-16">
                <div className="ut-base ut-w7 ut-danger">{t.injGoodToKnow}</div>
                <div className="ut-sm ij-rose umt-6" style={{ lineHeight: 1.5 }}>
                  {t.injMuscleDeriveHint}
                </div>
                <div className="chips umt-12">
                  {muscles.map((m) => (
                    <span key={m} className="chip mus">
                      <Icon name="check" className="ij-dgr" />
                      {t.muscleGroups[m] ?? m}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
          <Button
            variant="ghost"
            fullWidth
            icon="dots-three-circle"
            className="umt-12"
            onClick={() => {
              setReason('surgery');
              setStep('general');
            }}
          >
            {t.injGeneralHatch}
          </Button>
          <div className="spacer" />
          <Button
            variant="ghost"
            className="p cta"
            disabled={!part}
            onClick={() => setStep('feel')}
          >
            {t.injNextFeel} <Icon name="arrow-right" weight="bold" />
          </Button>
        </>
      )}

      {step === 'general' && (
        <>
          <SetupStepper active={1} />
          <div className="sub umt-18">{t.injGeneralHint}</div>
          <div className="ul-flex ul-col ug-10 umt-16">
            {GENERAL_REASONS.map((r) => {
              const on = reason === r;
              return (
                <ListRow
                  key={r}
                  icon={<IconTile icon={REASON_ICON[r]} tone={on ? 'danger' : 'neutral'} />}
                  label={t.injReason[r]}
                  sub={t.injReasonDesc[r]}
                  selected={on}
                  check={on}
                  checkTone="danger"
                  onClick={() => setReason(r)}
                />
              );
            })}
          </div>
          <div className="spacer" />
          <Button variant="primary" className="cta" onClick={() => setStep('clinician')}>
            {t.injContinue} <Icon name="arrow-right" weight="bold" />
          </Button>
        </>
      )}

      {step === 'feel' && (
        <>
          <SetupStepper active={2} />
          <div className="pgt">{t.injFeelTitle}</div>
          <div className="sub">{t.injFeelHint}</div>
          <div className="ul-flex ul-col ug-12 umt-16">
            {(['cant', 'sore', 'almost'] as const).map((id) => {
              const on = feel === id;
              const stg = feelToStage(id);
              const okTone = id === 'almost';
              return (
                <ListRow
                  key={id}
                  icon={<IconTile icon={FEEL_ICON[id]} tone={okTone ? 'ok' : 'danger'} />}
                  label={t.injFeel[id]}
                  sub={t.injFeelSub[id]}
                  value={t.injStage[stg]}
                  valueTone={okTone ? 'ok' : 'danger'}
                  valueStrong
                  selected={on}
                  onClick={() => setFeel(id)}
                />
              );
            })}
          </div>
          <div className="spacer" />
          <Button variant="primary" className="hot cta" onClick={() => setStep('clinician')}>
            {t.injNext} <Icon name="arrow-right" weight="bold" />
          </Button>
        </>
      )}

      {step === 'clinician' && (
        <>
          <div className="sub umt-16">{t.injClinicianHint}</div>
          <div className="ul-flex ul-col ug-10 umt-16">
            <ListRow
              label={t.injTfNo}
              sub={t.injTfNoDesc}
              selected={!hasTimeframe}
              check={!hasTimeframe}
              checkTone="rest"
              onClick={() => setHasTimeframe(false)}
            />
            <ListRow
              label={t.injTfYes}
              sub={t.injTfYesDesc}
              selected={hasTimeframe}
              check={hasTimeframe}
              checkTone="rest"
              onClick={() => setHasTimeframe(true)}
            />
          </div>
          {hasTimeframe && (
            <>
              <div className="sec ij-rest3">{t.injTfHowLong}</div>
              <NumberStepper
                className="umt-10"
                label={t.injUnit[unit]}
                value={amount}
                min={1}
                onChange={setAmount}
                unit={t.injUnit[unit]}
              />
              <div className="umt-10">
                <Segmented
                  options={(['days', 'weeks', 'months'] as const).map((u) => ({
                    value: u,
                    label: t.injUnit[u],
                  }))}
                  value={unit}
                  onChange={setUnit}
                />
              </div>
              <div className="rulebox umt-12">
                <Icon name="warning" className="ij-amber uf-none" style={{ marginTop: 1 }} />
                <span>{t.injClinicianRule}</span>
              </div>
            </>
          )}
          <div className="spacer" />
          <Button
            variant={hasTimeframe ? 'rest' : 'primary'}
            className={hasTimeframe ? 'cta' : 'hot cta'}
            onClick={commit}
          >
            {t.injSeePlan} <Icon name="arrow-right" weight="bold" />
          </Button>
        </>
      )}
    </div>
  );
}

function InjuryPlan({
  inj,
  startCheckin,
  onNew,
  onClose,
}: {
  inj: Injury;
  startCheckin: boolean;
  onNew: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [ci, setCi] = useState(startCheckin);
  const [manage, setManage] = useState(false);
  const isDesktop = useIsDesktop();
  const [today] = useState(() => dayKey(Date.now()));
  const fullRest = inFullRest(inj, today);
  const partName =
    inj.reason === 'injury'
      ? (t.injBodyParts[inj.bodyPart] ?? inj.bodyPart)
      : t.injReason[inj.reason];
  const curIdx = stageIndex(inj.stage);
  void onNew;

  if (manage) return <InjuryManage inj={inj} onClose={() => setManage(false)} onExit={onClose} />;

  if (isDesktop && !fullRest) {
    const recent = [...inj.checkins].slice(-4).reverse();
    const feelColor = (f: string) =>
      f === 'fine' ? 'var(--ok)' : f === 'sore' ? 'var(--g500)' : 'var(--dgr)';
    return (
      <div className="rx hub">
        <div className="rx-top">
          <div className="rx-top-l">
            <span className="ij-hub-ico ur-md ut-2xl">
              <Icon name="bandaids" weight="bold" />
            </span>
            <div>
              <div className="h1">{t.injPlanTitle(partName)}</div>
              <div className="sub2">
                {t.injBannerStage(curIdx + 1, REHAB_STAGES.length, t.injStage[inj.stage])} ·{' '}
                {t.injHubByFeel}
              </div>
            </div>
          </div>
          <div className="ul-flex ug-10">
            <Button
              variant="secondary"
              size="sm"
              style={{ width: 'auto', padding: '0 14px' }}
              onClick={() => setManage(true)}
            >
              {t.injManage}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="ij-btn-ok"
              style={{ width: 'auto', padding: '0 14px' }}
              onClick={() => setManage(true)}
            >
              {t.injMarkHealed}
            </Button>
          </div>
        </div>
        <div className="rx-body2">
          <div className="rx-main2">
            <div className="rx-track">
              {REHAB_STAGES.map((sid, i) => {
                const state = i < curIdx ? 'done' : i === curIdx ? 'now' : 'next';
                return (
                  <div key={sid} style={{ display: 'contents' }}>
                    <div className={`node ${state}`}>
                      <span className="kn">
                        {state === 'done' ? <Icon name="check" weight="bold" /> : i + 1}
                      </span>
                      <span className="nm">{t.injStage[sid]}</span>
                      <span className="st">
                        {state === 'done' ? t.injCleared : state === 'now' ? t.injNow : t.injByFeel}
                      </span>
                    </div>
                    {i < REHAB_STAGES.length - 1 && (
                      <span className={`conn${i < curIdx ? ' done' : ''}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="card r">
              <div className="rk">
                {t.injRightNow} · {t.injStage[inj.stage]}
              </div>
              <div className="ut-lg ij-rose umt-10 ul-flex ug-10" style={{ lineHeight: 1.55 }}>
                <Icon name="shield-check" weight="fill" className="ij-dgr umt-2 uf-none" />
                <span>{t.injFeelDriven}</span>
              </div>
            </div>
            <div className="card">
              <div className="ul-flex ua-center uj-between">
                <div className="ut-base ut-w7">{t.injRebuildPreview}</div>
              </div>
              <div className="ul-flex ua-end ug-12 umt-14" style={{ height: 96 }}>
                {[60, 75, 90, 100].map((pct) => (
                  <div
                    key={pct}
                    className="uf-1 ul-flex ul-col ua-center ug-6 uj-end"
                    style={{ height: '100%' }}
                  >
                    <div className="ij-bar" style={{ width: '100%', height: `${pct}%` }} />
                    <div className="ut-xs ut-dim ut-w7">{pct}%</div>
                  </div>
                ))}
              </div>
              <div className="ut-sm ut-dim umt-12" style={{ lineHeight: 1.5 }}>
                {t.injRebuildPreviewNote}
              </div>
            </div>
            {inj.stage !== 'protect' && (
              <Button variant="primary" className="hot" onClick={() => setCi(true)}>
                <Icon name="heartbeat" weight="bold" /> {t.injLogCheckin}
              </Button>
            )}
          </div>
          <div className="rx-side2">
            <div className="card bl">
              <div className="ul-flex ua-center ug-10">
                <Icon name="calendar-check" weight="fill" className="ij-rest ut-lg" />
                <span className="ut-sm ut-w7 ij-rest2 uf-1">{t.injTimeframeNone}</span>
              </div>
              <div className="ut-sm ij-rest3 umt-10" style={{ lineHeight: 1.5 }}>
                {t.injTimeframeNoneHint}
              </div>
            </div>
            {recent.length > 0 && (
              <div className="listcard">
                <div className="h">{t.injRecentCheckins}</div>
                {recent.map((c) => (
                  <div className="li" key={c.id}>
                    <span className="ij-dot ur-round" style={{ background: feelColor(c.feel) }} />
                    <span className="uf-1">{new Date(c.at).toLocaleDateString()}</span>
                    <span className="ut-xs ut-w7" style={{ color: feelColor(c.feel) }}>
                      {t.injFeelWord[c.feel]}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {inj.muscles.length > 0 && (
              <div className="listcard">
                <div className="h">{t.injProtectedThisWeek}</div>
                {inj.muscles.map((m) => (
                  <div className="li" key={m}>
                    <Icon name="shield-check" className="ij-dgr ut-lg" />
                    <span className="ut-danger uf-1">{t.muscleGroups[m] ?? m}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {ci && <CheckinSheet inj={inj} onClose={() => setCi(false)} />}
      </div>
    );
  }

  return (
    <div className="rx">
      <div className="topbar">
        <BackButton label={t.backAction} onClick={onClose} />
        <span className="tt">{t.injPlanTitle(partName)}</span>
        <IconButton
          label={t.injManage}
          icon="dots-three-vertical"
          onClick={() => setManage(true)}
        />
      </div>

      <div className="rulebox umt-16">
        <Icon
          name={fullRest ? 'info' : 'shield-check'}
          className={fullRest ? 'ij-rest' : 'ij-dgr'}
          style={{ marginTop: 1, flex: 'none' }}
        />
        <span>{fullRest ? t.injStage0Note : t.injFeelDriven}</span>
      </div>

      <div className="sec">{t.injYourStages}</div>
      <div className="slist umt-8">
        {fullRest && inj.fullRestUntil != null && (
          <div className="r rest ua-start">
            <span className="kn">
              <Icon name="moon" weight="bold" />
            </span>
            <div className="uf-1">
              <div className="ut-md ut-w8 ij-rest2 ul-flex ua-center ug-8">
                {t.injStage0}
                <span className="ij-badge ut-2xs ut-w8 ur-sm">{t.injNow}</span>
              </div>
              <div className="ut-xs ij-rest3 umt-4">
                {t.injStage0Left(inj.fullRestUntil - today)}
              </div>
            </div>
          </div>
        )}
        {REHAB_STAGES.map((sid, i) => {
          const state = fullRest ? '' : i < curIdx ? 'done' : i === curIdx ? 'now' : '';
          return (
            <div key={sid} className={`r ${state}`}>
              <span className="kn">
                {state === 'done' ? <Icon name="check" weight="bold" /> : i + 1}
              </span>
              <span
                className={`ut-base ut-w7 ${
                  state === 'now' ? 'ut-danger' : state === 'done' ? 'ut-text' : 'ij-n400'
                }`}
                style={{ flex: 1 }}
              >
                {t.injStage[sid]}
              </span>
              <span className="ut-xs ij-n600">
                {state === 'now' ? t.injNow : state === 'done' ? t.injCleared : t.injByFeel}
              </span>
            </div>
          );
        })}
      </div>

      {inj.stage === 'rebuild' && !fullRest && <RebuildRamp />}

      <div className="spacer" />
      {!fullRest && inj.stage !== 'protect' && (
        <Button variant="primary" className="hot cta" onClick={() => setCi(true)}>
          <Icon name="heartbeat" weight="bold" /> {t.injLogCheckin}
        </Button>
      )}
      <Button variant="secondary" className="umt-10" onClick={() => setManage(true)}>
        <Icon name="dots-three-vertical" /> {t.injManage}
      </Button>

      {ci && <CheckinSheet inj={inj} onClose={() => setCi(false)} />}
    </div>
  );
}

function RebuildRamp() {
  const { t } = useT();
  const steps = [
    { pct: 60, state: 'done' },
    { pct: 75, state: 'now' },
    { pct: 90, state: 'lock' },
    { pct: 100, state: 'lock' },
  ] as const;
  return (
    <>
      <div className="sec">{t.injRebuildRampLabel}</div>
      <div className="ul-flex ua-end ug-10 umt-12" style={{ height: 130 }}>
        {steps.map((s) => (
          <div
            key={s.pct}
            className="uf-1 ul-flex ul-col ua-center ug-6 uj-end"
            style={{ height: '100%' }}
          >
            <div
              className={`ut-xs ut-w7 ${
                s.state === 'done' ? 'ut-ok' : s.state === 'now' ? 'ij-dgr' : 'ij-n600'
              }`}
            >
              {s.state === 'done' ? (
                <Icon name="check" weight="bold" />
              ) : s.state === 'now' ? (
                t.injNow
              ) : (
                <Icon name="lock-simple" />
              )}
            </div>
            <div
              className={`ij-ramp ij-ramp--${s.state}`}
              style={{ width: '100%', height: `${s.pct}%` }}
            />
            <div
              className={`ut-xs ut-w7 ${
                s.state === 'lock' ? 'ut-dim' : s.state === 'now' ? 'ut-danger' : 'ij-n400'
              }`}
            >
              {s.pct}%
            </div>
          </div>
        ))}
      </div>
      <div className="card umt-16 ul-flex ug-12 ua-start">
        <Icon name="arrow-fat-up" weight="fill" className="ij-dgr ut-lg" style={{ marginTop: 1 }} />
        <div className="ut-sm ij-n300" style={{ lineHeight: 1.45 }}>
          {t.injRebuildRampNote}
        </div>
      </div>
    </>
  );
}

function InjuryManage({
  inj,
  onClose,
  onExit,
}: {
  inj: Injury;
  onClose: () => void;
  onExit: () => void;
}) {
  const { t } = useT();
  const [confirmHeal, setConfirmHeal] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const partName =
    inj.reason === 'injury'
      ? (t.injBodyParts[inj.bodyPart] ?? inj.bodyPart)
      : t.injReason[inj.reason];
  const sideLabel = inj.side ? t.injSide[inj.side] : '';

  return (
    <div className="rx">
      <div className="topbar">
        <BackButton label={t.backAction} onClick={onClose} />
        <span className="tt">{t.injManageTitle}</span>
      </div>

      <div className="sec">{t.injInjury}</div>
      <div className="slist umt-8">
        <div className="r">
          <Icon name="target" className="ij-dgr ut-xl" />
          <span className="ut-base ut-w6 uf-1">{t.injArea}</span>
          <span className="ut-base ij-n400">
            {sideLabel ? `${sideLabel} ${partName}` : partName}
          </span>
        </div>
        <div className="r">
          <Icon name="arrows-down-up" className="ij-n400 ut-xl" />
          <span className="ut-base ut-w6 uf-1">{t.injCurrentStage}</span>
          <span className="ut-base ij-n400">{t.injStage[inj.stage]}</span>
        </div>
      </div>

      <div className="spacer" />
      <Button variant="secondary" className="ij-btn-ok" onClick={() => setConfirmHeal(true)}>
        <Icon name="check-circle" weight="bold" /> {t.injMarkHealed}
      </Button>
      <Button
        variant="secondary"
        className="ij-btn-dgr umt-10"

        onClick={() => setConfirmCancel(true)}
      >
        <Icon name="x-circle" /> {t.injCancelPlan}
      </Button>

      {confirmHeal && (
        <ConfirmDialog
          tone="ok"
          icon="check-circle"
          title={t.injHealedTitle(partName)}
          body={t.injHealedBody}
          confirmLabel={t.injHealedConfirm}
          cancelLabel={t.injHealedNotYet}
          onConfirm={() => {
            healInjury(inj.id);
            setConfirmHeal(false);
            onExit();
          }}
          onCancel={() => setConfirmHeal(false)}
        />
      )}
      {confirmCancel && (
        <ConfirmDialog
          title={t.injCancelTitle}
          body={t.injCancelBody}
          confirmLabel={t.injCancelConfirm}
          cancelLabel={t.injHealedNotYet}
          danger
          onConfirm={() => {
            deleteInjury(inj.id);
            setConfirmCancel(false);
            onExit();
          }}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </div>
  );
}

function CheckinSheet({ inj, onClose }: { inj: Injury; onClose: () => void }) {
  const { t } = useT();
  const [done, setDone] = useState<{
    outcome: 'ready' | 'hold' | 'regress';
    stage: RehabStageId;
    from: RehabStageId;
  } | null>(null);

  const pick = (feel: CheckinFeel) => {
    const from = inj.stage;
    const res = logRehabCheckin(inj.id, feel);
    if (res) setDone({ ...res, from });
    else onClose();
  };

  if (done) return <CheckinResult injId={inj.id} res={done} onClose={onClose} />;

  return (
    <Sheet onClose={onClose} className="rehab-ci-sheet">
      <div className="rx ij-sheet-rx">
        <div className="rk">
          <Icon name="heartbeat" weight="fill" /> {t.injCheckinKicker}
        </div>
        <div className="ut-2xl ut-w7 ut-tight umt-8">{t.injCheckinTitle}</div>
        <div className="sub umt-4">{t.injCheckinHint}</div>
        <div className="tl umt-14">
          <ListRow
            icon={<IconTile icon="check-circle" tone="ok" />}
            label={t.injCiFine}
            sub={t.injCiFineSub}
            value={<>↑ {t.injConsProgress}</>}
            valueTone="ok"
            valueStrong
            onClick={() => pick('fine')}
          />
          <ListRow
            icon={<IconTile icon="minus-circle" tone="illness" />}
            label={t.injCiSore}
            sub={t.injCiSoreSub}
            value={<>→ {t.injConsHold}</>}
            valueTone="illness"
            valueStrong
            onClick={() => pick('sore')}
          />
          <ListRow
            icon={<IconTile icon="warning-circle" tone="danger" />}
            label={t.injCiPain}
            sub={t.injCiPainSub}
            value={<>↓ {t.injConsBack}</>}
            valueTone="danger"
            valueStrong
            onClick={() => pick('pain')}
          />
        </div>
        <div className="rulebox umt-14">
          <Icon name="info" className="uf-none" style={{ marginTop: 1 }} />
          <span>{t.injCheckinRule}</span>
        </div>
      </div>
    </Sheet>
  );
}

function CheckinResult({
  injId,
  res,
  onClose,
}: {
  injId: string;
  res: { outcome: 'ready' | 'hold' | 'regress'; stage: RehabStageId; from: RehabStageId };
  onClose: () => void;
}) {
  const { t } = useT();
  const tone = res.outcome === 'ready' ? 'ok' : res.outcome === 'hold' ? 'g' : 'dgr';
  const icon =
    res.outcome === 'ready'
      ? 'arrow-fat-up'
      : res.outcome === 'hold'
        ? 'hand-palm'
        : 'arrow-fat-down';
  const title =
    res.outcome === 'ready'
      ? t.injResAdvTitle
      : res.outcome === 'hold'
        ? t.injResHoldTitle
        : t.injResBackTitle;
  const body =
    res.outcome === 'ready'
      ? t.injResAdvBody
      : res.outcome === 'hold'
        ? t.injResHoldBody
        : t.injResBackBody;
  // On 'ready' the dots preview the OFFERED stage; on regress they show the new (lower) one.
  const dotIdx = res.outcome === 'ready' ? stageIndex(res.stage) : stageIndex(res.stage);

  return (
    <Sheet onClose={onClose} className="rehab-ci-sheet">
      <div className="rx ij-sheet-rx ua-center utx-center">
        <div className={`ij-result-ico ij-tone--${tone} ur-round ut-hero umt-8`}>
          <Icon name={icon} weight="fill" />
        </div>
        <div className="ut-2xl ut-w7 umt-16">{title}</div>
        <div className="sub umt-8" style={{ maxWidth: 290 }}>
          {body}
        </div>
        {res.outcome !== 'hold' ? (
          <div className={`ij-result-row ij-result-row--${res.outcome} ur-lg umt-20`}>
            <span className={`ut-base ut-w7 ${res.outcome === 'ready' ? 'ut-dim' : 'ij-rose'}`}>
              {t.injStage[res.from]}
            </span>
            <Icon
              name={res.outcome === 'ready' ? 'arrow-right' : 'arrow-left'}
              weight="bold"
              className={res.outcome === 'ready' ? 'ut-ok' : 'ij-dgr'}
            />
            <span className={`ut-md ut-w8 ${res.outcome === 'ready' ? 'ij-oktext' : 'ut-danger'}`}>
              {t.injStage[res.stage]}
            </span>
          </div>
        ) : (
          <div className="ij-result-hold ut-base ut-w7 ur-lg umt-20">
            {t.injResStaying(t.injStage[res.stage])}
          </div>
        )}
        <div className="dots umt-16 uj-center">
          {REHAB_STAGES.map((sid, i) => (
            <span key={sid} className={`dot${i < dotIdx ? ' done' : i === dotIdx ? ' on' : ''}`} />
          ))}
        </div>
        {res.outcome === 'ready' ? (
          <>
            <Button
              variant="ghost"
              className="p hot umt-24"

              onClick={() => {
                advanceInjury(injId);
                onClose();
              }}
            >
              {t.injMoveUp(t.injStage[res.stage])} <Icon name="arrow-right" weight="bold" />
            </Button>
            <Button
              variant="secondary"
              className="umt-10"
              onClick={() => {
                dismissAdvance(injId);
                onClose();
              }}
            >
              {t.injStayLonger}
            </Button>
          </>
        ) : (
          <Button variant="primary" className="hot umt-24" onClick={onClose}>
            {t.done}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
