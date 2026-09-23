/**
 * CardioMachineList — "which machine?" when adding (or switching) a cardio
 * entry. Machines the current gym is stocked with come first; the rest of the
 * catalog's cardio category follows; "no machine" keeps the old generic entry
 * (time + distance). The pick drives the entry's fields and its calorie maths
 * (cardio.ts).
 */
import { useMemo } from 'react';
import type { Gym } from '../types';
import { EQUIPMENT_CATALOG, type EquipmentItem } from '../data/equipmentCatalog';
import { localizedEquipName } from '../data/equipmentI18n';
import { CARDIO_PROFILES } from '../cardio';
import { useT } from '../i18n';
import { Icon, Sheet } from '../ui';

function machineIcon(id: string): string {
  const p = CARDIO_PROFILES[id];
  if (p?.formula === 'treadmill') return 'person-simple-run';
  if (/rower|ski-erg|rope/.test(id)) return 'wave-sine';
  if (/bike|ube/.test(id)) return 'bicycle';
  return 'heartbeat';
}

export function CardioMachineList(props: {
  gym: Gym | null;
  current?: string | null;
  onPick: (machineId: string | null, name: string) => void;
}) {
  const { t, locale } = useT();
  const { inGym, others } = useMemo(() => {
    const all = EQUIPMENT_CATALOG.filter((e) => e.category === 'cardio' && e.id in CARDIO_PROFILES);
    const have = new Set(props.gym?.equipmentItems ?? []);
    return {
      inGym: all.filter((e) => have.has(e.id)),
      others: all.filter((e) => !have.has(e.id)),
    };
  }, [props.gym]);

  const row = (e: EquipmentItem) => {
    const name = localizedEquipName(e, locale);
    const on = props.current === e.id;
    return (
      <button
        key={e.id}
        className={`add-row cardio-machine-row${on ? ' suggested' : ''}`}
        onClick={() => props.onPick(e.id, name)}
      >
        <span className="cm-ic" aria-hidden>
          <Icon name={machineIcon(e.id)} />
        </span>
        <span className="add-main">
          <span className="add-name">{name}</span>
        </span>
        {on && <Icon name="check" />}
      </button>
    );
  };

  return (
    <div className="cardio-machines">
      {inGym.length > 0 && (
        <div className="add-section">
          <div className="section-label">{t.cardioInGym}</div>
          <div className="add-rows">{inGym.map(row)}</div>
        </div>
      )}
      <div className="add-section">
        {inGym.length > 0 && <div className="section-label">{t.cardioOtherMachines}</div>}
        <div className="add-rows">
          <button
            className={`add-row cardio-machine-row${props.current === null ? ' suggested' : ''}`}
            onClick={() => props.onPick(null, t.defaultTimedExerciseNames.cardio)}
          >
            <span className="cm-ic" aria-hidden>
              <Icon name="timer" />
            </span>
            <span className="add-main">
              <span className="add-name">{t.cardioNoMachine}</span>
              <span className="cm-hint">{t.cardioNoMachineHint}</span>
            </span>
          </button>
          {others.map(row)}
        </div>
      </div>
    </div>
  );
}

/** Stand-alone sheet to switch the machine of an existing cardio entry. */
export function CardioMachineSheet(props: {
  gym: Gym | null;
  current: string | null;
  onPick: (machineId: string | null, name: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-label">{t.cardioMachineTitle}</div>
      <CardioMachineList gym={props.gym} current={props.current} onPick={props.onPick} />
    </Sheet>
  );
}
