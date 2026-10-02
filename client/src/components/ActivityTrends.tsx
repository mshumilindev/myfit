/**
 * Trends tab › Activities (design: Trends A1 + A2). A card with the window's
 * totals and stacked conditioning / recovery minutes per week, then the most
 * frequent activity types — each opens a sheet with its own weekly series,
 * usual weekday, median length and a Rising / Steady / Fading label.
 */
import { useMemo, useState } from 'react';
import type { Activity } from '../types';
import { fmtDayMonth, fmtWeekdayShort, useT } from '../i18n';
import { activityType } from '../activities';
import { activityTrends, TREND_WEEKS, type Momentum, type TypeTrend } from '../activityTrends';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Tag } from './ui/Tag';
import { IconTile } from './ui/IconTile';
import { StatStrip } from './ui/StatStrip';
import { GroupedList, ListRow } from './ui/GroupedList';
import { SectionLabel } from './ui/SectionLabel';
import { Sheet } from './ui/Overlays';
import { Icon } from '../ui';
import type { Tone } from './ui/tones';
import './ActivityTrends.css';

const MOMENTUM_TONE: Record<Momentum, Tone> = {
  rising: 'ok',
  steady: 'neutral',
  fading: 'illness',
};

/** Minutes → "1h 20m" / "45m". */
function fmtMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

/** An ISO weekday (Mon = 1) as a short localised name. */
function dayName(iso: number): string {
  // 2024-01-01 is a Monday.
  return fmtWeekdayShort(new Date(2024, 0, iso).getTime());
}

function toneOfType(key: string): Tone {
  const a = activityType(key);
  return a?.sport ? 'sport' : a?.category === 'recovery' ? 'rest' : 'conditioning';
}

function MiniWeeks({ weeks, tone }: { weeks: number[]; tone: Tone }) {
  const max = Math.max(1, ...weeks);
  return (
    <span className={`atr-mini uit--${tone}`} aria-hidden="true">
      {weeks.map((w, i) => (
        <i
          key={i}
          style={{ height: `${w ? 25 + (w / max) * 75 : 14}%` }}
          className={w ? 'on' : ''}
        />
      ))}
    </span>
  );
}

export function ActivityTrends({
  activities,
  bodyKg,
  onAddToProgram,
}: {
  activities: Activity[];
  bodyKg: number | null;
  /** Shown in a type's sheet when given (the program suggestion entry point). */
  onAddToProgram?: (type: string) => void;
}) {
  const { t, locale } = useT();
  const [now] = useState(() => Date.now());
  const [open, setOpen] = useState<string | null>(null);
  const data = useMemo(() => activityTrends(activities, now, bodyKg), [activities, now, bodyKg]);
  if (!data) return null;

  const max = Math.max(1, ...data.weeks.map((w) => w.conditioningMin + w.recoveryMin));
  const typeName = (k: string) => t.actType[k] ?? k;
  const sel: TypeTrend | undefined = data.top.find((x) => x.type === open);

  return (
    <section className="atr" aria-label={t.atrTitle}>
      <SectionLabel>{t.atrTitle}</SectionLabel>
      <Card pad="md" className="atr-card">
        <StatStrip
          label={t.atrTitle}
          items={[
            { value: data.sessions, label: t.atrSessions },
            { value: fmtMin(data.totalMin), label: t.atrActiveTime },
            ...(data.totalKcal > 0
              ? [
                  {
                    value: data.totalKcal.toLocaleString(locale),
                    unit: ` ${t.kcalShort}`,
                    label: t.atrBurned,
                  },
                ]
              : []),
          ]}
        />
        <div className="atr-bars" role="img" aria-label={t.atrTitle}>
          {data.weeks.map((w, i) => {
            const total = w.conditioningMin + w.recoveryMin;
            return (
              <div key={w.start} className={`atr-col${i === TREND_WEEKS - 1 ? ' is-now' : ''}`}>
                <div className="atr-stack">
                  {w.recoveryMin > 0 && (
                    <span
                      className="atr-seg rec"
                      style={{ height: `${(w.recoveryMin / max) * 100}%` }}
                    />
                  )}
                  {w.conditioningMin > 0 && (
                    <span
                      className="atr-seg cond"
                      style={{ height: `${(w.conditioningMin / max) * 100}%` }}
                    />
                  )}
                  {total === 0 && <span className="atr-seg none" />}
                </div>
                <span className="atr-wk">{new Date(w.start).getDate()}</span>
              </div>
            );
          })}
        </div>
        <div className="atr-foot">
          <span className="atr-legend">
            <span className="atr-key cond">{t.actConditioning}</span>
            <span className="atr-key rec">{t.actRecovery}</span>
          </span>
          {data.deltaPct !== null && data.deltaPct !== 0 && (
            <Tag
              tone={data.deltaPct > 0 ? 'ok' : 'illness'}
              icon={<Icon name={data.deltaPct > 0 ? 'trend-up' : 'trend-down'} />}
            >
              {t.atrDelta(data.deltaPct)}
            </Tag>
          )}
        </div>
      </Card>

      <GroupedList header={t.atrFrequent(TREND_WEEKS)}>
        {data.top.slice(0, 3).map((x) => (
          <ListRow
            key={x.type}
            icon={
              <IconTile
                tone={toneOfType(x.type)}
                size={36}
                icon={activityType(x.type)?.icon ?? 'heartbeat'}
              />
            }
            label={typeName(x.type)}
            sub={`${x.count}× · ${fmtMin(x.minutes)}${x.usualDay ? ` · ${dayName(x.usualDay)}` : ''}`}
            trailing={<MiniWeeks weeks={x.weeks} tone={toneOfType(x.type)} />}
            chevron
            onClick={() => setOpen(x.type)}
          />
        ))}
      </GroupedList>

      {sel && (
        <Sheet onClose={() => setOpen(null)}>
          <div className="sheet-head">
            <span className="t">{typeName(sel.type)}</span>
            <Tag tone={MOMENTUM_TONE[sel.momentum]}>{t.atrMomentum[sel.momentum]}</Tag>
          </div>
          <StatStrip
            label={typeName(sel.type)}
            items={[
              { value: sel.count, label: t.atrInWeeks(TREND_WEEKS) },
              { value: sel.medianMin, unit: ` ${t.minShort}`, label: t.atrMedian },
              ...(sel.usualDay ? [{ value: dayName(sel.usualDay), label: t.atrUsually }] : []),
            ]}
          />
          <div className="atr-detail">
            <div className="atr-detail-l">{t.atrPerWeek}</div>
            <div className={`atr-detail-bars uit--${toneOfType(sel.type)}`}>
              {sel.weeks.map((m, i) => (
                <i
                  key={i}
                  className={m ? 'on' : ''}
                  style={{ height: `${m ? 8 + (m / Math.max(1, ...sel.weeks)) * 92 : 4}%` }}
                />
              ))}
            </div>
          </div>
          <GroupedList header={t.atrRecent}>
            {sel.recent.map((a) => (
              <ListRow
                key={a.id}
                label={`${fmtWeekdayShort(a.startedAt)} ${fmtDayMonth(a.startedAt)}`}
                value={fmtMin(
                  a.durationMin && a.durationMin > 0
                    ? a.durationMin
                    : ((a.finishedAt ?? a.startedAt) - a.startedAt) / 60000,
                )}
              />
            ))}
          </GroupedList>
          {onAddToProgram && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon="calendar-plus"
              onClick={() => onAddToProgram(sel.type)}
            >
              {t.atrAddToProgram}
            </Button>
          )}
        </Sheet>
      )}
    </section>
  );
}
