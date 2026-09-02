/**
 * Recap views (design "My Fit — Recaps"). RecapView is the scrolling read view;
 * RecapStory is the paged "play" story; RecapShareCard is the portrait card.
 * All three read one Recap built from the live store for a period id.
 */
import { useMemo, useState } from 'react';
import { useT, fmtKg, type LocaleId } from '../i18n';
import { useStore, latestWeight } from '../store';
import { Icon } from '../ui';
import { FocusBodyMap } from '../components/Muscle';
import { focusToGroup } from '../data/subregions';
import {
  buildRecap,
  recapRefFromId,
  type Recap,
  type RecapRef,
  type RecapDelta,
} from '../recaps';
import type { Strings } from '../i18n/en';

type T = Strings;

// ─── formatting helpers ──────────────────────────────────────────────────────
export function periodTitle(ref: RecapRef, locale: LocaleId): string {
  if (ref.kind === 'month')
    return new Date(ref.year, ref.index, 1).toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
    });
  if (ref.kind === 'quarter') return `Q${ref.index} ${ref.year}`;
  return `${ref.year}`;
}
export function periodShort(ref: RecapRef, locale: LocaleId): string {
  if (ref.kind === 'month')
    return new Date(ref.year, ref.index, 1).toLocaleDateString(locale, { month: 'long' });
  if (ref.kind === 'quarter') return `Q${ref.index} ${ref.year}`;
  return `${ref.year}`;
}
export function periodWord(ref: RecapRef, t: T): string {
  return ref.kind === 'month' ? t.rcPeriodMonth : ref.kind === 'quarter' ? t.rcPeriodQuarter : t.rcPeriodYear;
}
function tonnes(kg: number): number {
  return Math.round(kg / 1000);
}
function headlineLine(t: T, r: Recap, pw: string): string {
  switch (r.headline) {
    case 'highestVolume':
      return t.rcHlHighestVolume(pw);
    case 'consistency':
      return t.rcHlConsistency(pw);
    case 'records':
      return t.rcHlRecords(pw);
    case 'comeback':
      return t.rcHlComeback(pw);
    case 'firstPeriod':
      return t.rcHlFirst(pw);
    default:
      return t.rcHlSteady(pw);
  }
}
function muscleName(t: T, g: string): string {
  return t.muscleGroups[g] ?? g;
}
function focusName(t: T, f: string): string {
  return t.subMuscleNames[f] ?? t.muscleGroups[focusToGroup(f as never)] ?? f;
}

export function useRecap(period: string): { ref: RecapRef; recap: Recap } | null {
  const store = useStore();
  return useMemo(() => {
    const ref = recapRefFromId(period);
    if (!ref) return null;
    const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
    return { ref, recap: buildRecap(ref, store.workouts, store.activities, store.goals, bodyKg) };
  }, [period, store.workouts, store.activities, store.goals, store.bodyMetrics]);
}

// ─── small pieces ────────────────────────────────────────────────────────────
function Delta({ d, suffix }: { d: RecapDelta; suffix?: string }) {
  const { t } = useT();
  if (d == null) return <span className="rc-dn">{t.rcFirstPeriodDelta}</span>;
  const up = d >= 0;
  const pct = `${Math.abs(Math.round(d * 100))}%`;
  return (
    <span className="rc-delta">
      <Icon name={up ? 'caret-up' : 'caret-down'} weight="bold" className={up ? 'rc-up' : 'rc-dn'} />
      <span className={`rc-num ${up ? 'rc-up' : 'rc-dn'}`}>
        {up ? '+' : '−'}
        {pct}
      </span>
      {suffix && <span style={{ color: 'var(--color-neutral-600)' }}>{suffix}</span>}
    </span>
  );
}

