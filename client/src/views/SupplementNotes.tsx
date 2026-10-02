/**
 * Two quiet, informational notes shown where the supplement estimate is relevant. Neither
 * changes a number: this app never changes a load or a target because of a supplement.
 *  - `SupplementStrengthNote`: creatine's strength expectation, under an exercise's history;
 *  - `SupplementRpeNote`: the caffeine effort note, next to the RPE hint in the set editor.
 * Both render nothing when supplements are off, the surface is off, or nothing applies today.
 */
import { useT } from '../i18n';
import { supMid, supRange } from '../supplementsApply';
import { useSupplements } from '../store';
import { fmtRangeText } from './sessionSummary/nicotineBaselines';

export function SupplementStrengthNote({ className = 'ut-xs ut-faint' }: { className?: string }) {
  const { t } = useT();
  useSupplements();
  const r = supRange('creatineStrength');
  const pct = { low: Math.round(r.low * 100), high: Math.round(r.high * 100) };
  if (pct.high < 1) return null;
  return (
    <p className={className} data-testid="sup-strength-note">
      {t.supFxStrengthNote(fmtRangeText(pct))}
    </p>
  );
}

export function SupplementRpeNote({ className = 'se-hint' }: { className?: string }) {
  const { t } = useT();
  useSupplements();
  const r = supRange('caffeineRpe');
  const drop = { low: Math.round(-r.high * 10) / 10, high: Math.round(-r.low * 10) / 10 };
  if (drop.high < 0.1) return null;
  return (
    <div className={className} data-testid="sup-rpe-note">
      {t.supFxRpeNote(fmtRangeText(drop, 1))}
    </div>
  );
}

/** Progress › fatigue / readiness: one line while late caffeine adds to the sleep need. */
export function SupplementTrendNote() {
  const { t } = useT();
  useSupplements();
  if (supMid('caffeineSleepMin') <= 0) return null;
  return (
    <p className="ut-xs ut-faint" data-testid="sup-trend-note">
      {t.supFxTrendNote}
    </p>
  );
}
