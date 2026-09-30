/**
 * Recap views (design "My Fit — Recaps"). RecapView is the scrolling read view;
 * RecapStory is the paged, auto-advancing "play" story; both read one Recap
 * built from the live store for a period id. Sharing draws a portrait card on a
 * canvas (data/shareCard) and hands it to the native share sheet.
 */
import { BackButton } from '../components/ui/BackButton';
import { weekOrder } from '../weekStart';
import { Button, IconButton } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT, fmtKg, type LocaleId } from '../i18n';
import { useStore, latestWeight } from '../store';
import { Icon, Sheet, useIsDesktop, useExerciseName } from '../ui';
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
import { Tag } from '../components/ui/Tag';

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
        <Segmented
          tabs
          className="share-format"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'story', label: t.shareFormatStory },
            { value: 'square', label: t.shareFormatSquare },
          ]}
        />
      </div>
      <div className={`share-preview ${format}`}>
        <canvas ref={canvasRef} className="share-canvas" />
      </div>
      <div className="share-actions">
        {isDesktop ? (
          <Button
            variant="primary"
            className="grow"
            disabled={busy}
            onClick={() => withBlob(download)}
          >
            <Icon name="download-simple" />
            {t.shareDownload}
          </Button>
        ) : (
          <Button
            variant="primary"
            className="grow"
            disabled={busy}
            onClick={() => withBlob(nativeShare)}
          >
            <Icon name="export" />
            {t.shareToStories}
          </Button>
        )}
        {!isDesktop && (
          <Button
            variant="secondary"
            className="share-icon-btn"
            disabled={busy}
            onClick={() => withBlob(download)}
            aria-label={t.shareSaveImage}
            title={t.shareSaveImage}
          >
            <Icon name="download-simple" />
          </Button>
        )}
        <Button
          variant="secondary"
          className="share-icon-btn"
          disabled={busy}
          onClick={() => withBlob(copy)}
          aria-label={copied ? t.shareCopied : t.shareCopy}
          title={copied ? t.shareCopied : t.shareCopy}
        >
          <Icon name={copied ? 'check' : 'copy'} />
        </Button>
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
      {suffix && <span className="rc-c-neutral-600">{suffix}</span>}
    </span>
  );
}

