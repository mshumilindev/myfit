/**
 * MasteryView (F5) — the Mastery detail, ladder, shortfalls and calibration.
 * Reads computeMastery() and renders design MT-03…MT-08. Mastery is a live
 * measure of how well you train, never an achievements/points board.
 */
import { useMemo, useState } from 'react';
import { useStore, setMasteryHistory } from '../store';
import {
  computeMastery,
  MASTERY_RANKS,
  AXIS_WEIGHT,
  sublevelRoman,
  type AxisKey,
  type PracticeSignal,
  type SignalStatus,
  type TrainingPattern,
  type MasteryResult,
} from '../mastery';
import { useT } from '../i18n';
import { Icon, Sheet } from '../ui';
import type { Shell } from '../App';

const AXIS_ICON: Record<AxisKey, string> = {
  strength: 'barbell',
  consistency: 'calendar-check',
  experience: 'hourglass',
  practice: 'blueprint',
};
const SIGNAL_ICON: Record<PracticeSignal['key'], string> = {
  coverage: 'user-square',
  progression: 'trend-up',
  volume: 'gauge',
  warmup: 'thermometer-simple',
  cooldown: 'person-simple-tai-chi',
  rest: 'timer',
  recovery: 'bed',
  cardio: 'heartbeat',
  structure: 'list-numbers',
};

/** The brass mastery seal — a hexagon with a double chevron. */
function Seal({ size = 34, dim = false }: { size?: number; dim?: boolean }) {
  const stroke = dim ? 'var(--color-neutral-500)' : 'var(--color-accent)';
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: 'block' }} aria-hidden>
      <polygon
        points="32,4 56,17 56,44 32,60 8,44 8,17"
        fill={dim ? 'none' : 'var(--color-accent-900)'}
        stroke={dim ? 'var(--color-neutral-700)' : 'var(--color-accent-600)'}
        strokeWidth="1.8"
        strokeDasharray={dim ? '5 4' : undefined}
      />
      <path
        d="M22 38 L32 26 L42 38"
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!dim && (
        <path
          d="M22 45 L32 33 L42 45"
          fill="none"
          stroke="var(--color-accent-600)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** Conic progress ring with a dark inner disc. */
function Ring({
  frac,
  size,
  inner,
  children,
}: {
  frac: number;
  size: number;
  inner: number;
  children: React.ReactNode;
}) {
  const p = Math.round(Math.max(0, Math.min(1, frac)) * 100);
  return (
    <span
      className="mst-ring"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--color-accent) 0 ${p}%, #241b0e ${p}% 100%)`,
      }}
    >
      <span className="mst-ring-in" style={{ width: inner, height: inner }}>
        {children}
      </span>
    </span>
  );
}

