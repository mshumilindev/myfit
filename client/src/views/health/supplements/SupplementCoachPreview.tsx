/**
 * Privacy sheet: what the coach would see RIGHT NOW at the chosen sharing level, built from
 * the live data by the same function the share uses (`supplementsCoachView`). Effects only:
 * the effect ranges for a typical training day. Full: also the names, doses, schedule and
 * timing of each supplement and the caffeine / protein totals. Never which days were taken.
 * Kit only.
 */
import { COACH_EFFECT_ICON, COACH_TOTAL_ICON } from '../../../coachEffectIcons';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { supplementItem } from '../../../supplementCatalog';
import type { SupplementEffectKey } from '../../../supplements';
import { supplementContext } from '../../../supplementsApply';
import { supplementsCoachView, type CoachSupplementEffectKey } from '../../../supplementsShare';
import { useSupplements } from '../../../store';
import { useSupplementText } from './text';

const KEY_OF: Record<CoachSupplementEffectKey, SupplementEffectKey> = {
  strength: 'creatineStrength',
  bodyweightKg: 'creatineBodyweightKg',
  rpe: 'caffeineRpe',
  sleepMin: 'caffeineSleepMin',
  proteinGrams: 'proteinGrams',
};

export function SupplementCoachPreview() {
  const { t, itemName, doseText, timingLabel, fxValue } = useSupplementText();
  const state = useSupplements();
  const view = supplementsCoachView(state, supplementContext());
  if (!view) {
    return state.settings.sharing === 'off' ? null : (
      <span className="ut-sm ut-muted">{t.supPrivPreviewNone}</span>
    );
  }
  return (
    <div className="ul-flex ul-col ug-8">
      <GroupedList surface="raised" header={t.supPrivPreviewHead} footer={t.supPrivPreviewNever}>
        {view.effects.map((e) => (
          <ListRow
            key={e.key}
            icon={<IconTile tone="neutral" size={30} icon={COACH_EFFECT_ICON[e.key]} />}
            label={t.supFx[KEY_OF[e.key]]}
            value={fxValue(KEY_OF[e.key], { low: e.low, high: e.high })}
          />
        ))}
        {view.full?.items.map((i) => (
          <ListRow
            key={`${i.itemId}-${i.timing}`}
            icon={<IconTile tone="neutral" size={30} icon={supplementItem(i.itemId).icon} />}
            label={itemName(i.itemId)}
            sub={`${doseText(i.dose, i.unit)} · ${t.supSchedule[i.schedule]} · ${timingLabel(i.timing)}`}
          />
        ))}
        {view.full && (
          <ListRow
            icon={<IconTile tone="accent" size={30} icon={COACH_TOTAL_ICON.caffeine} />}
            label={t.supPrivPreviewTotals(view.full.caffeineMgPerDay, view.full.proteinGramsPerDay)}
          />
        )}
      </GroupedList>
    </div>
  );
}