function StatRow({ r, t }: { r: Recap; t: T }) {
  return (
    <div className="rc-herostats3">
      <div>
        <div className="rc-num rc-hs-n ut-accent-lo">{r.sessions}</div>
        <div className="rc-lbl ut-accent-lo umt-6">{t.rcSessions}</div>
      </div>
      <div>
        <div className="rc-num rc-hs-n">
          {tonnes(r.volumeKg)}
          <span className="ut-md">t</span>
        </div>
        <div className="rc-lbl ut-accent-lo umt-6">{t.rcVolShort}</div>
      </div>
      <div>
        <div className="rc-num rc-hs-n">{r.prCount}</div>
        <div className="rc-lbl ut-accent-lo umt-6">PRs</div>
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
  const exName = useExerciseName();
  const data = useRecap(period);
  const [shareOpen, setShareOpen] = useState(false);
  if (!data) return null;
  const { ref, recap: r } = data;
  const pw = periodWord(ref, t);
  const trendMax = Math.max(...r.trend.map((b) => b.value), 0.001);

  return (
    <div className={`screen rc-view${desktop ? ' desktop' : ''}`}>
      <div className="rc-topbar">
        <BackButton onClick={onClose} label={t.backAction} />
        <h2 className="title-26 uf-1 umw-0">{t.rcRecap}</h2>
        <IconButton icon="cards" label={t.rcPlayStory} onClick={onStory} />
        <IconButton icon="export" label={t.rcShare} onClick={() => setShareOpen(true)} />
      </div>

      <div className="rc-hero-band">
        <div className="rc-row-mid">
          <Icon name="barbell" weight="fill" className="ut-accent ut-lg" />
          <span className="rc-lbl ut-accent-lo">{kindLabel(ref, t)}</span>
        </div>
        <div className="rc-fs-34 ut-tighter umt-12" style={{ lineHeight: 1.05 }}>
          {periodTitle(ref, locale)}
        </div>
        <div className="ut-xl ut-accent-hi umt-14" style={{ lineHeight: 1.4 }}>
          {headlineLine(t, r, pw)}
        </div>
        <div className="ut-base ut-accent-lo umt-8" style={{ lineHeight: 1.5 }}>
          {t.rcShowedUp(r.sessions)}
        </div>
      </div>

      <div className="rc-body">
        {/* totals */}
        <div className={desktop ? 'rc-span2' : ''}>
          <div className="rc-lbl umb-12">{t.rcTheTotals}</div>
          <div className="rc-totals">
            <div className="rc-stat">
              <div className="rc-num rc-stat-n">{r.sessions}</div>
              <div className="rc-lbl umt-6">{t.rcSessions}</div>
              <Delta d={r.d.sessions} />
            </div>
            <div className="rc-stat">
              <div className="rc-num rc-stat-n">
                {tonnes(r.volumeKg)}
                <span className="ut-xl ut-dim"> t</span>
              </div>
              <div className="rc-lbl umt-6">{t.rcVolume}</div>
              <Delta
                d={r.d.volume}
                suffix={`${Math.round(r.volumeKg).toLocaleString(locale)} kg`}
              />
            </div>
            <div className="rc-stat">
              <div className="rc-num rc-stat-n">
                {r.timeHours.toFixed(1)}
                <span className="ut-xl ut-dim"> h</span>
              </div>
              <div className="rc-lbl umt-6">{t.rcTimeTrained}</div>
              <Delta d={r.d.time} />
            </div>
            <div className="rc-stat">
              <div className="rc-num rc-stat-n">{r.sets}</div>
              <div className="rc-lbl umt-6">{t.rcSetsReps(r.reps.toLocaleString(locale))}</div>
              <Delta d={r.d.sets} />
            </div>
          </div>
          <div className="rc-cal">
            <Icon name="flame" weight="fill" className="ut-hero rc-c-kcal" />
            <div className="uf-1">
              <div className="rc-num rc-fs-28 ut-tighter rc-c-kcal-text">
                {Math.round(r.calories).toLocaleString(locale)}
                <span className="ut-lg"> {t.rcKcal}</span>
              </div>
              <div className="rc-lbl rc-c-lbl-kcal umt-4">{t.rcCalBurn}</div>
            </div>
            <Delta d={r.d.calories} />
          </div>
        </div>

        {/* records */}
        {r.records.length > 0 && (
          <div className="rc-card gold">
            <div className="rc-row-mid">
              <Icon name="trophy" weight="fill" className="ut-accent ut-lg" />
              <span className="rc-lbl ut-accent-lo">{t.rcNewRecords}</span>
              <span className="uf-1" />
              <span className="rc-num rc-fs-22 ut-accent-lo">{r.prCount}</span>
            </div>
            <div className="ul-flex ul-col ug-10 umt-14">
              {r.records.slice(0, 3).map((rec) => (
                <div className="rc-rec-row" key={rec.name}>
                  <Icon name="medal" weight="fill" className="ut-accent ut-xl" />
                  <div className="uf-1 umw-0">
                    <div className="ut-md">{exName(rec.name)}</div>
                    <div className="ut-xs ut-accent-lo">{t.rcEst1rm(fmtKg(rec.e1rm))}</div>
                  </div>
                  <div className="rc-num ut-2xl ut-accent-hi">{fmtKg(rec.weightKg)}</div>
                </div>
              ))}
            </div>
            <div className="ul-flex ug-10 umt-14">
              {r.heaviestSet && (
                <div className="rc-mini">
                  <span className="rc-lbl ut-accent-lo">{t.rcHeaviestSet}</span>
                  <div className="ut-md umt-6">{r.heaviestSet.name}</div>
                  <div className="rc-num ut-base ut-accent-hi">
                    {t.rcSetWxR(fmtKg(r.heaviestSet.weightKg), r.heaviestSet.reps)}
                  </div>
                </div>
              )}
              {r.biggestSession && (
                <div className="rc-mini">
                  <span className="rc-lbl ut-accent-lo">{t.rcBiggestSession}</span>
                  <div className="ut-md umt-6">
                    {new Date(r.biggestSession.ts).toLocaleDateString(locale, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                  <div className="rc-num ut-base ut-accent-hi">
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
            <div className="rc-lbl umb-6">{t.rcMuscleDist}</div>
            <div className="ul-flex ug-16 ua-center">
              <div className="uf-none" style={{ width: 132 }}>
                <FocusBodyMap grow={r.growMuscles} ease={[]} view="both" width={132} />
              </div>
              <div className="uf-1 ul-flex ul-col ug-12">
                {r.muscles.slice(0, 4).map((m) => (
                  <div key={m.group}>
                    <div className="ut-sm ul-flex uj-between umb-6">
                      <span>{muscleName(t, m.group)}</span>
                      <span className="rc-num ut-dim">{m.pct}%</span>
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
                <Icon name="info" weight="bold" className="ut-md ut-dim" style={{ marginTop: 1 }} />
                <span className="ut-xs ut-dim uf-1" style={{ lineHeight: 1.5 }}>
                  {t.rcLeastHint(muscleName(t, r.leastMuscle))}
                </span>
              </div>
            )}
          </div>
        )}

        {/* consistency */}
        <div className="rc-card">
          <div className="rc-lbl umb-12">{t.rcConsistency}</div>
          <div className="ul-flex ug-14">
            <div className="uf-1">
              <div className="rc-num ut-3xl">{r.trainingDays}</div>
              <div className="rc-lbl umt-4">{t.rcTrainingDays}</div>
            </div>
            <div className="uf-1">
              <div className="rc-num ut-3xl ut-accent-lo">{r.longestStreak}</div>
              <div className="rc-lbl umt-4">{t.rcLongestStreak}</div>
            </div>
            <div className="uf-1">
              <div className="rc-num ut-3xl">
                {r.perfectWeeks}
                <span className="ut-lg ut-dim">/{r.weeksInPeriod}</span>
              </div>
              <div className="rc-lbl umt-4">{t.rcPerfectWeeks}</div>
            </div>
          </div>
          <div className="umt-16">
            <div className="ul-flex uj-between ua-center">
              {weekOrder().map((d) => (
                <div key={d} className="ul-flex ul-col ua-center ug-6">
                  <span className={`rc-dot7${r.weekdayMask[d - 1] ? ' on' : ''}`} />
                  <span className="ut-2xs rc-c-neutral-600">
                    {(t.weekDayNames[d - 1] ?? '').slice(0, 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* trend */}
        <div className="rc-card">
          <div className="rc-row-mid">
            <span className="rc-lbl uf-1">
              {ref.kind === 'month' ? t.rcVolTrendWeek : t.rcVolTrendMonth}
            </span>
            <span className="ut-xs ut-dim">{t.rcTonnes}</span>
          </div>
          <div className="rc-trendbars">
            {r.trend.map((b, i) => (
              <div key={i} className={`rc-bar${b.peak ? ' peak' : ''}`}>
                <span style={{ height: `${Math.max(6, (b.value / trendMax) * 100)}%` }} />
                <small className={b.peak ? 'ut-accent-lo' : undefined}>
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
            <div className="rc-lbl umb-12">{t.rcTowardGoal}</div>
            <div className="ul-flex ug-14 ua-center">
              <div
                className="rc-ring"
                style={{
                  background: `conic-gradient(var(--color-accent) 0 ${r.goal.adherencePct}%, var(--color-neutral-900) ${r.goal.adherencePct}% 100%)`,
                }}
              >
                <span>
                  <span className="rc-num ut-2xl">
                    {r.goal.adherencePct}
                    <span className="ut-xs ut-dim">%</span>
                  </span>
                </span>
              </div>
              <div className="uf-1">
                <div className="ut-md">
                  {r.goal.archetype
                    ? `${t.archetypes[r.goal.archetype]?.name ?? r.goal.archetype} · ${t.rcBlockFocusSuffix}`
                    : t.rcBlockFocusSuffix}
                </div>
                <div className="ul-flex ul-wrap ug-6 umt-12">
                  {r.goal.hits.slice(0, 5).map((h) => (
                    <Tag key={h.muscle} tone={h.ok ? 'accent' : 'neutral'}>
                      {focusName(t, h.muscle)}
                      {h.ok ? ' ✓' : ''}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* activities */}
        {(r.recoveryMin > 0 || r.conditioningMin > 0) && (
          <div className="rc-card">
            <div className="rc-lbl umb-12">{t.rcAlongside}</div>
            <div className="ul-flex ug-12">
              <div className="uf-1 ul-flex ua-center ug-10">
                <Icon name="heartbeat" weight="bold" className="ut-xl rc-c-neutral-400" />
                <div>
                  <div className="ut-lg">
                    {r.recoveryMin}
                    <span className="ut-xs ut-dim"> {t.rcMinShort}</span>
                  </div>
                  <div className="rc-lbl umt-4">{t.rcRecovery}</div>
                </div>
              </div>
              <div className="rc-bg-divider" style={{ width: 1 }} />
              <div className="uf-1 ul-flex ua-center ug-10">
                <Icon name="wind" weight="bold" className="ut-xl rc-c-neutral-400" />
                <div>
                  <div className="ut-lg">
                    {r.conditioningMin}
                    <span className="ut-xs ut-dim"> {t.rcMinShort}</span>
                  </div>
                  <div className="rc-lbl umt-4">{t.rcConditioning}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* close / share */}
        <div className="rc-card gold utx-center">
          <div
            className="ut-lg ut-accent-hi"
            style={{ lineHeight: 1.45, maxWidth: '28ch', margin: '0 auto' }}
          >
            {headlineLine(t, r, pw)}
          </div>
          <Button
            variant="primary"
            className="rc-btn-block umt-16"

            onClick={() => setShareOpen(true)}
          >
            <Icon name="export" />
            {t.rcShareYours(periodShort(ref, locale))}
          </Button>
          <Button variant="link" onClick={onStory}>
            {t.rcWatchSave}
          </Button>
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
  const exName = useExerciseName();
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
            <Icon name="barbell" weight="fill" className="ut-accent ut-lg" />
            <span className="rc-lbl ut-accent-lo">{t.rcWrapped(periodShort(ref, locale))}</span>
          </div>
          <div className="rc-fs-48 ut-tighter umt-18" style={{ lineHeight: 1 }}>
            {periodTitle(ref, locale)}
          </div>
          <div className="ut-2xl ut-accent-hi umt-20" style={{ lineHeight: 1.4, maxWidth: '24ch' }}>
            {headlineLine(t, r, pw)}
          </div>
        </div>
      ),
    });

    list.push({
      bg: 'cool',
      body: (
        <div className="rc-story-center">
          <span className="rc-lbl umb-14">{t.rcYouMovedIn(periodShort(ref, locale))}</span>
          <div className="rc-num rc-fs-76 rc-ls-n004 ut-accent-lo" style={{ lineHeight: 0.9 }}>
            {tonnes(r.volumeKg)}
            <span className="ut-hero ut-accent-lo"> t</span>
          </div>
          <div className="ut-lg rc-c-neutral-400 umt-6">
            {t.rcAcrossSets(`${Math.round(r.volumeKg).toLocaleString(locale)} kg`, r.sets)}
          </div>
          <div className="ul-flex ug-28 umt-36">
            <div>
              <div className="rc-num ut-hero">{r.sessions}</div>
              <div className="rc-lbl umt-6">{t.rcSessions}</div>
            </div>
            <div>
              <div className="rc-num ut-hero">
                {r.timeHours.toFixed(1)}
                <span className="ut-md ut-dim">h</span>
              </div>
              <div className="rc-lbl umt-6">{t.rcTrained}</div>
            </div>
            <div>
              <div className="rc-num ut-hero rc-c-kcal-text">
                {(r.calories / 1000).toFixed(1)}
                <span className="ut-md">k</span>
              </div>
              <div className="rc-lbl rc-row-mid umt-6 ug-4">
                <Icon name="flame" weight="fill" className="rc-c-kcal" />
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
            <Icon name="trophy" weight="fill" className="ut-display ut-accent" />
            <div className="rc-fs-32 ut-tight umt-16" style={{ lineHeight: 1.1 }}>
              {t.rcYouSetRecords(r.prCount)}
            </div>
            <div className="ul-flex ul-col ug-12 umt-28">
              {r.records.slice(0, 3).map((rec, n) => (
                <div key={rec.name} className="ul-flex ua-center ug-14">
                  <span className="rc-num ut-lg ut-accent-lo" style={{ width: 20 }}>
                    {String(n + 1).padStart(2, '0')}
                  </span>
                  <div className="uf-1">
                    <div className="ut-xl ut-accent-hi">{exName(rec.name)}</div>
                    <div className="ut-sm ut-accent-lo">{t.rcEst1rm(fmtKg(rec.e1rm))}</div>
                  </div>
                  <div className="rc-num rc-fs-24 ut-accent-lo">{fmtKg(rec.weightKg)}</div>
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
            <div className="ut-3xl ut-tight umt-10">
              {t.rcMuscleLed(
                muscleName(t, r.muscles[0].group),
                muscleName(t, r.muscles[1]?.group ?? r.muscles[0].group),
              )}
            </div>
            <div className="uf-1 ul-flex ua-center uj-center" style={{ padding: '8px 0' }}>
              <div style={{ width: 200 }}>
                <FocusBodyMap grow={r.growMuscles} ease={[]} view="both" width={200} />
              </div>
            </div>
            <div className="ul-flex ul-col ug-10" style={{ paddingBottom: 20 }}>
              {r.muscles.slice(0, 3).map((m) => (
                <div key={m.group} className="ul-flex ua-center ug-12">
                  <span className="ut-md" style={{ width: 90 }}>
                    {muscleName(t, m.group)}
                  </span>
                  <div className="rc-rank">
                    <i style={{ width: `${Math.min(100, (m.sets / r.muscles[0].sets) * 100)}%` }} />
                  </div>
                  <span className="rc-num ut-sm ut-dim utx-right" style={{ width: 34 }}>
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
          <div className="ut-hero ut-tight umt-18" style={{ lineHeight: 1.1 }}>
            {periodTitle(ref, locale)}
          </div>
          <div className="ut-lg ut-accent-hi umt-8" style={{ maxWidth: '26ch' }}>
            {headlineLine(t, r, pw)}
          </div>
          <div className="umt-18">
            <StatRow r={r} t={t} />
          </div>
          <div className="uf-1 ul-flex ua-center uj-center umt-6" style={{ minHeight: 0 }}>
            <div style={{ width: 220 }}>
              <FocusBodyMap grow={r.growMuscles} ease={[]} view="both" width={220} />
            </div>
          </div>
          <div className="ul-flex ul-col ug-10 umb-14">
            {r.muscles.slice(0, 3).map((m) => (
              <div key={m.group} className="ul-flex ua-center ug-12">
                <span className="ut-md" style={{ width: 96 }}>
                  {muscleName(t, m.group)}
                </span>
                <div className="rc-rank">
                  <i style={{ width: `${Math.min(100, (m.sets / r.muscles[0].sets) * 100)}%` }} />
                </div>
                <span className="rc-num ut-sm ut-dim utx-right" style={{ width: 40 }}>
                  {m.pct}%
                </span>
              </div>
            ))}
          </div>
          {r.records[0] && (
            <div className="rc-rec-row umb-10">
              <Icon name="medal" weight="fill" className="ut-accent ut-xl" />
              <div className="uf-1 umw-0">
                <span className="rc-lbl ut-accent-lo">{t.rcTopRecord}</span>
                <div className="ut-md umt-4">{r.records[0].name}</div>
              </div>
              <div className="rc-num ut-2xl ut-accent-hi">{fmtKg(r.records[0].weightKg)}</div>
            </div>
          )}
          <Button
            variant="primary"
            className="rc-btn-block"
            onClick={(e) => {
              e.stopPropagation();
              openShare();
            }}
          >
            <Icon name="export" />
            {t.rcShareCard}
          </Button>
        </div>
      ),
    });

    return list;
  }, [data, t, locale, openShare, exName]);

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
        key={i}
        className="rc-story-panel"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (e.clientX - rect.left < rect.width * 0.33) setI((v) => Math.max(0, v - 1));
          else advance();
        }}
      >
        {panels[i].body}
      </div>
      <IconButton icon="x" label={t.backAction} className="rc-story-close" onClick={onClose} />
      {shareOpen && <RecapShareSheet entry={data} onClose={closeShare} />}
    </div>
  );
}
