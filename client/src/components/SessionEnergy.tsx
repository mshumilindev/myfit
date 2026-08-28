/**
 * Per-session energy (feature 6). One number — the MET-based kcal estimate for
 * a single workout (session wall-clock × body weight) — in two dresses:
 *  - EnergyPlaque: the blue flame plaque (td-energy styling) for the finished
 *    summary and a past workout in history.
 *  - LiveEnergyCounter: a compact activity-style flame counter that ticks under
 *    the content of a running session.
 */
import { Icon } from '../ui';
import { useT } from '../i18n';

export function EnergyPlaque({ kcal }: { kcal: number }) {
  const { t } = useT();
  return (
    <div className="td-energy session-energy">
      <span className="te-icon">
        <Icon name="flame" weight="fill" />
      </span>
      <div className="te-body">
        <div className="te-top">
          <span className="te-val tnum">~{kcal.toLocaleString()}</span>
          <span className="te-unit">{t.kcalShort}</span>
        </div>
      </div>
    </div>
  );
}

export function LiveEnergyCounter({ kcal }: { kcal: number }) {
  const { t } = useT();
  return (
    <div className="live-energy">
      <Icon name="flame" weight="fill" />
      <span className="le-val tnum">~{kcal.toLocaleString()}</span>
      <em>{t.kcalShort}</em>
    </div>
  );
}
