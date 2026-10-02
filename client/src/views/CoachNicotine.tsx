/**
 * Coach's read-only nicotine card: only what the athlete shared. Effects: the ranges on
 * training. Full: also the usual amounts and the combined mg. Kit primitives only.
 */
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { useT } from '../i18n';
import { SURFACE_COEFFS, type NicotineEffectKey } from '../nicotine';
import type { CoachNicotineView } from '../nicotineShare';
import { productSub } from './sessionSummary/NicotineCard';
import { COACH_EFFECT_ICON, COACH_TOTAL_ICON } from '../coachEffectIcons';
import { NIC_ICON, roundMg } from './health/nicotine/text';

const SURFACE_LABEL: Record<
  NicotineEffectKey,
  | 'nicSfReadiness'
  | 'nicSfFatigue'
  | 'nicSfSleep'
  | 'nicSfWarmup'
  | 'nicSfRest'
  | 'nicSfProgression'
  | 'nicSfRpe'
> = {
  readiness: 'nicSfReadiness',
  deloadThreshold: 'nicSfFatigue',
  sleepMin: 'nicSfSleep',
  warmupMin: 'nicSfWarmup',
  restPct: 'nicSfRest',
  progressionStep: 'nicSfProgression',
  rpe: 'nicSfRpe',
};

const num = (n: number, d: number) => String(Math.round(n * 10 ** d) / 10 ** d);
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');

/** "−5 to −10 %", "+15 to +30 min", "−0.25 to −0.5". */
export function coachEffectText(
  key: NicotineEffectKey,
  low: number,
  high: number,
  minShort: string,
): string {
  const c = SURFACE_COEFFS[key];
  const d = (v: number) => (c.mode === 'mult' ? (v - 1) * 100 : v);
  const unit = c.mode === 'mult' ? ' %' : key === 'rpe' ? '' : ` ${minShort}`;
  const digits = key === 'rpe' ? 2 : 0;
  const a = d(low);
  const b = d(high);
  // Strongest end last, like "−5 to −10 %".
  const [first, second] = Math.abs(a) <= Math.abs(b) ? [a, b] : [b, a];
  const f = (v: number) => `${sign(v)}${num(Math.abs(v), digits)}`;
  return f(first) === f(second) ? `${f(first)}${unit}` : `${f(first)} → ${f(second)}${unit}`;
}

export function CoachNicotine({ view }: { view: CoachNicotineView }) {
  const { t } = useT();
  // Weak research behind it, or none at all (experimental); a moderate one needs no tag.
  const confidenceLabel = (key: NicotineEffectKey): string | undefined => {
    const c = SURFACE_COEFFS[key].confidence;
    return c === 'none' ? t.nicConfExperimental : c === 'weak' ? t.nicConfWeak : undefined;
  };
  return (
    <div className="ul-flex ul-col ug-8">
      {view.effects.length > 0 && (
        <GroupedList header={t.nicFxCoachEffects} footer={view.full ? undefined : t.nicFxCoachFoot}>
          {view.effects.map((e) => (
            <ListRow
              key={e.key}
              icon={<IconTile tone="neutral" size={30} icon={COACH_EFFECT_ICON[e.key]} />}
              label={t[SURFACE_LABEL[e.key]]}
              value={coachEffectText(e.key, e.low, e.high, t.minShort)}
              sub={confidenceLabel(e.key)}
            />
          ))}
        </GroupedList>
      )}
      {view.full && (
        <GroupedList header={t.nicFxCoachProducts} footer={t.nicFxCoachFoot}>
          {view.full.products.map((p, i) => {
            return (
              <ListRow
                key={`${p.kind}${i}`}
                icon={<IconTile tone="neutral" size={30} icon={NIC_ICON[p.kind]} />}
                label={t.nicKind[p.kind]}
                sub={productSub(t, p)}
              />
            );
          })}
          <ListRow
            icon={<IconTile tone="accent" size={30} icon={COACH_TOTAL_ICON.load} />}
            label={t.nicFxLoad}
            sub={
              <>
                <span className="ul-block">{t.nicFxLoadSub}</span>
                <span className="ul-block">{t.nicFxLabelledMg(roundMg(view.full.mgPerDay))}</span>
                <span className="ul-block">
                  {t.nicFxCigEq(String(Math.round(view.full.cigEq * 10) / 10))}
                </span>
              </>
            }
            value={t.nicFxMg(roundMg(view.full.absorbedMgPerDay))}
            valueStrong
          />
        </GroupedList>
      )}
    </div>
  );
}
