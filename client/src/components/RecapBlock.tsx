/**
 * Recap entry block for Notifications (design RC-01/01b/01e): a "Your recaps"
 * shelf pinned above the alert stream — a hero for the latest ready month, the
 * latest quarter and the year beneath, or a locked card when the current month
 * is too thin. "See all" opens a sheet with Monthly / Quarterly / Yearly.
 */
import { useMemo, useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { ListRow } from './ui/GroupedList';
import { useT } from '../i18n';
import { useStore, latestWeight } from '../store';
import { Icon, Sheet } from '../ui';
import { FocusBodyMap } from './Muscle';
import { availableRecaps, buildRecap, MONTH_UNLOCK, type RecapEntry } from '../recaps';
import { periodShort, periodTitle } from '../views/RecapView';
import { SectionLabel } from './ui/SectionLabel';

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
      <ListRow
        key={e.ref.id}
        dim={building}
        icon={
          <div
            className="rc-compact-ic"
            style={{
              background: building ? 'var(--color-neutral-900)' : 'var(--color-accent-900)',
              color: building ? 'var(--color-neutral-500)' : 'var(--color-accent)',
            }}
          >
            <Icon
              name={
                building ? 'hourglass-medium' : e.ref.kind === 'year' ? 'star' : 'calendar-check'
              }
              weight={building ? 'bold' : 'fill'}
              className="ut-xl"
            />
          </div>
        }
        label={periodShort(e.ref, locale)}
        sub={
          building
            ? t.rcBuildingSoFar(e.sessions)
            : `${e.sessions} ${t.rcSessions.toLowerCase()} · ${Math.round(quick(e).volumeKg / 1000)} t`
        }
        trailing={
          !building && <Icon name="play-circle" weight="fill" className="ut-3xl ut-accent" />
        }
        onClick={building ? undefined : () => onOpen(e.ref.id, true)}
      />
    );
  };

  return (
    <div className="rc-block">
      <SectionLabel
        tone="accent"
        action={
          entries.length > 1 ? (
            <Button variant="link" size="sm" onClick={() => setSheet(true)}>
              {t.rcSeeAll}
            </Button>
          ) : undefined
        }
      >
        <Icon name="sparkle" weight="fill" /> {t.rcYourRecaps}
      </SectionLabel>

      {readyMonth ? (
        <Card emphasis="hero" className="rc-hero">
          <div className="ul-flex ua-center ug-8">
            <Icon name="barbell" weight="fill" className="ut-accent ut-lg" />
            <span className="rc-lbl ut-accent-lo">
              {t.rcKindMonth} · {t.rcReady}
            </span>
            <span className="uf-1" />
            <span className="rc-hero-live" />
          </div>
          <div className="ut-hero ut-tight umt-14 rc-hero-title">
            {periodTitle(readyMonth.ref, locale)}
          </div>
          <div className="ut-lg ut-accent-hi umt-8 rc-hero-line">{heroLine(readyMonth)}</div>
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
          <Button
            variant="primary"
            fullWidth
            className="ut-lg ug-8 umt-18"
            onClick={() => onOpen(readyMonth.ref.id, true)}
          >
            <Icon name="play" weight="fill" />
            {t.rcPlayYours(periodShort(readyMonth.ref, locale))}
          </Button>
          <Button
            variant="link"
            size="sm"
            fullWidth
            className="umt-10"
            onClick={() => onOpen(readyMonth.ref.id, false)}
          >
            {t.rcReadFull}
          </Button>
        </Card>
      ) : pendingMonth ? (
        <Card className="rc-hero rc-hero--pending">
          <div className="ul-flex ua-center ug-12">
            <div className="ut-dim rc-pending-icon">
              <Icon name="hourglass-medium" weight="bold" className="ut-2xl" />
            </div>
            <div className="uf-1">
              <div className="ut-xl">{periodTitle(pendingMonth.ref, locale)}</div>
              <span className="rc-lbl rc-lbl--dim">{t.rcNotReady}</span>
            </div>
          </div>
          <div className="ut-base rc-unlock-body umt-14">
            {t.rcUnlockBody(MONTH_UNLOCK, pendingMonth.sessions)}
          </div>
          <div className="ul-flex ua-center ug-10 umt-14">
            <div className="rc-rank">
              <i
                style={{ width: `${Math.min(100, (pendingMonth.sessions / MONTH_UNLOCK) * 100)}%` }}
              />
            </div>
            <span className="rc-num ut-sm ut-dim">
              {pendingMonth.sessions} / {MONTH_UNLOCK}
            </span>
          </div>
        </Card>
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
        className="rc-num ut-2xl ut-tight"
        style={{
          color: gold ? 'var(--color-accent-300)' : undefined,
        }}
      >
        {n}
        {unit && <span className="ut-sm ut-accent-lo">{unit}</span>}
      </div>
      <div className="rc-lbl ut-accent-lo umt-4">{label}</div>
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
      <div key={e.ref.id} className="umt-10">
        <ListRow
          dim={building}
          icon={
            <div
              className="rc-compact-ic"
              style={{
                background: building ? 'var(--color-neutral-900)' : 'var(--color-accent-900)',
                color: building ? 'var(--color-neutral-500)' : 'var(--color-accent)',
              }}
            >
              <Icon
                name={
                  building ? 'hourglass-medium' : e.ref.kind === 'year' ? 'star' : 'calendar-check'
                }
                weight={building ? 'bold' : 'fill'}
                className="ut-xl"
              />
            </div>
          }
          label={periodShort(e.ref, locale)}
          sub={
            building
              ? t.rcBuildingSoFar(e.sessions)
              : `${e.sessions} ${t.rcSessions.toLowerCase()} · ${Math.round((r?.volumeKg ?? 0) / 1000)} t`
          }
          trailing={
            !building && <Icon name="play-circle" weight="fill" className="ut-3xl ut-accent" />
          }
          onClick={building ? undefined : () => onOpen(e.ref.id, true)}
        />
      </div>
    );
  };

  return (
    <Sheet onClose={onClose} className="rc-sheet">
      <div className="ul-flex ua-center ug-10" style={{ padding: '2px 2px 14px' }}>
        <span className="ut-2xl ut-tight uf-1">{t.rcYourRecaps}</span>
      </div>
      {months.length > 0 && (
        <div className="rc-shelf">
          <div className="rc-lbl umb-10">{t.rcMonthly}</div>
          <div className="rc-month-row">
            {months.slice(0, 3).map((e) => {
              const building = e.status !== 'ready';
              const r = building
                ? null
                : buildRecap(e.ref, ws, store.activities, store.goals, bodyKg);
              return (
                <Card
                  as="button"
                  pad="sm"
                  className="rc-month-card"
                  tone={e.status === 'ready' && r && r.volumeIsPeak ? 'accent' : 'neutral'}
                  key={e.ref.id}
                  onClick={building ? undefined : () => onOpen(e.ref.id, true)}
                >
                  <div style={{ width: 40 }}>
                    <FocusBodyMap grow={r?.growMuscles ?? []} ease={[]} view="front" width={40} />
                  </div>
                  <div className="ut-lg umt-8">
                    {new Date(e.ref.year, e.ref.index, 1).toLocaleDateString(locale, {
                      month: 'long',
                    })}
                  </div>
                  <div
                    className="ut-xs umt-4"
                    style={{
                      color: building ? 'var(--color-neutral-500)' : 'var(--color-accent-300)',
                    }}
                  >
                    {building
                      ? t.rcBuildingSoFar(e.sessions)
                      : `${Math.round((r?.volumeKg ?? 0) / 1000)} t · ${r?.prCount ?? 0} PR`}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      {quarters.length > 0 && (
        <div className="rc-shelf">
          <div className="rc-lbl umb-10">{t.rcQuarterly}</div>
          {quarters.map(row)}
        </div>
      )}
      {years.length > 0 && (
        <div className="rc-shelf">
          <div className="rc-lbl umb-10">{t.rcYearly}</div>
          {years.map(row)}
        </div>
      )}
    </Sheet>
  );
}