// ═══ SCROLLING READ VIEW ═════════════════════════════════════════════════════
export function RecapView({
  period,
  onClose,
  onStory,
  desktop,
}: {
  period: string;
  onClose: () => void;
  onStory: () => void;
  desktop?: boolean;
}) {
  const { t, locale } = useT();
  const data = useRecap(period);
  if (!data) return null;
  const { ref, recap: r } = data;
  const pw = periodWord(ref, t);
  const trendMax = Math.max(...r.trend.map((b) => b.value), 0.001);
  const kindLabel = ref.kind === 'month' ? t.rcKindMonth : ref.kind === 'quarter' ? t.rcKindQuarter : t.rcKindYear;

  return (
    <div className={`screen rc-view${desktop ? ' desktop' : ''}`}>
      <div className="rc-topbar">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span style={{ flex: 1, fontSize: 14, color: 'var(--color-neutral-400)' }}>{t.rcRecap}</span>
        <button className="icon-btn" onClick={onStory} aria-label={t.rcPlayStory}>
          <Icon name="cards" />
        </button>
      </div>

      {/* hero */}
      <div className="rc-hero-band">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="barbell" weight="fill" style={{ color: 'var(--color-accent)', fontSize: 15 }} />
          <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>{kindLabel}</span>
        </div>
        <div style={{ fontSize: 34, letterSpacing: '-0.03em', marginTop: 12, lineHeight: 1.05 }}>
          {periodTitle(ref, locale)}
        </div>
        <div style={{ fontSize: 17, color: 'var(--color-accent-100)', marginTop: 14, lineHeight: 1.4 }}>
          {headlineLine(t, r, pw)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-accent-300)', marginTop: 8, lineHeight: 1.5 }}>
          {t.rcShowedUp(r.sessions)}
        </div>
      </div>

      <div className="rc-body">
        {/* totals */}
        <div className={desktop ? 'rc-span2' : ''}>
          <div className="rc-lbl" style={{ marginBottom: 12 }}>{t.rcTheTotals}</div>
          <div className="rc-totals">
            <div className="rc-stat">
              <div className="rc-num" style={{ fontSize: 32, letterSpacing: '-0.03em' }}>{r.sessions}</div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>{t.rcSessions}</div>
              <Delta d={r.d.sessions} />
            </div>
            <div className="rc-stat">
              <div className="rc-num" style={{ fontSize: 32, letterSpacing: '-0.03em' }}>
                {tonnes(r.volumeKg)}<span style={{ fontSize: 17, color: 'var(--color-neutral-500)' }}> t</span>
              </div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>{t.rcVolume}</div>
              <Delta d={r.d.volume} suffix={`${Math.round(r.volumeKg).toLocaleString(locale)} kg`} />
            </div>
            <div className="rc-stat">
              <div className="rc-num" style={{ fontSize: 32, letterSpacing: '-0.03em' }}>
                {r.timeHours.toFixed(1)}<span style={{ fontSize: 17, color: 'var(--color-neutral-500)' }}> h</span>
              </div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>{t.rcTimeTrained}</div>
              <Delta d={r.d.time} />
            </div>
            <div className="rc-stat">
              <div className="rc-num" style={{ fontSize: 32, letterSpacing: '-0.03em' }}>{r.sets}</div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>{t.rcSetsReps(r.reps.toLocaleString(locale))}</div>
              <Delta d={r.d.sets} />
            </div>
          </div>
          <div className="rc-cal">
            <Icon name="flame" weight="fill" style={{ fontSize: 30, color: 'var(--color-kcal)' }} />
            <div style={{ flex: 1 }}>
              <div className="rc-num" style={{ fontSize: 28, letterSpacing: '-0.03em', color: 'var(--color-kcal-text)' }}>
                {Math.round(r.calories).toLocaleString(locale)}<span style={{ fontSize: 15 }}> {t.rcKcal}</span>
              </div>
              <div className="rc-lbl" style={{ marginTop: 4, color: '#6f93b3' }}>{t.rcCalBurn}</div>
            </div>
            <Delta d={r.d.calories} />
          </div>
        </div>

        {/* records */}
        {r.records.length > 0 && (
          <div className="rc-card gold">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="trophy" weight="fill" style={{ color: 'var(--color-accent)', fontSize: 16 }} />
              <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>{t.rcNewRecords}</span>
              <span style={{ flex: 1 }} />
              <span className="rc-num" style={{ fontSize: 22, color: 'var(--color-accent-300)' }}>{r.prCount}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
              {r.records.slice(0, 3).map((rec) => (
                <div className="rc-rec-row" key={rec.name}>
                  <Icon name="medal" weight="fill" style={{ color: 'var(--color-accent)', fontSize: 18 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{rec.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-accent-300)' }}>{t.rcEst1rm(fmtKg(rec.e1rm))}</div>
                  </div>
                  <div className="rc-num" style={{ fontSize: 19, color: 'var(--color-accent-100)' }}>{fmtKg(rec.weightKg)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              {r.heaviestSet && (
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.22)', borderRadius: 12, padding: '11px 12px' }}>
                  <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>{t.rcHeaviestSet}</span>
                  <div style={{ fontSize: 14, marginTop: 5 }}>{r.heaviestSet.name}</div>
                  <div className="rc-num" style={{ fontSize: 13, color: 'var(--color-accent-100)' }}>{t.rcSetWxR(fmtKg(r.heaviestSet.weightKg), r.heaviestSet.reps)}</div>
                </div>
              )}
              {r.biggestSession && (
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.22)', borderRadius: 12, padding: '11px 12px' }}>
                  <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>{t.rcBiggestSession}</span>
                  <div style={{ fontSize: 14, marginTop: 5 }}>{new Date(r.biggestSession.ts).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</div>
                  <div className="rc-num" style={{ fontSize: 13, color: 'var(--color-accent-100)' }}>{t.rcTMoved(`${tonnes(r.biggestSession.volumeKg) || (r.biggestSession.volumeKg / 1000).toFixed(1)} t`)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* muscle distribution */}
        {r.muscles.length > 0 && (
          <div className="rc-card">
            <div className="rc-lbl" style={{ marginBottom: 6 }}>{t.rcMuscleDist}</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: 'none', width: 132 }}>
                <FocusBodyMap grow={r.growMuscles} ease={[]} view="both" width={132} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {r.muscles.slice(0, 4).map((m) => (
                  <div key={m.group}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span>{muscleName(t, m.group)}</span>
                      <span className="rc-num" style={{ color: 'var(--color-neutral-500)' }}>{m.pct}%</span>
                    </div>
                    <div className="rc-rank"><i style={{ width: `${Math.min(100, (m.sets / r.muscles[0].sets) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            {r.leastMuscle && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'var(--color-neutral-900)' }}>
                <Icon name="info" weight="bold" style={{ fontSize: 14, color: 'var(--color-neutral-500)', marginTop: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--color-neutral-500)', lineHeight: 1.5, flex: 1 }}>{t.rcLeastHint(muscleName(t, r.leastMuscle))}</span>
              </div>
            )}
          </div>
        )}

        {/* consistency */}
        <div className="rc-card">
          <div className="rc-lbl" style={{ marginBottom: 12 }}>{t.rcConsistency}</div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}><div className="rc-num" style={{ fontSize: 26 }}>{r.trainingDays}</div><div className="rc-lbl" style={{ marginTop: 4 }}>{t.rcTrainingDays}</div></div>
            <div style={{ flex: 1 }}><div className="rc-num" style={{ fontSize: 26, color: 'var(--color-accent-300)' }}>{r.longestStreak}</div><div className="rc-lbl" style={{ marginTop: 4 }}>{t.rcLongestStreak}</div></div>
            <div style={{ flex: 1 }}><div className="rc-num" style={{ fontSize: 26 }}>{r.perfectWeeks}<span style={{ fontSize: 15, color: 'var(--color-neutral-500)' }}>/{r.weeksInPeriod}</span></div><div className="rc-lbl" style={{ marginTop: 4 }}>{t.rcPerfectWeeks}</div></div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="rc-lbl" style={{ marginBottom: 9 }}>{t.rcYourWeek}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span className={`rc-dot7${r.weekdayMask[i] ? ' on' : ''}`} />
                  <span style={{ fontSize: 9, color: 'var(--color-neutral-600)' }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* trend */}
        <div className="rc-card">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="rc-lbl" style={{ flex: 1 }}>{ref.kind === 'month' ? t.rcVolTrendWeek : t.rcVolTrendMonth}</span>
            <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{t.rcTonnes}</span>
          </div>
          <div className="rc-trendbars">
            {r.trend.map((b, i) => (
              <div key={i} className={`rc-bar${b.peak ? ' peak' : ''}`}>
                <span style={{ height: `${Math.max(6, (b.value / trendMax) * 100)}%` }} />
                <small style={b.peak ? { color: 'var(--color-accent-300)' } : undefined}>
                  {b.label ?? new Date(ref.year, b.month ?? 0, 1).toLocaleDateString(locale, { month: 'short' })}
                </small>
              </div>
            ))}
          </div>
        </div>

        {/* goals */}
        {r.goal && (
          <div className="rc-card">
            <div className="rc-lbl" style={{ marginBottom: 12 }}>{t.rcTowardGoal}</div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div className="rc-ring" style={{ background: `conic-gradient(var(--color-accent) 0 ${r.goal.adherencePct}%, var(--color-neutral-900) ${r.goal.adherencePct}% 100%)` }}>
                <span><span className="rc-num" style={{ fontSize: 19 }}>{r.goal.adherencePct}<span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>%</span></span></span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{r.goal.archetype ? `${t.archetypes[r.goal.archetype]?.name ?? r.goal.archetype} · ${t.rcBlockFocusSuffix}` : t.rcBlockFocusSuffix}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {r.goal.hits.slice(0, 5).map((h) => (
                    <span key={h.muscle} className={`rc-chip${h.ok ? ' gold' : ''}`}>{focusName(t, h.muscle)}{h.ok ? ' ✓' : ''}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* activities */}
        {(r.recoveryMin > 0 || r.conditioningMin > 0) && (
          <div className="rc-card">
            <div className="rc-lbl" style={{ marginBottom: 12 }}>{t.rcAlongside}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="heartbeat" weight="bold" style={{ fontSize: 18, color: 'var(--color-neutral-400)' }} />
                <div><div style={{ fontSize: 15 }}>{r.recoveryMin}<span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}> {t.rcMinShort}</span></div><div className="rc-lbl" style={{ marginTop: 3 }}>{t.rcRecovery}</div></div>
              </div>
              <div style={{ width: 1, background: 'var(--color-divider)' }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="wind" weight="bold" style={{ fontSize: 18, color: 'var(--color-neutral-400)' }} />
                <div><div style={{ fontSize: 15 }}>{r.conditioningMin}<span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}> {t.rcMinShort}</span></div><div className="rc-lbl" style={{ marginTop: 3 }}>{t.rcConditioning}</div></div>
              </div>
            </div>
          </div>
        )}

        {/* close / share */}
        <div className="rc-card gold" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: 'var(--color-accent-100)', lineHeight: 1.45, maxWidth: '28ch', margin: '0 auto' }}>
            {headlineLine(t, r, pw)}
          </div>
          <button className="btn btn-primary" style={{ minHeight: 46, fontSize: 15, gap: 8, marginTop: 16, width: '100%' }} onClick={onStory}>
            <Icon name="export" weight="bold" />{t.rcShareYours(periodShort(ref, locale))}
          </button>
          <div style={{ fontSize: 11, color: 'var(--color-accent-300)', marginTop: 10 }}>{t.rcWatchSave}</div>
        </div>
      </div>
    </div>
  );
}

// ═══ PAGED STORY ═════════════════════════════════════════════════════════════
export function RecapStory({ period, onClose }: { period: string; onClose: () => void }) {
  const { t, locale } = useT();
  const data = useRecap(period);
  const [i, setI] = useState(0);
  if (!data) return null;
  const { ref, recap: r } = data;
  const pw = periodWord(ref, t);

  const panels: { bg: 'replay' | 'bg'; body: React.ReactNode }[] = [];
  // 1 opener
  panels.push({
    bg: 'replay',
    body: (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="barbell" weight="fill" style={{ color: 'var(--color-accent)', fontSize: 16 }} />
          <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>{t.rcWrapped(periodShort(ref, locale))}</span>
        </div>
        <div style={{ fontSize: 48, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 18 }}>{periodTitle(ref, locale)}</div>
        <div style={{ fontSize: 19, color: 'var(--color-accent-100)', marginTop: 20, lineHeight: 1.4, maxWidth: '24ch' }}>{headlineLine(t, r, pw)}</div>
      </div>
    ),
  });
  // 2 totals
  panels.push({
    bg: 'bg',
    body: (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
        <span className="rc-lbl" style={{ marginBottom: 14 }}>{t.rcYouMovedIn(periodShort(ref, locale))}</span>
        <div className="rc-num" style={{ fontSize: 76, letterSpacing: '-0.04em', lineHeight: 0.9, color: 'var(--color-accent-300)' }}>{tonnes(r.volumeKg)}<span style={{ fontSize: 30, color: 'var(--color-accent-300)' }}> t</span></div>
        <div style={{ fontSize: 15, color: 'var(--color-neutral-400)', marginTop: 6 }}>{t.rcAcrossSets(`${Math.round(r.volumeKg).toLocaleString(locale)} kg`, r.sets)}</div>
        <div style={{ display: 'flex', gap: 26, marginTop: 34 }}>
          <div><div className="rc-num" style={{ fontSize: 30 }}>{r.sessions}</div><div className="rc-lbl" style={{ marginTop: 5 }}>{t.rcSessions}</div></div>
          <div><div className="rc-num" style={{ fontSize: 30 }}>{r.timeHours.toFixed(1)}<span style={{ fontSize: 14, color: 'var(--color-neutral-500)' }}>h</span></div><div className="rc-lbl" style={{ marginTop: 5 }}>{t.rcTrained}</div></div>
          <div><div className="rc-num" style={{ fontSize: 30, color: 'var(--color-kcal-text)' }}>{(r.calories / 1000).toFixed(1)}<span style={{ fontSize: 14 }}>k</span></div><div className="rc-lbl" style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="flame" weight="fill" style={{ color: 'var(--color-kcal)' }} />{t.rcKcal}</div></div>
        </div>
      </div>
    ),
  });
  // 3 records (if any)
  if (r.records.length > 0) {
    panels.push({
      bg: 'replay',
      body: (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
          <Icon name="trophy" weight="fill" style={{ fontSize: 40, color: 'var(--color-accent)' }} />
          <div style={{ fontSize: 32, letterSpacing: '-0.02em', marginTop: 16, lineHeight: 1.1 }}>{t.rcYouSetRecords(r.prCount)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 26 }}>
            {r.records.slice(0, 3).map((rec, n) => (
              <div key={rec.name} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span className="rc-num" style={{ fontSize: 15, color: 'var(--color-accent-300)', width: 20 }}>{String(n + 1).padStart(2, '0')}</span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 17, color: 'var(--color-accent-100)' }}>{rec.name}</div><div style={{ fontSize: 12, color: 'var(--color-accent-300)' }}>{t.rcEst1rm(fmtKg(rec.e1rm))}</div></div>
                <div className="rc-num" style={{ fontSize: 24, color: 'var(--color-accent-300)' }}>{fmtKg(rec.weightKg)}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }
  // 4 muscles
  if (r.muscles.length > 0) {
    panels.push({
      bg: 'bg',
      body: (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 26px 0' }}>
          <span className="rc-lbl">{t.rcWhereWork}</span>
          <div style={{ fontSize: 26, letterSpacing: '-0.02em', marginTop: 10 }}>{t.rcMuscleLed(muscleName(t, r.muscles[0].group), muscleName(t, r.muscles[1]?.group ?? r.muscles[0].group))}</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
            <div style={{ width: 200 }}><FocusBodyMap grow={r.growMuscles} ease={[]} view="both" width={200} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 34 }}>
            {r.muscles.slice(0, 3).map((m) => (
              <div key={m.group} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, width: 80 }}>{muscleName(t, m.group)}</span>
                <div className="rc-rank"><i style={{ width: `${Math.min(100, (m.sets / r.muscles[0].sets) * 100)}%` }} /></div>
                <span className="rc-num" style={{ fontSize: 12, color: 'var(--color-neutral-500)', width: 34, textAlign: 'right' }}>{m.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }
  // 5 closing
  panels.push({
    bg: 'replay',
    body: (
      <>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
          <div style={{ fontSize: 14, color: 'var(--color-accent-300)', letterSpacing: '0.02em' }}>{periodTitle(ref, locale).toUpperCase()}</div>
          <div style={{ fontSize: 30, letterSpacing: '-0.02em', marginTop: 14, lineHeight: 1.2 }}>{headlineLine(t, r, pw)}</div>
          <div style={{ display: 'flex', gap: 22, marginTop: 26 }}>
            <div><div className="rc-num" style={{ fontSize: 28, color: 'var(--color-accent-300)' }}>{r.sessions}</div><div className="rc-lbl" style={{ marginTop: 4, color: 'var(--color-accent-300)' }}>{t.rcSessions}</div></div>
            <div><div className="rc-num" style={{ fontSize: 28, color: 'var(--color-accent-300)' }}>{tonnes(r.volumeKg)}<span style={{ fontSize: 14 }}>t</span></div><div className="rc-lbl" style={{ marginTop: 4, color: 'var(--color-accent-300)' }}>{t.rcVolShort}</div></div>
            <div><div className="rc-num" style={{ fontSize: 28, color: 'var(--color-accent-300)' }}>{r.prCount}</div><div className="rc-lbl" style={{ marginTop: 4, color: 'var(--color-accent-300)' }}>PRs</div></div>
          </div>
        </div>
        <div style={{ padding: '0 22px 40px' }}>
          <button className="btn btn-primary" style={{ width: '100%', minHeight: 48, fontSize: 15, gap: 8 }} onClick={onClose}><Icon name="check" weight="bold" />{t.rcShareCard}</button>
        </div>
      </>
    ),
  });

  const n = panels.length;
  const go = (dir: number) => {
    const next = i + dir;
    if (next < 0) return;
    if (next >= n) return onClose();
    setI(next);
  };

  return (
    <div className="rc-story" style={{ background: panels[i].bg === 'replay' ? 'var(--rc-replay)' : 'var(--color-bg)' }}>
      <div className="rc-progress">
        {panels.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}
      </div>
      <div className="rc-story-panel" style={{ position: 'relative' }}>
        {panels[i].body}
        <div className="rc-tapzones">
          <button aria-label="prev" onClick={() => go(-1)} />
          <button aria-label="next" onClick={() => go(1)} style={{ flex: 2 }} />
        </div>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label={t.backAction} style={{ position: 'absolute', top: 40, right: 16, zIndex: 2, color: 'var(--color-neutral-300)' }}>
        <Icon name="x" weight="bold" />
      </button>
    </div>
  );
}
