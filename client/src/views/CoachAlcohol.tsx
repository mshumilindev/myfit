/**
 * Coach's read-only alcohol card: only what the athlete shared. Alcohol has one level,
 * "effects": the ranges on training with their evidence tag. Never the drinks, amounts or
 * weekdays. Kit primitives only.
 */
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { useT } from '../i18n';
import { SURFACE_COEFFS, type AlcoholEffectKey } from '../alcohol';
import type { CoachAlcoholView } from '../alcoholShare';
import { COACH_EFFECT_ICON } from '../coachEffectIcons';
import { coachEffectText } from './CoachNicotine';

const SURFACE_LABEL: Record<
  AlcoholEffectKey,
  'nicSfReadiness' | 'nicSfFatigue' | 'nicSfSleep' | 'nicSfProgression'
> = {
  readiness: 'nicSfReadiness',
  deloadThreshold: 'nicSfFatigue',
  sleepMin: 'nicSfSleep',
  progressionStep: 'nicSfProgression',
};

export function CoachAlcohol({ view }: { view: CoachAlcoholView }) {
  const { t } = useT();
  // Weak research behind it, or none at all (experimental).
  const confidenceLabel = (key: AlcoholEffectKey): string | undefined => {
    const c = SURFACE_COEFFS[key].confidence;
    return c === 'none' ? t.nicConfExperimental : c === 'weak' ? t.nicConfWeak : undefined;
  };
  if (view.effects.length === 0) return null;
  return (
    <GroupedList header={t.nicFxCoachEffects} footer={t.nicFxCoachFoot}>
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
  );
}
