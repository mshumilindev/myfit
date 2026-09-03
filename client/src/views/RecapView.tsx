/**
 * Recap views (design "My Fit — Recaps"). RecapView is the scrolling read view;
 * RecapStory is the paged, auto-advancing "play" story; both read one Recap
 * built from the live store for a period id. Sharing draws a portrait card on a
 * canvas (data/shareCard) and hands it to the native share sheet.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT, fmtKg, type LocaleId } from '../i18n';
import { useStore, latestWeight } from '../store';
import { Icon, Sheet, useIsDesktop } from '../ui';
import { FocusBodyMap, focusBodyMapSvg } from '../components/Muscle';
import { focusToGroup } from '../data/subregions';
import {
  drawRecapCard,
  cardBlob,
  type RecapShareModel,
  type RecapShareFormat,
} from '../data/shareCard';
import { buildRecap, recapRefFromId, type Recap, type RecapRef, type RecapDelta } from '../recaps';
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
  return ref.kind === 'month'
    ? t.rcPeriodMonth
    : ref.kind === 'quarter'
      ? t.rcPeriodQuarter
      : t.rcPeriodYear;
}
function tonnes(kg: number): number {
  return Math.round(kg / 1000);
}
function kindLabel(ref: RecapRef, t: T): string {
  return ref.kind === 'month'
    ? t.rcKindMonth
    : ref.kind === 'quarter'
      ? t.rcKindQuarter
      : t.rcKindYear;
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

// ─── sharing ─────────────────────────────────────────────────────────────────
function recapShareModel(ref: RecapRef, r: Recap, t: T, locale: LocaleId): RecapShareModel {
  return {
    brand: 'Spotter',
    kicker: kindLabel(ref, t),
    period: periodTitle(ref, locale),
    headline: headlineLine(t, r, periodWord(ref, t)),
    stats: [
      { value: `${r.sessions}`, label: t.rcSessions },
      { value: `${tonnes(r.volumeKg)} t`, label: t.rcVolShort },
      { value: `${r.prCount}`, label: 'PRs' },
    ],
    record: r.records[0] ? { name: r.records[0].name, detail: fmtKg(r.records[0].weightKg) } : null,
    kcal: r.calories > 0 ? `${Math.round(r.calories).toLocaleString(locale)} ${t.rcKcal}` : null,
    muscles: r.muscles.slice(0, 3).map((m) => ({ name: muscleName(t, m.group), pct: m.pct })),
    bodyFrontSvg: focusBodyMapSvg(r.growMuscles, 'front'),
    bodyBackSvg: focusBodyMapSvg(r.growMuscles, 'back'),
    handle: 'spotter.app',
  };
}

/**
 * Recap share bottom sheet — mirrors the workout ShareSheet: a live canvas
 * preview, a story/square format toggle (portrait fits the muscle map), and
 * native-share / save / copy. Drawing is offline (data/shareCard). `entry`
 * is passed as an object so `ref` is never a React special prop.
 */
