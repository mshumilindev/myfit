/**
 * Recap entry block for Notifications (design RC-01/01b/01e): a "Your recaps"
 * shelf pinned above the alert stream — a hero for the latest ready month, the
 * latest quarter and the year beneath, or a locked card when the current month
 * is too thin. "See all" opens a sheet with Monthly / Quarterly / Yearly.
 */
import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useStore, latestWeight } from '../store';
import { Icon, Sheet } from '../ui';
import { FocusBodyMap } from './Muscle';
import { availableRecaps, buildRecap, MONTH_UNLOCK, type RecapEntry } from '../recaps';
import { periodShort, periodTitle } from '../views/RecapView';

export function RecapBlock({ onOpen }: { onOpen: (period: string, story: boolean) => void }) {
  const { t, locale } = useT();
  const store = useStore();
  const [sheet, setSheet] = useState(false);
  const ws = store.workouts;
  const entries = useMemo(() => availableRecaps(ws), [ws]);

  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const quick = (e: RecapEntry) => buildRecap(e.ref, ws, store.activities, store.goals, bodyKg);

  const months = entries.filter((e) => e.ref.kind === 'month');
  const quarters = entries.filter((e) => e.ref.kind === 'quarter');
  const years = entries.filter((e) => e.ref.kind === 'year');
  const readyMonth = months.find((e) => e.status === 'ready');
  const pendingMonth = months[0] && months[0].status !== 'ready' ? months[0] : undefined;
  const quarterReady = quarters.find((e) => e.status === 'ready');
  const yearEntry = years[0];

  const hasContent = entries.some((e) => e.status === 'ready' || e.sessions > 0);
  if (!hasContent) return null;

  const compact = (e: RecapEntry, building: boolean) => {
    return (
      <button
        key={e.ref.id}
        className={`rc-compact${building ? ' building' : ''}`}
        onClick={building ? undefined : () => onOpen(e.ref.id, true)}
      >
        <div
          className="rc-compact-ic"
          style={{
            background: building ? 'var(--color-neutral-900)' : 'var(--color-accent-900)',
            color: building ? 'var(--color-neutral-500)' : 'var(--color-accent)',
          }}
        >
          <Icon
            name={building ? 'hourglass-medium' : e.ref.kind === 'year' ? 'star' : 'calendar-check'}
            weight={building ? 'bold' : 'fill'}
            style={{ fontSize: 17 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, color: building ? 'var(--color-neutral-300)' : undefined }}>
            {periodShort(e.ref, locale)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 2 }}>
            {building
              ? t.rcBuildingSoFar(e.sessions)
              : `${e.sessions} ${t.rcSessions.toLowerCase()} · ${Math.round(quick(e).volumeKg / 1000)} t`}
          </div>
        </div>
        {!building && (
          <Icon
            name="play-circle"
            weight="fill"
            style={{ fontSize: 24, color: 'var(--color-accent)' }}
          />
        )}
      </button>
    );
  };

  return (
    <div className="rc-block">
      <div className="rc-block-head">
        <Icon name="sparkle" weight="fill" style={{ color: 'var(--color-accent)', fontSize: 13 }} />
        <span className="rc-lbl" style={{ color: 'var(--color-accent-300)', flex: 1 }}>
          {t.rcYourRecaps}
        </span>
        {entries.length > 1 && (
          <button
            className="rc-seeall"
            onClick={() => setSheet(true)}
            style={{
              background: 'none',
              border: 0,
              color: 'var(--color-accent-300)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {t.rcSeeAll}
          </button>
        )}
      </div>

      {readyMonth ? (
        <div className="rc-hero">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon
              name="barbell"
              weight="fill"
              style={{ color: 'var(--color-accent)', fontSize: 15 }}
            />
            <span className="rc-lbl" style={{ color: 'var(--color-accent-300)' }}>
              {t.rcKindMonth} · {t.rcReady}
            </span>
            <span style={{ flex: 1 }} />
            <span className="rc-hero-live" />
          </div>
          <div style={{ fontSize: 30, letterSpacing: '-0.025em', marginTop: 14, lineHeight: 1.05 }}>
            {periodTitle(readyMonth.ref, locale)}
          </div>
          <div
            style={{
              fontSize: 15,
              color: 'var(--color-accent-100)',
              marginTop: 8,
              lineHeight: 1.4,
            }}
          >
            {heroLine(readyMonth)}
          </div>
          <div className="rc-hero-stats">
            {(() => {
              const r = quick(readyMonth);
              return (
                <>
                  <Stat n={`${Math.round(r.volumeKg / 1000)}`} unit="t" label={t.rcVolShort} gold />
                  <Stat n={`${r.sessions}`} label={t.rcSessions} />
                  <Stat n={`${r.prCount}`} label="PRs" gold />
                </>
              );
            })()}
          </div>
          <button
            className="btn btn-primary"
            style={{ minHeight: 46, fontSize: 15, gap: 8, marginTop: 18, width: '100%' }}
            onClick={() => onOpen(readyMonth.ref.id, true)}
          >
            <Icon name="play" weight="fill" />
            {t.rcPlayYours(periodShort(readyMonth.ref, locale))}
          </button>
          <button
            onClick={() => onOpen(readyMonth.ref.id, false)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--color-accent-300)',
              marginTop: 9,
              background: 'none',
              border: 0,
              cursor: 'pointer',
            }}
          >
            {t.rcReadFull}
          </button>
        </div>
      ) : pendingMonth ? (
        <div
          className="rc-hero"
          style={{
            background: 'var(--color-surface)',
            boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--color-neutral-900)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--color-neutral-500)',
              }}
            >
              <Icon name="hourglass-medium" weight="bold" style={{ fontSize: 19 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18 }}>{periodTitle(pendingMonth.ref, locale)}</div>
              <span className="rc-lbl" style={{ color: 'var(--color-neutral-600)' }}>
                {t.rcNotReady}
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-neutral-400)',
              lineHeight: 1.55,
              marginTop: 14,
            }}
          >
            {t.rcUnlockBody(MONTH_UNLOCK, pendingMonth.sessions)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <div className="rc-rank">
              <i
                style={{ width: `${Math.min(100, (pendingMonth.sessions / MONTH_UNLOCK) * 100)}%` }}
              />
            </div>
            <span className="rc-num" style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
              {pendingMonth.sessions} / {MONTH_UNLOCK}
            </span>
          </div>
        </div>
      ) : null}

      {quarterReady && compact(quarterReady, false)}
      {yearEntry && compact(yearEntry, yearEntry.status !== 'ready')}

      {sheet && <AllRecapsSheet onClose={() => setSheet(false)} onOpen={onOpen} />}
    </div>
  );

  function heroLine(e: RecapEntry): string {
    const r = quick(e);
    const pw =
      e.ref.kind === 'month'
        ? t.rcPeriodMonth
        : e.ref.kind === 'quarter'
          ? t.rcPeriodQuarter
          : t.rcPeriodYear;
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
}

