/**
 * Coach's read-only supplements card: only what the athlete shared. Two levels:
 *  - Effects: the expected ranges on training with neutral labels (never a product name);
 *  - Full: also the supplements with their doses, schedule and timing, and the caffeine (mg)
 *    and protein (g) of a typical training day.
 * Day check-ins are never shared. Kit primitives only.
 */
import { COACH_EFFECT_ICON, COACH_TOTAL_ICON } from '../coachEffectIcons';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { useT } from '../i18n';
import type { Strings } from '../i18n/en';
import { SUPPLEMENT_COEFFS, type SupplementEffectKey } from '../supplements';
import { supplementItem } from '../supplementCatalog';
import type { CoachSupplementEffectKey, CoachSupplementsView } from '../supplementsShare';
import { supDoseText, supName } from '../supplementsText';

const COEFF_KEY: Record<CoachSupplementEffectKey, SupplementEffectKey> = {
  strength: 'creatineStrength',
  bodyweightKg: 'creatineBodyweightKg',
  rpe: 'caffeineRpe',
  sleepMin: 'caffeineSleepMin',
  proteinGrams: 'proteinGrams',
};

const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
const num = (n: number, digits: number) => String(Math.round(n * 10 ** digits) / 10 ** digits);

/** "+0 → +5 %", "+0.5 → +2 kg", "−0.2 → −0.5", "+0 → +23 min", "+20 g": the strong end last. */
export function supEffectText(
  key: CoachSupplementEffectKey,
  low: number,
  high: number,
  t: Pick<Strings, 'minShort' | 'supFxUnit'>,
): string {
  const scale = key === 'strength' ? 100 : 1;
  const digits = key === 'rpe' || key === 'bodyweightKg' ? 1 : 0;
  const unit =
    key === 'strength'
      ? ' %'
      : key === 'bodyweightKg'
        ? ' kg'
        : key === 'sleepMin'
          ? ` ${t.minShort}`
          : key === 'proteinGrams'
            ? ` ${t.supFxUnit.g}`
            : '';
  const a = low * scale;
  const b = high * scale;
  const [first, second] = Math.abs(a) <= Math.abs(b) ? [a, b] : [b, a];
  // "+0" reads as "0"; a minus sign on a zero end is dropped.
  const f = (v: number) => {
    const s = num(Math.abs(v), digits);
    return Number(s) === 0 ? '0' : `${sign(v)}${s}`;
  };
  return f(first) === f(second) ? `${f(first)}${unit}` : `${f(first)} → ${f(second)}${unit}`;
}

export function CoachSupplements({ view }: { view: CoachSupplementsView }) {
  const { t } = useT();
  // Same rule as nicotine / alcohol: weak research or none is tagged, a moderate one is not.
  const confidenceLabel = (key: CoachSupplementEffectKey): string | undefined => {
    const c = SUPPLEMENT_COEFFS[COEFF_KEY[key]].confidence;
    return c === 'none' ? t.nicConfExperimental : c === 'weak' ? t.nicConfWeak : undefined;
  };
  return (
    <div className="ul-flex ul-col ug-8">
      {view.effects.length > 0 && (
        <GroupedList header={t.supFxCoachEffects} footer={view.full ? undefined : t.supFxCoachFoot}>
          {view.effects.map((e) => (
            <ListRow
              key={e.key}
              icon={<IconTile tone="neutral" size={30} icon={COACH_EFFECT_ICON[e.key]} />}
              label={t.supFxCoachKey[e.key]}
              value={supEffectText(e.key, e.low, e.high, t)}
              sub={confidenceLabel(e.key)}
            />
          ))}
        </GroupedList>
      )}
      {view.full && (
        <GroupedList header={t.supFxCoachItems} footer={t.supFxCoachFoot}>
          {view.full.items.map((it, i) => (
            <ListRow
              key={`${it.itemId}${i}`}
              icon={<IconTile tone="neutral" size={30} icon={supplementItem(it.itemId).icon} />}
              label={supName(t, it.itemId)}
              sub={`${supDoseText(t, it.dose, it.unit)} · ${t.supFxSchedule[it.schedule]} · ${t.supFxTiming[it.timing]}`}
            />
          ))}
          {view.full.caffeineMgPerDay > 0 && (
            <ListRow
              icon={<IconTile tone="accent" size={30} icon={COACH_TOTAL_ICON.caffeine} />}
              label={t.supFxCoachCaffeine(view.full.caffeineMgPerDay)}
            />
          )}
          {view.full.proteinGramsPerDay > 0 && (
            <ListRow
              icon={<IconTile tone="accent" size={30} icon={COACH_EFFECT_ICON.proteinGrams} />}
              label={t.supFxCoachProtein(view.full.proteinGramsPerDay)}
            />
          )}
        </GroupedList>
      )}
    </div>
  );
}