function RecapShareSheet({
  entry,
  onClose,
}: {
  entry: { ref: RecapRef; recap: Recap };
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const isDesktop = useIsDesktop();
  const { ref, recap: r } = entry;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<RecapShareFormat>(isDesktop ? 'square' : 'story');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const model = useMemo(() => recapShareModel(ref, r, t, locale), [ref, r, t, locale]);
  const fileName = `spotter-${ref.id}.png`;

  useEffect(() => {
    const cv = canvasRef.current;
    if (cv) void drawRecapCard(cv, model, format);
  }, [model, format]);

  async function withBlob(fn: (b: Blob) => void | Promise<void>): Promise<void> {
    const cv = canvasRef.current;
    if (!cv) return;
    setBusy(true);
    try {
      const b = await cardBlob(cv);
      if (b) await fn(b);
    } catch {
      /* user cancelled the share, or unsupported */
    } finally {
      setBusy(false);
    }
  }

  function download(b: Blob): void {
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function nativeShare(b: Blob): Promise<void> {
    const file = new File([b], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: periodTitle(ref, locale) });
    } else {
      download(b);
    }
  }

  async function copy(b: Blob): Promise<void> {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      download(b);
    }
  }

  return (
    <Sheet className="share-sheet" onClose={onClose}>
      <div className="share-head">
        <h3>{t.rcShareCard}</h3>
        <div className="share-format" role="tablist">
          <button className={format === 'story' ? 'on' : ''} onClick={() => setFormat('story')}>
            {t.shareFormatStory}
          </button>
          <button className={format === 'square' ? 'on' : ''} onClick={() => setFormat('square')}>
            {t.shareFormatSquare}
          </button>
        </div>
      </div>
      <div className={`share-preview ${format}`}>
        <canvas ref={canvasRef} className="share-canvas" />
      </div>
      <div className="share-actions">
        {isDesktop ? (
          <button
            className="btn btn-primary grow"
            disabled={busy}
            onClick={() => withBlob(download)}
          >
            <Icon name="download-simple" />
            {t.shareDownload}
          </button>
        ) : (
          <button
            className="btn btn-primary grow"
            disabled={busy}
            onClick={() => withBlob(nativeShare)}
          >
            <Icon name="export" />
            {t.shareToStories}
          </button>
        )}
        {!isDesktop && (
          <button
            className="btn btn-secondary share-icon-btn"
            disabled={busy}
            onClick={() => withBlob(download)}
            aria-label={t.shareSaveImage}
            title={t.shareSaveImage}
          >
            <Icon name="download-simple" />
          </button>
        )}
        <button
          className="btn btn-secondary share-icon-btn"
          disabled={busy}
          onClick={() => withBlob(copy)}
          aria-label={copied ? t.shareCopied : t.shareCopy}
          title={copied ? t.shareCopied : t.shareCopy}
        >
          <Icon name={copied ? 'check' : 'copy'} />
        </button>
      </div>
    </Sheet>
  );
}

// ─── small pieces ────────────────────────────────────────────────────────────
function Delta({ d, suffix }: { d: RecapDelta; suffix?: string }) {
  const { t } = useT();
  if (d == null) return <span className="rc-dn">{t.rcFirstPeriodDelta}</span>;
  const up = d >= 0;
  return (
    <span className="rc-delta">
      <Icon
        name={up ? 'caret-up' : 'caret-down'}
        weight="bold"
        className={up ? 'rc-up' : 'rc-dn'}
      />
      <span className={`rc-num ${up ? 'rc-up' : 'rc-dn'}`}>
        {up ? '+' : '−'}
        {Math.abs(Math.round(d * 100))}%
      </span>
      {suffix && <span style={{ color: 'var(--color-neutral-600)' }}>{suffix}</span>}
    </span>
  );
}