function Stat({
  n,
  unit,
  label,
  gold,
}: {
  n: string;
  unit?: string;
  label: string;
  gold?: boolean;
}) {
  return (
    <div>
      <div
        className="rc-num"
        style={{
          fontSize: 22,
          letterSpacing: '-0.02em',
          color: gold ? 'var(--color-accent-300)' : undefined,
        }}
      >
        {n}
        {unit && <span style={{ fontSize: 12, color: 'var(--color-accent-300)' }}>{unit}</span>}
      </div>
      <div className="rc-lbl" style={{ marginTop: 4, color: 'var(--color-accent-300)' }}>
        {label}
      </div>
    </div>
  );
}

export function AllRecapsSheet({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (period: string, story: boolean) => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const ws = store.workouts;
  const entries = useMemo(() => availableRecaps(ws), [ws]);
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const months = entries.filter((e) => e.ref.kind === 'month').slice(0, 6);
  const quarters = entries.filter((e) => e.ref.kind === 'quarter').slice(0, 4);
  const years = entries.filter((e) => e.ref.kind === 'year').slice(0, 3);

  const row = (e: RecapEntry) => {
    const building = e.status !== 'ready';
    const r = building ? null : buildRecap(e.ref, ws, store.activities, store.goals, bodyKg);
    return (
      <button
        key={e.ref.id}
        className={`rc-compact${building ? ' building' : ''}`}
        style={{ marginTop: 10 }}
        onClick={building ? undefined : () => onOpen(e.ref.id, true)}
      >
        <div
          className="rc-compact-ic"
          style={{
            background: building ? 'var(--color-neutral-900)' : 'var(--color-accent-900)',
            color: building ? 'var(--color-neutral-500)' : 'var(--color-accent)',
          }}
        >
          <Icon
            name={building ? 'hourglass-medium' : e.ref.kind === 'year' ? 'star' : 'calendar-check'}
            weight={building ? 'bold' : 'fill'}
            style={{ fontSize: 17 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15 }}>{periodShort(e.ref, locale)}</div>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 2 }}>
            {building
              ? t.rcBuildingSoFar(e.sessions)
              : `${e.sessions} ${t.rcSessions.toLowerCase()} · ${Math.round((r?.volumeKg ?? 0) / 1000)} t`}
          </div>
        </div>
        {!building && (
          <Icon
            name="play-circle"
            weight="fill"
            style={{ fontSize: 24, color: 'var(--color-accent)' }}
          />
        )}
      </button>
    );
  };

  return (
    <Sheet onClose={onClose} className="rc-sheet">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 2px 14px' }}>
        <span style={{ flex: 1, fontSize: 20, letterSpacing: '-0.02em' }}>{t.rcYourRecaps}</span>
      </div>
      {months.length > 0 && (
        <div className="rc-shelf">
          <div className="rc-lbl" style={{ marginBottom: 10 }}>
            {t.rcMonthly}
          </div>
          <div className="rc-month-row">
            {months.slice(0, 3).map((e) => {
              const building = e.status !== 'ready';
              const r = building
                ? null
                : buildRecap(e.ref, ws, store.activities, store.goals, bodyKg);
              return (
                <button
                  key={e.ref.id}
                  className={`rc-month-card${e.status === 'ready' && r && r.volumeIsPeak ? ' gold' : ''}`}
                  onClick={building ? undefined : () => onOpen(e.ref.id, true)}
                >
                  <div style={{ width: 40 }}>
                    <FocusBodyMap grow={r?.growMuscles ?? []} ease={[]} view="front" width={40} />
                  </div>
                  <div style={{ fontSize: 15, marginTop: 8 }}>
                    {new Date(e.ref.year, e.ref.index, 1).toLocaleDateString(locale, {
                      month: 'long',
                    })}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: building ? 'var(--color-neutral-500)' : 'var(--color-accent-300)',
                      marginTop: 3,
                    }}
                  >
                    {building
                      ? t.rcBuildingSoFar(e.sessions)
                      : `${Math.round((r?.volumeKg ?? 0) / 1000)} t · ${r?.prCount ?? 0} PR`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {quarters.length > 0 && (
        <div className="rc-shelf">
          <div className="rc-lbl" style={{ marginBottom: 10 }}>
            {t.rcQuarterly}
          </div>
          {quarters.map(row)}
        </div>
      )}
      {years.length > 0 && (
        <div className="rc-shelf">
          <div className="rc-lbl" style={{ marginBottom: 10 }}>
            {t.rcYearly}
          </div>
          {years.map(row)}
        </div>
      )}
    </Sheet>
  );
}
