/**
 * The body of the Effort trend widget (Today), a lazy piece of the RPE / RIR chunk: the registry keeps the (synchronous) widget
 * shell and only mounts this when the module is installed. The shell passes the numbers; the words live in `widgetStrings.ts`.
 */
import './EffortTrendWidget.css';
import { Button } from '../components/ui/Button';
import { Widget, WidgetEmpty, WidgetList, WidgetSpark } from '../components/ui/Widget';
import { ews } from './widgetStrings';

import type { EffortTrendProps } from '../effortApi';

export function EffortTrendWidget({ size, locale, rows, zone, onOpen }: EffortTrendProps) {
  const s = ews(locale);
  const { lo: ZONE_LO, hi: ZONE_HI } = zone;
  const open = onOpen;
  if (rows.length === 0)
    return (
      <WidgetEmpty
        size={size}
        tone="accent"
        icon="gauge"
        kicker={s.effortK}
        title={s.noRpe}
        sub={s.noRpeSub}
        onAction={open}
      />
    );
  const avg = rows.reduce((a, r) => a + r.rpe, 0) / rows.length;
  const inZone = rows.filter((r) => r.rpe >= ZONE_LO && r.rpe <= ZONE_HI).length;
  const zoneTxt = s.zone(`${ZONE_LO}–${ZONE_HI}`);
  const state = avg < ZONE_LO ? s.belowZone : avg > ZONE_HI ? s.aboveZone : s.inZone;
  const advice = avg < ZONE_LO ? s.adviceLow : avg > ZONE_HI ? s.adviceHigh : s.adviceZone;
  const series = rows.map((r) => r.rpe).reverse();
  const spark = (h: number) =>
    series.length > 1 ? <WidgetSpark points={series} height={h} tone="accent" area /> : null;
  const avgTxt = avg.toFixed(1);
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="accent"
        icon="gauge"
        title={s.avgRpe(avgTxt)}
        sub={`${s.lastNSessions(rows.length)} · ${state}`}
        onClick={open}
        trailing={<span className="ul-flex effort-spark">{spark(28)}</span>}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="accent"
        kicker={s.effortK}
        value={avgTxt}
        unit={s.avg}
        sub={`${state} ${`${ZONE_LO}–${ZONE_HI}`}`}
        bodyLast
        onClick={open}
      >
        {spark(24)}
      </Widget>
    );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="accent"
        kicker={s.effortLast(rows.length)}
        badge={zoneTxt}
        value={avgTxt}
        unit={s.avgRpeUnit}
        bodyLast
        onClick={open}
      >
        {spark(44)}
      </Widget>
    );
  return (
    <Widget
      size="XL"
      tone="accent"
      kicker={s.effortLast(rows.length)}
      badge={s.inZoneN(inZone, rows.length)}
      value={avgTxt}
      unit={s.avgRpeUnit}
      sub={zoneTxt}
      bodyLast
      onClick={open}
      footer={
        <>
          <span className="uiw-sub uf-1">{advice}</span>
          <Button variant="secondary" size="sm" iconTrailing="caret-right" onClick={open}>
            {s.progress}
          </Button>
        </>
      }
    >
      {spark(80)}
      <WidgetList
        rows={rows.slice(0, 3).map((r) => ({ label: r.label, value: `RPE ${r.rpe.toFixed(1)}` }))}
      />
    </Widget>
  );
}