export function MasteryView({ shell, onClose }: { shell: Shell; onClose: () => void }) {
  void shell;
  const { t } = useT();
  const store = useStore();
  const [now] = useState(() => Date.now());
  const m = useMemo(
    () =>
      computeMastery(store, now, {
        trainingSinceYear: store.mastery.sinceYear,
        trainingPattern: store.mastery.pattern,
      }),
    [store, now],
  );

  const [page, setPage] = useState<'detail' | 'shortfall' | 'ladder' | 'calibrate'>(
    m.calibrating ? 'calibrate' : 'detail',
  );
  const [practiceOpen, setPracticeOpen] = useState(false);

  const rankName = (id: string) => t.masteryRank[id] ?? id;
  const back = () => (page === 'detail' ? onClose() : setPage('detail'));

  if (page === 'ladder') return <Ladder m={m} onBack={() => setPage('detail')} />;
  if (page === 'shortfall') return <Shortfalls m={m} onBack={() => setPage('detail')} />;
  if (page === 'calibrate')
    return <Calibration m={m} onBack={() => (m.calibrating ? onClose() : setPage('detail'))} />;

  // --- MT-03 · detail ------------------------------------------------------
  const axisReadout = (key: AxisKey): string => {
    const a = m.axes[key];
    const f = a.facts;
    if (key === 'strength')
      return t.masteryStrengthRead(
        t.masteryLevel[String(f.topLevel)] ?? '',
        String(f.topLift ?? ''),
      );
    if (key === 'consistency')
      return t.masteryConsistencyRead(Number(f.perWeek ?? 0), Number(f.activeWeeks ?? 0));
    if (key === 'experience') return t.masteryExperienceRead(Number(f.years ?? 0));
    return t.masteryPracticeRead((f.low as string[])?.length ?? 0);
  };

  return (
    <div className="screen mst">
      <div className="mst-head">
        <button className="icon-btn" aria-label={t.backAction} onClick={back}>
          <Icon name="caret-left" />
        </button>
        <span className="mst-head-title">{t.masteryTitle}</span>
      </div>

      <div className="mst-body">
        {/* hero */}
        <div className="mst-hero">
          <div className="mst-hero-top">
            <Ring frac={m.rankProgress} size={120} inner={100}>
              <span className="mst-hero-num num">{m.rating}</span>
              <span className="mst-hero-num-lbl">{t.masteryRatingLabel}</span>
            </Ring>
            <div className="mst-hero-rank">
              <Seal size={34} />
              <div className="mst-rank-line">
                <span className="mst-rank-name">{rankName(m.rank.id)}</span>
                <span className="rn">{sublevelRoman(m.sublevel)}</span>
              </div>
              <div className="mst-rank-meaning">
                {m.nextRank
                  ? t.masteryNBelow(
                      m.toNextSublevel,
                      `${rankName(m.rank.id)} ${sublevelRoman(Math.min(3, m.sublevel + 1))}`,
                    )
                  : t.masteryRankMeaning[m.rank.id]}
              </div>
            </div>
          </div>

          <div className="mst-balance-lbl">{t.masteryBalanceTitle}</div>
          <div className="mst-balance">
            {(['strength', 'consistency', 'experience', 'practice'] as AxisKey[]).map((k) => (
              <div key={k} className="mst-bal-row">
                <span className="mst-bal-name">
                  {t.masteryAxis[k]}{' '}
                  <span className="mst-bal-wt">
                    {t.masteryAxisPct(Math.round(AXIS_WEIGHT[k] * 100))}
                  </span>
                </span>
                <span className="bar mst-bal-bar">
                  <i style={{ width: `${m.axes[k].score}%` }} />
                </span>
                <span className="mst-bal-num num">{m.axes[k].score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* breakdown */}
        <div className="mst-breakdown">
          <div className="mst-bd-head">
            <span className="section-label">{t.masteryBreakdown}</span>
            <span className="mst-bd-hint">{t.masteryTapAxis}</span>
          </div>

          {(['strength', 'consistency', 'experience'] as AxisKey[]).map((k) => (
            <button
              key={k}
              className="mst-tile"
              onClick={() => (k === 'experience' ? setPage('calibrate') : undefined)}
            >
              <div className="mst-tile-head">
                <Icon name={AXIS_ICON[k]} />
                <span className="mst-tile-name">
                  {t.masteryAxis[k]}
                  {k === 'strength' && (
                    <span className="mst-tile-sub"> {t.masteryRelativeToYou}</span>
                  )}
                </span>
                <span className="mst-tile-score num">
                  {m.axes[k].score}
                  <span className="mst-tile-max">/100</span>
                </span>
              </div>
              <span className="bar mst-tile-bar">
                <i style={{ width: `${m.axes[k].score}%` }} />
              </span>
              <div className="mst-tile-read">
                {axisReadout(k)}
                {k === 'experience' && (
                  <span className="chip n mst-src">
                    {m.axes.experience.facts.selfReported
                      ? t.masterySelfReported
                      : t.masteryAppMeasured}
                  </span>
                )}
              </div>
            </button>
          ))}

          {/* practice — the new axis */}
          <button className="mst-tile mst-practice" onClick={() => setPracticeOpen(true)}>
            <div className="mst-tile-head">
              <Icon name="blueprint" />
              <span className="mst-tile-name">{t.masteryPractice}</span>
              <span className="mst-tile-score num">
                {m.axes.practice.score}
                <span className="mst-tile-max gold">/100</span>
              </span>
            </div>
            <span className="bar mst-tile-bar">
              <i style={{ width: `${m.axes.practice.score}%` }} />
            </span>
            <div className="mst-tile-read gold">{axisReadout('practice')}</div>
            <div className="mst-practice-more">
              <span>{t.masteryPracticeSignals}</span>
              <Icon name="caret-right" />
            </div>
          </button>

          <button className="btn btn-primary mst-cta" onClick={() => setPage('shortfall')}>
            <Icon name="trend-up" />
            {t.masterySeeShortfall}
          </button>
          <button className="mst-ranks-link" onClick={() => setPage('ladder')}>
            <Icon name="steps" />
            {t.masterySeeRanks}
            <Icon name="caret-right" />
          </button>
        </div>
      </div>

      {practiceOpen && <PracticeSheet m={m} onClose={() => setPracticeOpen(false)} />}
    </div>
  );
}

// --- MT-08 · practice signals sheet -----------------------------------------
function PracticeSheet({ m, onClose }: { m: MasteryResult; onClose: () => void }) {
  const { t } = useT();
  const statusClass = (s: SignalStatus) => (s === 'good' ? 'ok' : s === 'watch' ? 'watch' : 'low');
  const signalRead = (sig: PracticeSignal): string => {
    const f = sig.facts;
    const muscles = (arr: unknown) =>
      ((arr as string[]) ?? [])
        .slice(0, 2)
        .map((x) => t.muscleGroups[x as keyof typeof t.muscleGroups] ?? x)
        .join(', ');
    switch (sig.key) {
      case 'coverage':
        return (f.skipped as string[])?.length ? t.mrSkipped(muscles(f.skipped)) : t.mrCovered;
      case 'progression':
        return (f.flat as string[])?.length
          ? t.mrFlat(((f.flat as string[]) ?? []).slice(0, 2).join(', '))
          : t.mrClimbing;
      case 'volume':
        return (f.belowMEV as string[])?.length ? t.mrBelowMev(muscles(f.belowMEV)) : t.mrVolOk;
      case 'warmup':
        return t.mrWarm(Number(f.pctWarmed ?? 0));
      case 'cooldown':
        return sig.status === 'good' ? t.mrCooldownOk : t.mrCooldownLow;
      case 'rest':
        return Number(f.shortish ?? 0) > 0 ? t.mrRestShort : t.mrRestOk;
      case 'recovery':
        return sig.status === 'good' ? t.mrRecoveryOk : t.mrRecoveryHard;
      case 'cardio':
        return Number(f.sessions ?? 0) > 0 ? t.mrCardioOk : t.mrCardioLow;
      case 'structure':
        return sig.status === 'good' ? t.mrStructureOk : t.mrStructureWatch;
      default:
        return '';
    }
  };
  return (
    <Sheet className="mst-practice-sheet" onClose={onClose}>
      <div className="mst-ps-head">
        <Icon name="blueprint" />
        <span className="mst-ps-title">{t.masteryPractice}</span>
        <span className="chip gold num">{m.axes.practice.score}/100</span>
      </div>
      <div className="mst-ps-sub">{t.masteryPracticeSub}</div>
      <div className="mst-ps-list">
        {m.practice.map((sig) => (
          <div key={sig.key} className="mst-ps-row">
            <Icon name={SIGNAL_ICON[sig.key]} className={`mst-ps-ic ${statusClass(sig.status)}`} />
            <div className="mst-ps-text">
              <div className="mst-ps-name">{t.masterySignal[sig.key]}</div>
              <div className="mst-ps-read">{signalRead(sig)}</div>
            </div>
            <span className={`chip mst-st ${statusClass(sig.status)}`}>
              {t.masteryStatus[sig.status]}
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// --- MT-04 · where you fall short -------------------------------------------
function Shortfalls({ m, onBack }: { m: MasteryResult; onBack: () => void }) {
  const { t } = useT();
  const rankName = (id: string) => t.masteryRank[id] ?? id;
  const impactClass = (i: string) => (i === 'high' ? 'gold' : i === 'med' ? 'goldd' : 'n');
  return (
    <div className="screen mst">
      <div className="mst-head">
        <button className="icon-btn" aria-label={t.backAction} onClick={onBack}>
          <Icon name="caret-left" />
        </button>
        <span className="mst-head-title">{t.masteryShortfall}</span>
      </div>
      <div className="mst-body mst-sf">
        <div className="mst-sf-next">
          <div>
            <div className="section-label gold">{t.masteryNextUp}</div>
            <div className="mst-sf-nextrank">
              <span>
                {rankName(m.rank.id)} {sublevelRoman(Math.min(3, m.sublevel + 1))}
              </span>
            </div>
          </div>
          <div className="mst-sf-below">
            <span className="num">{m.toNextSublevel}</span>
            <div className="section-label gold">{t.masteryBelowLabel}</div>
          </div>
        </div>
        <div className="mst-sf-intro">{t.masteryShortfallIntro}</div>

        <div className="mst-tile mst-sf-rows">
          {m.shortfalls.map((sf) => {
            const key = sf.signal ?? sf.axis;
            const sub = sf.signal
              ? `${t.masteryAxis[sf.axis]} · ${t.masterySignal[sf.signal]}`
              : t.masteryAxis[sf.axis];
            return (
              <div key={sf.key} className="mst-sf-row">
                <span className={`mst-sf-ic ${sf.impact === 'low' ? 'n' : 'gold'}`}>
                  <Icon name={sf.signal ? SIGNAL_ICON[sf.signal] : AXIS_ICON[sf.axis]} />
                </span>
                <div className="mst-sf-body">
                  <div className="mst-sf-title">{t.masteryFix[key]}</div>
                  <div className="mst-sf-sub">{sub}</div>
                </div>
                <span className={`chip mst-imp ${impactClass(sf.impact)}`}>
                  {t.masteryImpact[sf.impact]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mst-sf-note">
          <Icon name="info" />
          <span>{t.masteryImpactHint}</span>
        </div>
      </div>
    </div>
  );
}

// --- MT-05 · the ladder ------------------------------------------------------
function Ladder({ m, onBack }: { m: MasteryResult; onBack: () => void }) {
  const { t } = useT();
  const rankName = (id: string) => t.masteryRank[id] ?? id;
  const ranks = [...MASTERY_RANKS].map((r, i) => ({ ...r, i })).reverse();
  return (
    <div className="screen mst">
      <div className="mst-head">
        <button className="icon-btn" aria-label={t.backAction} onClick={onBack}>
          <Icon name="caret-left" />
        </button>
        <span className="mst-head-title">{t.masteryLadder}</span>
        <span className="chip n mst-scale">{t.masteryScale}</span>
      </div>
      <div className="mst-body mst-ladder">
        {ranks.map((r) => {
          const state = r.i > m.rankIndex ? 'locked' : r.i === m.rankIndex ? 'current' : 'done';
          if (state === 'current')
            return (
              <div key={r.id} className="mst-rung current">
                <Seal size={40} />
                <div className="mst-rung-body">
                  <div className="mst-rung-line">
                    <span className="mst-rung-name">{rankName(r.id)}</span>
                    <span className="rn">{sublevelRoman(m.sublevel)}</span>
                    <span className="mst-here">· {t.masteryYouAreHere}</span>
                  </div>
                  <div className="mst-rung-mean">{t.masteryRankMeaning[r.id]}</div>
                  <div className="mst-pips">
                    {[1, 2, 3].map((s) => (
                      <span key={s} className={s <= m.sublevel ? 'on' : ''} />
                    ))}
                  </div>
                </div>
                <span className="num lbl mst-rung-thr gold">{m.rating}</span>
              </div>
            );
          return (
            <div key={r.id} className={`mst-rung ${state}`}>
              {state === 'locked' ? (
                <Icon name="lock-simple" className="mst-rung-lock" />
              ) : (
                <Icon name="check-circle" weight="fill" className="mst-rung-done" />
              )}
              <div className="mst-rung-body">
                <span className="mst-rung-name">{rankName(r.id)}</span>
                <div className="mst-rung-mean">{t.masteryRankMeaning[r.id]}</div>
              </div>
              <span className="num lbl mst-rung-thr">{r.threshold}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- MT-06 · calibration / experience history editor -------------------------
const PATTERNS: TrainingPattern[] = ['continuous', 'occasional', 'frequent'];
function Calibration({ m, onBack }: { m: MasteryResult; onBack: () => void }) {
  const { t } = useT();
  const store = useStore();
  const nowYear = new Date().getFullYear();
  const [since, setSince] = useState<number>(store.mastery.sinceYear ?? nowYear - 1);
  const [pat, setPat] = useState<TrainingPattern>(store.mastery.pattern ?? 'continuous');
  const rankName = (id: string) => t.masteryRank[id] ?? id;
  const confBars = m.confidence === 'high' ? 3 : m.confidence === 'med' ? 2 : 1;

  const save = () => {
    setMasteryHistory(since, pat);
    onBack();
  };

  return (
    <div className="screen mst">
      <div className="mst-head">
        <button className="icon-btn" aria-label={t.backAction} onClick={onBack}>
          <Icon name="caret-left" />
        </button>
        <span className="mst-head-title">{t.masteryTitle}</span>
      </div>
      <div className="mst-body mst-calib">
        {m.calibrating && (
          <>
            <div className="mst-calib-hero">
              <Seal size={82} dim />
              <div className="mst-calib-title">{t.masteryCalibTitle}</div>
              <div className="mst-calib-body">{t.masteryCalibBody(m.sessions)}</div>
              <div className="mst-calib-prov">
                <span>{t.masteryProvisional}</span>
                <span className="mst-calib-rank">~ {rankName(m.rank.id)}</span>
              </div>
            </div>

            <div className="mst-tile">
              <div className="mst-conf-head">
                <span className="section-label">{t.masteryConfidence}</span>
                <span className="mst-conf-lvl">{t.masteryConfLevel[m.confidence]}</span>
              </div>
              <div className="mst-conf-bars">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="bar">
                    <i style={{ width: i < confBars ? '100%' : '0%' }} />
                  </span>
                ))}
              </div>
              <div className="mst-conf-note">{t.masteryConfBuilds(m.sessionsToFirm)}</div>
            </div>
          </>
        )}

        {/* optional training history — seeds Experience only */}
        <div className="mst-tile mst-history">
          <div className="mst-hist-head">
            <Icon name="hourglass-medium" />
            <span className="mst-hist-q">{t.masteryBeenTraining}</span>
            <span className="chip n mst-opt">{t.masteryOptional}</span>
          </div>
          <div className="mst-hist-body">{t.masteryHistoryBody}</div>
          <div className="mst-year">
            <button
              className="mst-year-btn"
              aria-label="-"
              onClick={() => setSince((y) => Math.max(1960, y - 1))}
            >
              <Icon name="minus" weight="bold" />
            </button>
            <span className="mst-year-val">
              <Icon name="calendar-blank" />
              {t.masteryTrainingSince(since)}
            </span>
            <button
              className="mst-year-btn"
              aria-label="+"
              onClick={() => setSince((y) => Math.min(nowYear, y + 1))}
            >
              <Icon name="plus" weight="bold" />
            </button>
          </div>
          <div className="mst-patq">{t.masteryPatternQ}</div>
          <div className="mst-pat">
            {PATTERNS.map((p) => (
              <button key={p} className={pat === p ? 'on' : ''} onClick={() => setPat(p)}>
                {t.masteryPattern[p]}
              </button>
            ))}
          </div>
          <div className="mst-hist-floor">
            <Icon name="arrow-up-right" />
            {t.masteryHistoryFloor}
          </div>
        </div>

        <button className="btn btn-primary mst-save" onClick={save}>
          <Icon name="check" />
          {t.masterySave}
        </button>
      </div>
    </div>
  );
}

// --- MT-01 / MT-02 · the header seal badge ----------------------------------
export function MasteryBadge({ onOpen }: { onOpen: () => void }) {
  const store = useStore();
  const [now] = useState(() => Date.now());
  const m = useMemo(
    () =>
      computeMastery(store, now, {
        trainingSinceYear: store.mastery.sinceYear,
        trainingPattern: store.mastery.pattern,
      }),
    [store, now],
  );
  if (m.calibrating) {
    return (
      <button className="mst-badge calib" onClick={onOpen} aria-label="Mastery">
        <span className="mst-badge-ring calib">
          <span className="mst-badge-in">
            <Seal size={11} dim />
          </span>
        </span>
        <span className="mst-badge-dots num">···</span>
      </button>
    );
  }
  return (
    <button className="mst-badge" onClick={onOpen} aria-label="Mastery">
      <Ring frac={m.rankProgress} size={26} inner={20}>
        <Seal size={11} />
      </Ring>
      <span className="mst-badge-num num">{m.rating}</span>
    </button>
  );
}