function StatRow({ r, t }: { r: Recap; t: T }) {
  return (
    <div className="rc-herostats3">
      <div>
        <div className="rc-num rc-hs-n" style={{ color: 'var(--color-accent-300)' }}>
          {r.sessions}
        </div>
        <div className="rc-lbl" style={{ marginTop: 5, color: 'var(--color-accent-300)' }}>
          {t.rcSessions}
        </div>
      </div>
      <div>
        <div className="rc-num rc-hs-n">
          {tonnes(r.volumeKg)}
          <span style={{ fontSize: 14 }}>t</span>
        </div>
        <div className="rc-lbl" style={{ marginTop: 5, color: 'var(--color-accent-300)' }}>
          {t.rcVolShort}
        </div>
      </div>
      <div>
        <div className="rc-num rc-hs-n">{r.prCount}</div>
        <div className="rc-lbl" style={{ marginTop: 5, color: 'var(--color-accent-300)' }}>
          PRs
        </div>
      </div>
    </div>
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
  const [shareOpen, setShareOpen] = useState(false);
  if (!data) return null;
  const { ref, recap: r } = data;
  const pw = periodWord(ref, t);
  const trendMax = Math.max(...r.trend.map((b) => b.value), 0.001);

  return (
    <div className={`screen rc-view${desktop ? ' desktop' : ''}`}>
      <div className="rc-topbar">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <h2 className="title-26" style={{ flex: 1, minWidth: 0 }}>
          {t.rcRecap}
        </h2>
        <button className="rc-icon-btn" onClick={onStory} aria-label={t.rcPlayStory}>
          <Icon name="cards" />
        </button>
        <button className="rc-icon-btn" onClick={() => setShareOpen(true)} aria-label={t.rcShare}>
          <Icon name="export" />
        </button>
      </div>

      <div className="rc-hero-band">
        <div className="rc-row-mid">
          <Icon
            name="barbell"
            weight="fill"
            style={{ color: 'var(--color-accent)', fontSize: 15 }}
          />
          <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>
            {kindLabel(ref, t)}
          </span>
        </div>
        <div style={{ fontSize: 34, letterSpacing: '-0.03em', marginTop: 12, lineHeight: 1.05 }}>
          {periodTitle(ref, locale)}
        </div>
        <div
          style={{ fontSize: 17, color: 'var(--color-accent-100)', marginTop: 14, lineHeight: 1.4 }}
        >
          {headlineLine(t, r, pw)}
        </div>
        <div
          style={{ fontSize: 13, color: 'var(--color-accent-300)', marginTop: 8, lineHeight: 1.5 }}
        >
          {t.rcShowedUp(r.sessions)}
        </div>
      </div>

      <div className="rc-body">
        {/* totals */}
        <div className={desktop ? 'rc-span2' : ''}>
          <div className="rc-lbl" style={{ marginBottom: 12 }}>
            {t.rcTheTotals}
          </div>
          <div className="rc-totals">
            <div className="rc-stat">
              <div className="rc-num rc-stat-n">{r.sessions}</div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>
                {t.rcSessions}
              </div>
              <Delta d={r.d.sessions} />
            </div>
            <div className="rc-stat">
              <div className="rc-num rc-stat-n">
                {tonnes(r.volumeKg)}
                <span style={{ fontSize: 17, color: 'var(--color-neutral-500)' }}> t</span>
              </div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>
                {t.rcVolume}
              </div>
              <Delta
                d={r.d.volume}
                suffix={`${Math.round(r.volumeKg).toLocaleString(locale)} kg`}
              />
            </div>
            <div className="rc-stat">
              <div className="rc-num rc-stat-n">
                {r.timeHours.toFixed(1)}
                <span style={{ fontSize: 17, color: 'var(--color-neutral-500)' }}> h</span>
              </div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>
                {t.rcTimeTrained}
              </div>
              <Delta d={r.d.time} />
            </div>
            <div className="rc-stat">
              <div className="rc-num rc-stat-n">{r.sets}</div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>
                {t.rcSetsReps(r.reps.toLocaleString(locale))}
              </div>
              <Delta d={r.d.sets} />
            </div>
          </div>
          <div className="rc-cal">
            <Icon name="flame" weight="fill" style={{ fontSize: 30, color: 'var(--color-kcal)' }} />
            <div style={{ flex: 1 }}>
              <div
                className="rc-num"
                style={{ fontSize: 28, letterSpacing: '-0.03em', color: 'var(--color-kcal-text)' }}
              >
                {Math.round(r.calories).toLocaleString(locale)}
                <span style={{ fontSize: 15 }}> {t.rcKcal}</span>
              </div>
              <div className="rc-lbl" style={{ marginTop: 4, color: '#6f93b3' }}>
                {t.rcCalBurn}
              </div>
            </div>
            <Delta d={r.d.calories} />
          </div>
        </div>

        {/* records */}
        {r.records.length > 0 && (
          <div className="rc-card gold">
            <div className="rc-row-mid">
              <Icon
                name="trophy"
                weight="fill"
                style={{ color: 'var(--color-accent)', fontSize: 16 }}
              />
              <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>
                {t.rcNewRecords}
              </span>
              <span style={{ flex: 1 }} />
              <span className="rc-num" style={{ fontSize: 22, color: 'var(--color-accent-300)' }}>
                {r.prCount}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
              {r.records.slice(0, 3).map((rec) => (
                <div className="rc-rec-row" key={rec.name}>
                  <Icon
                    name="medal"
                    weight="fill"
                    style={{ color: 'var(--color-accent)', fontSize: 18 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{rec.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-accent-300)' }}>
                      {t.rcEst1rm(fmtKg(rec.e1rm))}
                    </div>
                  </div>
                  <div
                    className="rc-num"
                    style={{ fontSize: 19, color: 'var(--color-accent-100)' }}
                  >
                    {fmtKg(rec.weightKg)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              {r.heaviestSet && (
                <div className="rc-mini">
                  <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>
                    {t.rcHeaviestSet}
                  </span>
                  <div style={{ fontSize: 14, marginTop: 5 }}>{r.heaviestSet.name}</div>
                  <div
                    className="rc-num"
                    style={{ fontSize: 13, color: 'var(--color-accent-100)' }}
                  >
                    {t.rcSetWxR(fmtKg(r.heaviestSet.weightKg), r.heaviestSet.reps)}
                  </div>
                </div>
              )}
              {r.biggestSession && (
                <div className="rc-mini">
                  <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>
                    {t.rcBiggestSession}
                  </span>
                  <div style={{ fontSize: 14, marginTop: 5 }}>
                    {new Date(r.biggestSession.ts).toLocaleDateString(locale, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                  <div
                    className="rc-num"
                    style={{ fontSize: 13, color: 'var(--color-accent-100)' }}
                  >
                    {t.rcTMoved(
                      `${tonnes(r.biggestSession.volumeKg) || (r.biggestSession.volumeKg / 1000).toFixed(1)} t`,
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* muscle distribution */}
        {r.muscles.length > 0 && (
          <div className="rc-card">
            <div className="rc-lbl" style={{ marginBottom: 6 }}>
              {t.rcMuscleDist}
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: 'none', width: 132 }}>
                <FocusBodyMap grow={r.growMuscles} ease={[]} view="both" width={132} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {r.muscles.slice(0, 4).map((m) => (
                  <div key={m.group}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        marginBottom: 5,
                      }}
                    >
                      <span>{muscleName(t, m.group)}</span>
                      <span className="rc-num" style={{ color: 'var(--color-neutral-500)' }}>
                        {m.pct}%
                      </span>
                    </div>
                    <div className="rc-rank">
                      <i
                        style={{ width: `${Math.min(100, (m.sets / r.muscles[0].sets) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {r.leastMuscle && (
              <div className="rc-hint">
                <Icon
                  name="info"
                  weight="bold"
                  style={{ fontSize: 14, color: 'var(--color-neutral-500)', marginTop: 1 }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-neutral-500)',
                    lineHeight: 1.5,
                    flex: 1,
                  }}
                >
                  {t.rcLeastHint(muscleName(t, r.leastMuscle))}
                </span>
              </div>
            )}
          </div>
        )}

        {/* consistency */}
        <div className="rc-card">
          <div className="rc-lbl" style={{ marginBottom: 12 }}>
            {t.rcConsistency}
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div className="rc-num" style={{ fontSize: 26 }}>
                {r.trainingDays}
              </div>
              <div className="rc-lbl" style={{ marginTop: 4 }}>
                {t.rcTrainingDays}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="rc-num" style={{ fontSize: 26, color: 'var(--color-accent-300)' }}>
                {r.longestStreak}
              </div>
              <div className="rc-lbl" style={{ marginTop: 4 }}>
                {t.rcLongestStreak}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="rc-num" style={{ fontSize: 26 }}>
                {r.perfectWeeks}
                <span style={{ fontSize: 15, color: 'var(--color-neutral-500)' }}>
                  /{r.weeksInPeriod}
                </span>
              </div>
              <div className="rc-lbl" style={{ marginTop: 4 }}>
                {t.rcPerfectWeeks}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                >
                  <span className={`rc-dot7${r.weekdayMask[i] ? ' on' : ''}`} />
                  <span style={{ fontSize: 9, color: 'var(--color-neutral-600)' }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* trend */}
        <div className="rc-card">
          <div className="rc-row-mid">
            <span className="rc-lbl" style={{ flex: 1 }}>
              {ref.kind === 'month' ? t.rcVolTrendWeek : t.rcVolTrendMonth}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{t.rcTonnes}</span>
          </div>
          <div className="rc-trendbars">
            {r.trend.map((b, i) => (
              <div key={i} className={`rc-bar${b.peak ? ' peak' : ''}`}>
                <span style={{ height: `${Math.max(6, (b.value / trendMax) * 100)}%` }} />
                <small style={b.peak ? { color: 'var(--color-accent-300)' } : undefined}>
                  {b.label ??
                    new Date(ref.year, b.month ?? 0, 1).toLocaleDateString(locale, {
                      month: 'short',
                    })}
                </small>
              </div>
            ))}
          </div>
        </div>

        {/* goals */}
        {r.goal && (
          <div className="rc-card">
            <div className="rc-lbl" style={{ marginBottom: 12 }}>
              {t.rcTowardGoal}
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div
                className="rc-ring"
                style={{
                  background: `conic-gradient(var(--color-accent) 0 ${r.goal.adherencePct}%, var(--color-neutral-900) ${r.goal.adherencePct}% 100%)`,
                }}
              >
                <span>
                  <span className="rc-num" style={{ fontSize: 19 }}>
                    {r.goal.adherencePct}
                    <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>%</span>
                  </span>
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>
                  {r.goal.archetype
                    ? `${t.archetypes[r.goal.archetype]?.name ?? r.goal.archetype} · ${t.rcBlockFocusSuffix}`
                    : t.rcBlockFocusSuffix}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {r.goal.hits.slice(0, 5).map((h) => (
                    <span key={h.muscle} className={`rc-chip${h.ok ? ' gold' : ''}`}>
                      {focusName(t, h.muscle)}
                      {h.ok ? ' ✓' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* activities */}
        {(r.recoveryMin > 0 || r.conditioningMin > 0) && (
          <div className="rc-card">
            <div className="rc-lbl" style={{ marginBottom: 12 }}>
              {t.rcAlongside}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon
                  name="heartbeat"
                  weight="bold"
                  style={{ fontSize: 18, color: 'var(--color-neutral-400)' }}
                />
                <div>
                  <div style={{ fontSize: 15 }}>
                    {r.recoveryMin}
                    <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                      {' '}
                      {t.rcMinShort}
                    </span>
                  </div>
                  <div className="rc-lbl" style={{ marginTop: 3 }}>
                    {t.rcRecovery}
                  </div>
                </div>
              </div>
              <div style={{ width: 1, background: 'var(--color-divider)' }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon
                  name="wind"
                  weight="bold"
                  style={{ fontSize: 18, color: 'var(--color-neutral-400)' }}
                />
                <div>
                  <div style={{ fontSize: 15 }}>
                    {r.conditioningMin}
                    <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                      {' '}
                      {t.rcMinShort}
                    </span>
                  </div>
                  <div className="rc-lbl" style={{ marginTop: 3 }}>
                    {t.rcConditioning}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* close / share */}
        <div className="rc-card gold" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 16,
              color: 'var(--color-accent-100)',
              lineHeight: 1.45,
              maxWidth: '28ch',
              margin: '0 auto',
            }}
          >
            {headlineLine(t, r, pw)}
          </div>
          <button
            className="btn btn-primary rc-btn-block"
            style={{ marginTop: 16 }}
            onClick={() => setShareOpen(true)}
          >
            <Icon name="export" />
            {t.rcShareYours(periodShort(ref, locale))}
          </button>
          <button className="rc-textbtn" onClick={onStory}>
            {t.rcWatchSave}
          </button>
        </div>
      </div>
      {shareOpen && <RecapShareSheet entry={data} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

// ═══ PAGED, AUTO-ADVANCING STORY ═════════════════════════════════════════════
const STORY_MS = 5200;

export function RecapStory({ period, onClose }: { period: string; onClose: () => void }) {
  const { t, locale } = useT();
  const data = useRecap(period);
  const [i, setI] = useState(0);
  const [prog, setProg] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const paused = useRef(false);
  const shareRef = useRef(false);
  const openShare = useCallback(() => {
    shareRef.current = true;
    setShareOpen(true);
  }, []);
  const closeShare = useCallback(() => {
    shareRef.current = false;
    setShareOpen(false);
  }, []);

  const panels = useMemo(() => {
    if (!data) return [] as { bg: 'replay' | 'cool'; body: ReactNode }[];
    const { ref, recap: r } = data;
    const pw = periodWord(ref, t);
    const list: { bg: 'replay' | 'cool'; body: ReactNode }[] = [];

    list.push({
      bg: 'replay',
      body: (
        <div className="rc-story-center">
          <div className="rc-row-mid">
            <Icon
              name="barbell"
              weight="fill"
              style={{ color: 'var(--color-accent)', fontSize: 16 }}
            />
            <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>
              {t.rcWrapped(periodShort(ref, locale))}
            </span>
          </div>
          <div style={{ fontSize: 48, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 18 }}>
            {periodTitle(ref, locale)}
          </div>
          <div
            style={{
              fontSize: 19,
              color: 'var(--color-accent-100)',
              marginTop: 20,
              lineHeight: 1.4,
              maxWidth: '24ch',
            }}
          >
            {headlineLine(t, r, pw)}
          </div>
        </div>
      ),
    });

    list.push({
      bg: 'cool',
      body: (
        <div className="rc-story-center">
          <span className="rc-lbl" style={{ marginBottom: 14 }}>
            {t.rcYouMovedIn(periodShort(ref, locale))}
          </span>
          <div
            className="rc-num"
            style={{
              fontSize: 76,
              letterSpacing: '-0.04em',
              lineHeight: 0.9,
              color: 'var(--color-accent-300)',
            }}
          >
            {tonnes(r.volumeKg)}
            <span style={{ fontSize: 30, color: 'var(--color-accent-300)' }}> t</span>
          </div>
          <div style={{ fontSize: 15, color: 'var(--color-neutral-400)', marginTop: 6 }}>
            {t.rcAcrossSets(`${Math.round(r.volumeKg).toLocaleString(locale)} kg`, r.sets)}
          </div>
          <div style={{ display: 'flex', gap: 26, marginTop: 34 }}>
            <div>
              <div className="rc-num" style={{ fontSize: 30 }}>
                {r.sessions}
              </div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>
                {t.rcSessions}
              </div>
            </div>
            <div>
              <div className="rc-num" style={{ fontSize: 30 }}>
                {r.timeHours.toFixed(1)}
                <span style={{ fontSize: 14, color: 'var(--color-neutral-500)' }}>h</span>
              </div>
              <div className="rc-lbl" style={{ marginTop: 5 }}>
                {t.rcTrained}
              </div>
            </div>
            <div>
              <div className="rc-num" style={{ fontSize: 30, color: 'var(--color-kcal-text)' }}>
                {(r.calories / 1000).toFixed(1)}
                <span style={{ fontSize: 14 }}>k</span>
              </div>
              <div className="rc-lbl rc-row-mid" style={{ marginTop: 5, gap: 4 }}>
                <Icon name="flame" weight="fill" style={{ color: 'var(--color-kcal)' }} />
                {t.rcKcal}
              </div>
            </div>
          </div>
        </div>
      ),
    });

    if (r.records.length > 0) {
      list.push({
        bg: 'replay',
        body: (
          <div className="rc-story-center">
            <Icon
              name="trophy"
              weight="fill"
              style={{ fontSize: 40, color: 'var(--color-accent)' }}
            />
            <div style={{ fontSize: 32, letterSpacing: '-0.02em', marginTop: 16, lineHeight: 1.1 }}>
              {t.rcYouSetRecords(r.prCount)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 26 }}>
              {r.records.slice(0, 3).map((rec, n) => (
                <div key={rec.name} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <span
                    className="rc-num"
                    style={{ fontSize: 15, color: 'var(--color-accent-300)', width: 20 }}
                  >
                    {String(n + 1).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 17, color: 'var(--color-accent-100)' }}>{rec.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-accent-300)' }}>
                      {t.rcEst1rm(fmtKg(rec.e1rm))}
                    </div>
                  </div>
                  <div
                    className="rc-num"
                    style={{ fontSize: 24, color: 'var(--color-accent-300)' }}
                  >
                    {fmtKg(rec.weightKg)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      });
    }

    if (r.muscles.length > 0) {
      list.push({
        bg: 'cool',
        body: (
          <div className="rc-story-panel-pad">
            <span className="rc-lbl">{t.rcWhereWork}</span>
            <div style={{ fontSize: 26, letterSpacing: '-0.02em', marginTop: 10 }}>
              {t.rcMuscleLed(
                muscleName(t, r.muscles[0].group),
                muscleName(t, r.muscles[1]?.group ?? r.muscles[0].group),
              )}
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 0',
              }}
            >
              <div style={{ width: 200 }}>
                <FocusBodyMap grow={r.growMuscles} ease={[]} view="both" width={200} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
              {r.muscles.slice(0, 3).map((m) => (
                <div key={m.group} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, width: 90 }}>{muscleName(t, m.group)}</span>
                  <div className="rc-rank">
                    <i style={{ width: `${Math.min(100, (m.sets / r.muscles[0].sets) * 100)}%` }} />
                  </div>
                  <span
                    className="rc-num"
                    style={{
                      fontSize: 12,
                      color: 'var(--color-neutral-500)',
                      width: 34,
                      textAlign: 'right',
                    }}
                  >
                    {m.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ),
      });
    }

    // closing = the share card (brand · period · headline · stats · map · record · share)
    list.push({
      bg: 'replay',
      body: (
        <div className="rc-story-panel-pad">
          <div className="rc-row-mid">
            <span className="app-brand-word">spotter</span>
          </div>
          <div style={{ fontSize: 30, letterSpacing: '-0.02em', marginTop: 18, lineHeight: 1.1 }}>
            {periodTitle(ref, locale)}
          </div>
          <div
            style={{
              fontSize: 15,
              color: 'var(--color-accent-100)',
              marginTop: 8,
              maxWidth: '26ch',
            }}
          >
            {headlineLine(t, r, pw)}
          </div>
          <div style={{ marginTop: 18 }}>
            <StatRow r={r} t={t} />
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 0,
              marginTop: 6,
            }}
          >
            <div style={{ width: 220 }}>
              <FocusBodyMap grow={r.growMuscles} ease={[]} view="both" width={220} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {r.muscles.slice(0, 3).map((m) => (
              <div key={m.group} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, width: 96 }}>{muscleName(t, m.group)}</span>
                <div className="rc-rank">
                  <i style={{ width: `${Math.min(100, (m.sets / r.muscles[0].sets) * 100)}%` }} />
                </div>
                <span
                  className="rc-num"
                  style={{
                    fontSize: 12,
                    color: 'var(--color-neutral-500)',
                    width: 40,
                    textAlign: 'right',
                  }}
                >
                  {m.pct}%
                </span>
              </div>
            ))}
          </div>
          {r.records[0] && (
            <div className="rc-rec-row" style={{ marginBottom: 10 }}>
              <Icon
                name="medal"
                weight="fill"
                style={{ color: 'var(--color-accent)', fontSize: 18 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>
                  {t.rcTopRecord}
                </span>
                <div style={{ fontSize: 14, marginTop: 3 }}>{r.records[0].name}</div>
              </div>
              <div className="rc-num" style={{ fontSize: 20, color: 'var(--color-accent-100)' }}>
                {fmtKg(r.records[0].weightKg)}
              </div>
            </div>
          )}
          <button
            className="btn btn-primary rc-btn-block"
            onClick={(e) => {
              e.stopPropagation();
              openShare();
            }}
          >
            <Icon name="export" />
            {t.rcShareCard}
          </button>
        </div>
      ),
    });

    return list;
  }, [data, t, locale, openShare]);

  const n = panels.length;
  const advance = useCallback(() => {
    setI((v) => {
      if (v + 1 >= n) {
        onClose();
        return v;
      }
      return v + 1;
    });
  }, [n, onClose]);

  // Auto-advancing timed progress (Instagram/Spotify style). Pauses on hold.
  // All setState happens inside the rAF callback (async), never synchronously
  // in the effect body.
  useEffect(() => {
    // The last panel is the share/CTA card — it holds instead of auto-closing,
    // so the user can tap Share. Only the earlier panels run the timer.
    if (i >= n - 1) return;
    const start = performance.now();
    let lastTs = start;
    let pausedFor = 0;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      if (paused.current || shareRef.current) pausedFor += now - lastTs;
      lastTs = now;
      const p = Math.min(1, (now - start - pausedFor) / STORY_MS);
      setProg(p);
      if (p >= 1) {
        advance();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, n, advance]);

  if (!data || n === 0) return null;

  return (
    <div
      className="rc-story"
      style={{ background: panels[i].bg === 'replay' ? 'var(--rc-replay)' : 'var(--rc-wash-cool)' }}
      onPointerDown={() => {
        paused.current = true;
      }}
      onPointerUp={() => {
        paused.current = false;
      }}
      onPointerLeave={() => {
        paused.current = false;
      }}
    >
      <div className="rc-progress">
        {panels.map((_, k) => (
          <i key={k}>
            <b
              style={{
                width:
                  k < i || (k === i && i === n - 1) ? '100%' : k === i ? `${prog * 100}%` : '0%',
              }}
            />
          </i>
        ))}
      </div>
      <div
        className="rc-story-panel"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (e.clientX - rect.left < rect.width * 0.33) setI((v) => Math.max(0, v - 1));
          else advance();
        }}
      >
        {panels[i].body}
      </div>
      <button className="rc-icon-btn rc-story-close" onClick={onClose} aria-label={t.backAction}>
        <Icon name="x" weight="bold" />
      </button>
      {shareOpen && <RecapShareSheet entry={data} onClose={closeShare} />}
    </div>
  );
}
