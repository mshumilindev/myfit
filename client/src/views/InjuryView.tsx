/**
 * InjuryView — the Injury & Rehab ("Comeback") flow, built to match the design
 * file "Spotter - Injury Rehab Full.dc.html" screen for screen. A guided,
 * feel-driven plan (not a passive countdown): Protect → Reintroduce → Rebuild →
 * Return, advanced by a green/amber/red check-in. An optional clinician no-load
 * window is a date-bound Stage 0 · Full rest (rest-blue) before it.
 */
import { useState } from 'react';
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
  onClose,
}: {
  injuryId?: string;
  checkin?: boolean;
  onClose: () => void;
}) {
  const store = useStore();
  const active = activeInjuries(store.injuries);
  const current = (injuryId && active.find((i) => i.id === injuryId)) || active[0] || null;
  const [mode, setMode] = useState<'plan' | 'setup'>(current ? 'plan' : 'setup');

  if (mode === 'setup' || !current) {
    return <InjurySetup onClose={onClose} onDone={() => setMode('plan')} />;
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

function InjurySetup({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const [step, setStep] = useState<Step>('where');
  const [part, setPart] = useState<string | null>(null);
  const [side, setSide] = useState<InjurySide>('left');
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
    startInjury({
      reason,
      bodyPart: isGeneral ? '' : (part ?? 'knee'),
      side: isGeneral ? undefined : side,
      muscles: isGeneral ? [] : muscles,
      stage: hasTimeframe ? 'protect' : feelToStage(feel),
      fullRestUntil,
    });
    onDone();
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
        <button className="bk" aria-label={t.backAction} onClick={back}>
          <Icon name={step === 'where' ? 'x' : 'arrow-left'} />
        </button>
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
          <div className="sub" style={{ marginTop: 18 }}>
            {t.injWhereHint}
          </div>
          <div className="chips" style={{ marginTop: 14 }}>
            {BODY_PARTS.map((b) => (
              <button
                key={b.id}
                className={`chip${part === b.id ? ' on' : ''}`}
                onClick={() => setPart(b.id)}
              >
                {part === b.id && <Icon name="target" weight="fill" />}
                {t.injBodyParts[b.id] ?? b.id}
              </button>
            ))}
          </div>
          {part && (
            <>
              <div className="seg" style={{ marginTop: 16 }}>
                {(['left', 'right', 'both'] as const).map((sd) => (
                  <button
                    key={sd}
                    className={`chip${side === sd ? ' on' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setSide(sd)}
                  >
                    {t.injSide[sd]}
                  </button>
                ))}
              </div>
              <div className="card r" style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dgrtext)' }}>
                  {t.injGoodToKnow}
                </div>
                <div
                  style={{ fontSize: 12.5, color: 'var(--dgrrose)', marginTop: 6, lineHeight: 1.5 }}
                >
                  {t.injMuscleDeriveHint}
                </div>
                <div className="chips" style={{ marginTop: 11 }}>
                  {muscles.map((m) => (
                    <span key={m} className="chip mus">
                      <Icon name="check" style={{ color: 'var(--dgr)' }} />
                      {t.muscleGroups[m] ?? m}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
          <button
            className="hatch"
            style={{ marginTop: 12 }}
            onClick={() => {
              setReason('surgery');
              setStep('general');
            }}
          >
            <Icon name="dots-three-circle" />
            {t.injGeneralHatch}
          </button>
          <div className="spacer" />
          <button className="btn p cta" disabled={!part} onClick={() => setStep('feel')}>
            {t.injNextFeel} <Icon name="arrow-right" weight="bold" />
          </button>
        </>
      )}

      {step === 'general' && (
        <>
          <SetupStepper active={1} />
          <div className="sub" style={{ marginTop: 18 }}>
            {t.injGeneralHint}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
            {GENERAL_REASONS.map((r) => {
              const on = reason === r;
              return (
                <button
                  key={r}
                  className="rest-mode"
                  style={
                    on
                      ? {
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          background: 'var(--color-danger-tint)',
                          borderColor: 'var(--color-danger)',
                          boxShadow: 'inset 0 0 0 1px var(--color-danger)',
                        }
                      : { flexDirection: 'row', alignItems: 'center', gap: 12 }
                  }
                  onClick={() => setReason(r)}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                      fontSize: 17,
                      background: on ? 'rgba(226,86,79,.16)' : 'var(--color-neutral-900)',
                      color: on ? 'var(--color-danger)' : 'var(--color-neutral-400)',
                    }}
                  >
                    <Icon name={REASON_ICON[r]} weight="bold" />
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <span
                      className="rm-name"
                      style={on ? { color: 'var(--color-danger-text)' } : undefined}
                    >
                      {t.injReason[r]}
                    </span>
                    <span className="rm-desc" style={{ display: 'block' }}>
                      {t.injReasonDesc[r]}
                    </span>
                  </span>
                  {on && (
                    <Icon
                      name="check-circle"
                      weight="bold"
                      style={{ color: 'var(--color-danger)', fontSize: 18 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="spacer" />
          <button className="btn p cta" onClick={() => setStep('clinician')}>
            {t.injContinue} <Icon name="arrow-right" weight="bold" />
          </button>
        </>
      )}

      {step === 'feel' && (
        <>
          <SetupStepper active={2} />
          <div className="pgt">{t.injFeelTitle}</div>
          <div className="sub">{t.injFeelHint}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 16 }}>
            {(['cant', 'sore', 'almost'] as const).map((id) => {
              const on = feel === id;
              const stg = feelToStage(id);
              const okTone = id === 'almost';
              return (
                <button
                  key={id}
                  onClick={() => setFeel(id)}
                  style={{
                    textAlign: 'left',
                    padding: 14,
                    borderRadius: 14,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 13,
                    alignItems: 'center',
                    color: 'var(--color-text)',
                    background: on ? 'var(--dgrt)' : 'var(--color-surface)',
                    border: `1px solid ${on ? 'var(--dgr)' : 'var(--color-divider)'}`,
                    boxShadow: on ? 'inset 0 0 0 1px var(--dgr)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                      fontSize: 19,
                      background: okTone
                        ? 'var(--okt)'
                        : on
                          ? 'rgba(226,86,79,.16)'
                          : 'var(--dgrt)',
                      border: `1px solid ${okTone ? 'var(--okline)' : 'var(--dgrline)'}`,
                      color: okTone ? 'var(--ok)' : 'var(--dgr)',
                    }}
                  >
                    <Icon name={FEEL_ICON[id]} weight="bold" />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: on ? 'var(--dgrtext)' : 'var(--color-text)',
                      }}
                    >
                      {t.injFeel[id]}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: on ? 'var(--dgrrose)' : 'var(--color-neutral-500)',
                        marginTop: 2,
                      }}
                    >
                      {t.injFeelSub[id]}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      borderRadius: 6,
                      padding: '4px 7px',
                      color: on ? '#fff' : okTone ? 'var(--ok)' : 'var(--dgr)',
                      background: on ? 'var(--dgr)' : 'transparent',
                      border: on
                        ? 'none'
                        : `1px solid ${okTone ? 'var(--okline)' : 'var(--dgrline)'}`,
                    }}
                  >
                    {t.injStage[stg]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="spacer" />
          <button className="btn p hot cta" onClick={() => setStep('clinician')}>
            {t.injNext} <Icon name="arrow-right" weight="bold" />
          </button>
        </>
      )}

      {step === 'clinician' && (
        <>
          <div className="sub" style={{ marginTop: 16 }}>
            {t.injClinicianHint}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
            <button
              className="rest-mode"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}
              onClick={() => setHasTimeframe(false)}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: `2px solid ${hasTimeframe ? 'var(--color-neutral-600)' : 'var(--rest)'}`,
                  flex: 'none',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {!hasTimeframe && (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--rest)',
                    }}
                  />
                )}
              </span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="rm-name">{t.injTfNo}</span>
                <span className="rm-desc" style={{ display: 'block' }}>
                  {t.injTfNoDesc}
                </span>
              </span>
            </button>
            <button
              className="rest-mode"
              style={
                hasTimeframe
                  ? {
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 11,
                      background: 'var(--restt)',
                      borderColor: 'var(--rest)',
                      boxShadow: 'inset 0 0 0 1px var(--rest)',
                    }
                  : { flexDirection: 'row', alignItems: 'flex-start', gap: 11 }
              }
              onClick={() => setHasTimeframe(true)}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: '2px solid var(--rest)',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                  marginTop: 1,
                }}
              >
                {hasTimeframe && (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--rest)',
                    }}
                  />
                )}
              </span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span
                  className="rm-name"
                  style={hasTimeframe ? { color: 'var(--rest200)' } : undefined}
                >
                  {t.injTfYes}
                </span>
                <span
                  className="rm-desc"
                  style={{ display: 'block', color: hasTimeframe ? 'var(--rest300)' : undefined }}
                >
                  {t.injTfYesDesc}
                </span>
              </span>
            </button>
          </div>
          {hasTimeframe && (
            <>
              <div className="sec" style={{ color: 'var(--rest300)' }}>
                {t.injTfHowLong}
              </div>
              <div className="stepper" style={{ marginTop: 10 }}>
                <button className="pm" onClick={() => setAmount((a) => Math.max(1, a - 1))}>
                  <Icon name="minus" weight="bold" />
                </button>
                <div className="val">
                  <div className="num" style={{ color: 'var(--rest200)' }}>
                    {amount}
                  </div>
                  <div className="u">{t.injUnit[unit]}</div>
                </div>
                <button className="pm" onClick={() => setAmount((a) => a + 1)}>
                  <Icon name="plus" weight="bold" />
                </button>
              </div>
              <div className="seg" style={{ marginTop: 10 }}>
                {(['days', 'weeks', 'months'] as const).map((u) => (
                  <button
                    key={u}
                    className={`chip${unit === u ? ' onb' : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setUnit(u)}
                  >
                    {t.injUnit[u]}
                  </button>
                ))}
              </div>
              <div className="rulebox" style={{ marginTop: 12 }}>
                <Icon name="warning" style={{ marginTop: 1, flex: 'none', color: 'var(--g500)' }} />
                <span>{t.injClinicianRule}</span>
              </div>
            </>
          )}
          <div className="spacer" />
          <button className={`btn ${hasTimeframe ? 'b' : 'p hot'} cta`} onClick={commit}>
            {t.injSeePlan} <Icon name="arrow-right" weight="bold" />
          </button>
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
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(226,86,79,.16)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--dgr)',
                fontSize: 19,
              }}
            >
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
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn s sm"
              style={{ width: 'auto', padding: '0 14px' }}
              onClick={() => setManage(true)}
            >
              {t.injManage}
            </button>
            <button
              className="btn s sm"
              style={{
                width: 'auto',
                padding: '0 14px',
                color: 'var(--ok)',
                borderColor: 'var(--okline)',
              }}
              onClick={() => setManage(true)}
            >
              {t.injMarkHealed}
            </button>
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
              <div
                style={{
                  fontSize: 15,
                  color: 'var(--dgrrose)',
                  marginTop: 9,
                  lineHeight: 1.55,
                  display: 'flex',
                  gap: 9,
                }}
              >
                <Icon
                  name="shield-check"
                  weight="fill"
                  style={{ marginTop: 2, flex: 'none', color: 'var(--dgr)' }}
                />
                <span>{t.injFeelDriven}</span>
              </div>
            </div>
            <div className="card">
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t.injRebuildPreview}</div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 12,
                  height: 96,
                  marginTop: 14,
                }}
              >
                {[60, 75, 90, 100].map((pct) => (
                  <div
                    key={pct}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${pct}%`,
                        borderRadius: '6px 6px 2px 2px',
                        background: 'var(--n800)',
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--n500)', fontWeight: 700 }}>
                      {pct}%
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--n500)', marginTop: 12, lineHeight: 1.5 }}>
                {t.injRebuildPreviewNote}
              </div>
            </div>
            {inj.stage !== 'protect' && (
              <button className="btn p hot" onClick={() => setCi(true)}>
                <Icon name="heartbeat" weight="bold" /> {t.injLogCheckin}
              </button>
            )}
          </div>
          <div className="rx-side2">
            <div className="card bl">
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon
                  name="calendar-check"
                  weight="fill"
                  style={{ color: 'var(--rest)', fontSize: 16 }}
                />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--rest200)', flex: 1 }}>
                  {t.injTimeframeNone}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--rest300)', marginTop: 9, lineHeight: 1.5 }}>
                {t.injTimeframeNoneHint}
              </div>
            </div>
            {recent.length > 0 && (
              <div className="listcard">
                <div className="h">{t.injRecentCheckins}</div>
                {recent.map((c) => (
                  <div className="li" key={c.id}>
                    <span
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: feelColor(c.feel),
                      }}
                    />
                    <span style={{ flex: 1 }}>{new Date(c.at).toLocaleDateString()}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: feelColor(c.feel) }}>
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
                    <Icon name="shield-check" style={{ color: 'var(--dgr)', fontSize: 15 }} />
                    <span style={{ flex: 1, color: 'var(--dgrtext)' }}>
                      {t.muscleGroups[m] ?? m}
                    </span>
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
        <button className="bk" aria-label={t.backAction} onClick={onClose}>
          <Icon name="arrow-left" />
        </button>
        <span className="tt">{t.injPlanTitle(partName)}</span>
        <button className="edit" aria-label={t.injManage} onClick={() => setManage(true)}>
          <Icon name="dots-three-vertical" />
        </button>
      </div>

      <div className="rulebox" style={{ marginTop: 16 }}>
        <Icon
          name={fullRest ? 'info' : 'shield-check'}
          style={{ marginTop: 1, flex: 'none', color: fullRest ? 'var(--rest)' : 'var(--dgr)' }}
        />
        <span>{fullRest ? t.injStage0Note : t.injFeelDriven}</span>
      </div>

      <div className="sec">{t.injYourStages}</div>
      <div className="slist" style={{ marginTop: 8 }}>
        {fullRest && inj.fullRestUntil != null && (
          <div className="r rest" style={{ alignItems: 'flex-start' }}>
            <span className="kn">
              <Icon name="moon" weight="bold" />
            </span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--rest200)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {t.injStage0}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#052231',
                    background: 'var(--rest)',
                    borderRadius: 5,
                    padding: '2px 6px',
                  }}
                >
                  {t.injNow}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--rest300)', marginTop: 3 }}>
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
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  fontWeight: 700,
                  color:
                    state === 'now'
                      ? 'var(--dgrtext)'
                      : state === 'done'
                        ? 'var(--color-text)'
                        : 'var(--color-neutral-400)',
                }}
              >
                {t.injStage[sid]}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
                {state === 'now' ? t.injNow : state === 'done' ? t.injCleared : t.injByFeel}
              </span>
            </div>
          );
        })}
      </div>

      {inj.stage === 'rebuild' && !fullRest && <RebuildRamp />}

      <div className="spacer" />
      {!fullRest && inj.stage !== 'protect' && (
        <button className="btn p hot cta" onClick={() => setCi(true)}>
          <Icon name="heartbeat" weight="bold" /> {t.injLogCheckin}
        </button>
      )}
      <button className="btn s" style={{ marginTop: 10 }} onClick={() => setManage(true)}>
        <Icon name="dots-three-vertical" /> {t.injManage}
      </button>

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
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130, marginTop: 12 }}>
        {steps.map((s) => (
          <div
            key={s.pct}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color:
                  s.state === 'done'
                    ? 'var(--ok)'
                    : s.state === 'now'
                      ? 'var(--dgr)'
                      : 'var(--color-neutral-600)',
              }}
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
              style={{
                width: '100%',
                height: `${s.pct}%`,
                borderRadius: '7px 7px 3px 3px',
                background:
                  s.state === 'done'
                    ? 'var(--ok)'
                    : s.state === 'now'
                      ? 'var(--dgr)'
                      : 'var(--color-neutral-900)',
                border: s.state === 'lock' ? '1px dashed var(--n700)' : 'none',
              }}
            />
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color:
                  s.state === 'lock'
                    ? 'var(--color-neutral-500)'
                    : s.state === 'now'
                      ? 'var(--dgrtext)'
                      : 'var(--color-neutral-400)',
              }}
            >
              {s.pct}%
            </div>
          </div>
        ))}
      </div>
      <div
        className="card"
        style={{ marginTop: 16, display: 'flex', gap: 11, alignItems: 'flex-start' }}
      >
        <Icon
          name="arrow-fat-up"
          weight="fill"
          style={{ color: 'var(--dgr)', fontSize: 16, marginTop: 1 }}
        />
        <div style={{ fontSize: 12.5, color: 'var(--color-neutral-300)', lineHeight: 1.45 }}>
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
        <button className="bk" aria-label={t.backAction} onClick={onClose}>
          <Icon name="arrow-left" />
        </button>
        <span className="tt">{t.injManageTitle}</span>
      </div>

      <div className="sec">{t.injInjury}</div>
      <div className="slist" style={{ marginTop: 8 }}>
        <div className="r">
          <Icon name="target" style={{ color: 'var(--dgr)', fontSize: 17 }} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{t.injArea}</span>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>
            {sideLabel ? `${sideLabel} ${partName}` : partName}
          </span>
        </div>
        <div className="r">
          <Icon name="arrows-down-up" style={{ color: 'var(--color-neutral-400)', fontSize: 17 }} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{t.injCurrentStage}</span>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>
            {t.injStage[inj.stage]}
          </span>
        </div>
      </div>

      <div className="spacer" />
      <button
        className="btn s"
        style={{ color: 'var(--ok)', borderColor: 'var(--okline)' }}
        onClick={() => setConfirmHeal(true)}
      >
        <Icon name="check-circle" weight="bold" /> {t.injMarkHealed}
      </button>
      <button
        className="btn s"
        style={{ marginTop: 10, color: 'var(--dgr)', borderColor: 'var(--dgrline)' }}
        onClick={() => setConfirmCancel(true)}
      >
        <Icon name="x-circle" /> {t.injCancelPlan}
      </button>

      {confirmHeal && (
        <ConfirmDialog
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
      <div
        className="rx"
        style={{ position: 'static', padding: 0, background: 'transparent', overflow: 'visible' }}
      >
        <div className="rk">
          <Icon name="heartbeat" weight="fill" /> {t.injCheckinKicker}
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', marginTop: 8 }}>
          {t.injCheckinTitle}
        </div>
        <div className="sub" style={{ marginTop: 4 }}>
          {t.injCheckinHint}
        </div>
        <div className="tl" style={{ marginTop: 14 }}>
          <button className="tlc green" onClick={() => pick('fine')}>
            <span className="lt" />
            <span>
              <span className="tt">{t.injCiFine}</span>
              <div className="ts">{t.injCiFineSub}</div>
            </span>
            <span className="cons">↑ {t.injConsProgress}</span>
          </button>
          <button className="tlc amber" onClick={() => pick('sore')}>
            <span className="lt" />
            <span>
              <span className="tt">{t.injCiSore}</span>
              <div className="ts">{t.injCiSoreSub}</div>
            </span>
            <span className="cons">→ {t.injConsHold}</span>
          </button>
          <button className="tlc red" onClick={() => pick('pain')}>
            <span className="lt" />
            <span>
              <span className="tt">{t.injCiPain}</span>
              <div className="ts">{t.injCiPainSub}</div>
            </span>
            <span className="cons">↓ {t.injConsBack}</span>
          </button>
        </div>
        <div className="rulebox" style={{ marginTop: 14 }}>
          <Icon name="info" style={{ marginTop: 1, flex: 'none' }} />
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
  const iconColor = tone === 'ok' ? 'var(--ok)' : tone === 'g' ? 'var(--g500)' : 'var(--dgr)';
  const iconBg =
    tone === 'ok'
      ? 'rgba(76,190,140,.16)'
      : tone === 'g'
        ? 'rgba(217,162,79,.14)'
        : 'rgba(226,86,79,.16)';
  const iconBorder =
    tone === 'ok' ? 'var(--okline)' : tone === 'g' ? 'var(--g700)' : 'var(--dgrline)';
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
      <div
        className="rx"
        style={{
          position: 'static',
          padding: 0,
          background: 'transparent',
          overflow: 'visible',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: iconBg,
            border: `1px solid ${iconBorder}`,
            display: 'grid',
            placeItems: 'center',
            color: iconColor,
            fontSize: 30,
            marginTop: 8,
          }}
        >
          <Icon name={icon} weight="fill" />
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, marginTop: 16 }}>{title}</div>
        <div className="sub" style={{ marginTop: 8, maxWidth: 290 }}>
          {body}
        </div>
        {res.outcome !== 'hold' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 20,
              padding: '13px 16px',
              borderRadius: 12,
              background: res.outcome === 'ready' ? 'var(--surface2)' : 'var(--dgrt)',
              border: `1px solid ${res.outcome === 'ready' ? 'var(--color-divider)' : 'var(--dgrline)'}`,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: res.outcome === 'ready' ? 'var(--color-neutral-500)' : 'var(--dgrrose)',
              }}
            >
              {t.injStage[res.from]}
            </span>
            <Icon
              name={res.outcome === 'ready' ? 'arrow-right' : 'arrow-left'}
              weight="bold"
              style={{ color: res.outcome === 'ready' ? 'var(--ok)' : 'var(--dgr)' }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: res.outcome === 'ready' ? 'var(--oktext)' : 'var(--dgrtext)',
              }}
            >
              {t.injStage[res.stage]}
            </span>
          </div>
        ) : (
          <div
            style={{
              marginTop: 20,
              padding: '13px 16px',
              borderRadius: 12,
              background: 'var(--surface2)',
              border: '1px solid var(--color-divider)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--g300)',
            }}
          >
            {t.injResStaying(t.injStage[res.stage])}
          </div>
        )}
        <div className="dots" style={{ marginTop: 16, justifyContent: 'center' }}>
          {REHAB_STAGES.map((sid, i) => (
            <span key={sid} className={`dot${i < dotIdx ? ' done' : i === dotIdx ? ' on' : ''}`} />
          ))}
        </div>
        {res.outcome === 'ready' ? (
          <>
            <button
              className="btn p hot"
              style={{ marginTop: 22 }}
              onClick={() => {
                advanceInjury(injId);
                onClose();
              }}
            >
              {t.injMoveUp(t.injStage[res.stage])} <Icon name="arrow-right" weight="bold" />
            </button>
            <button
              className="btn s"
              style={{ marginTop: 10 }}
              onClick={() => {
                dismissAdvance(injId);
                onClose();
              }}
            >
              {t.injStayLonger}
            </button>
          </>
        ) : (
          <button className="btn p hot" style={{ marginTop: 22 }} onClick={onClose}>
            {t.done}
          </button>
        )}
      </div>
    </Sheet>
  );
}
