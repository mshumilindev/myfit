/**
 * The equipment choices of the exercise library: the filter group of the gallery and the chips of the create/edit form. Both are
 * Equipment (Advanced training) and render nothing while the module is off.
 */
import { equipmentAvailable } from '../addons/featureGates';
import { EQUIPMENT_IDS } from '../data/equipment';
import { useT } from '../i18n';
import { equipmentIconName } from './Muscle';
import { Chip } from './ui/Chip';
import { Icon } from '../ui';

/** One column of the gallery filter: pick (or clear) a kind of equipment. */
export function EquipmentFilterGroup(props: {
  active: string | undefined;
  onPick: (id: string | undefined) => void;
}) {
  const { t } = useT();
  if (!equipmentAvailable()) return null;
  return (
    <div>
      <div className="exl-group-label">{t.equipmentLabelField}</div>
      <div className="exl-chips">
        {EQUIPMENT_IDS.map((id) => (
          <Chip
            key={`eq-${id}`}
            selected={props.active === id}
            onClick={() => props.onPick(props.active === id ? undefined : id)}
          >
            {t.equipmentNames[id]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** The equipment chips of the create/edit exercise form. */
export function EquipmentFormField(props: { selected: string[]; onToggle: (id: string) => void }) {
  const { t } = useT();
  if (!equipmentAvailable()) return null;
  return (
    <>
      <div className="field-label">{t.equipmentLabelField}</div>
      <div className="filter-chips">
        {EQUIPMENT_IDS.map((id) => (
          <Chip
            size="xs"
            selected={props.selected.includes(id)}
            key={id}
            onClick={() => props.onToggle(id)}
          >
            <Icon name={equipmentIconName(id)} />
            {t.equipmentNames[id]}
          </Chip>
        ))}
      </div>
    </>
  );
}
