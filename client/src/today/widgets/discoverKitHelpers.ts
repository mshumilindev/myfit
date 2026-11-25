import { muscleInfoByName, type MuscleGroup } from '../../data/exercises';
import { type EquipmentItem } from '../../data/equipmentCatalog';
import { equipmentFor, type StoreState } from '../../store';

/** Kit the user has effectively used: items picked on a set, plus any item of a
 *  tool class they trained with whose muscles match the lift (a squat with a
 *  barbell counts for every full-body bar; a chest press does not count for the
 *  leg press). Looks at every finished workout, not only this gym. */
export function usedKit(store: StoreState, items: EquipmentItem[]): Set<string> {
  const used = new Set<string>();
  const byCls = new Map<string, Set<string>>(); // class → primary muscles trained with it
  for (const w of store.workouts) {
    if (w.finishedAt === null) continue;
    for (const e of w.exercises) {
      for (const id of e.equipmentItems ?? []) used.add(id);
      const info = muscleInfoByName(e.name);
      for (const cls of equipmentFor(e)) {
        const set = byCls.get(cls) ?? new Set<string>();
        if (info?.primary) set.add(info.primary);
        byCls.set(cls, set);
      }
    }
  }
  for (const it of items) {
    const ms = byCls.get(it.cls);
    if (!ms) continue;
    if (
      it.muscles.length === 0 ||
      it.muscles.includes('fullbody' as MuscleGroup) ||
      it.muscles.some((m) => ms.has(m))
    )
      used.add(it.id);
  }
  return used;
}

export const KIT_CATS = new Set([
  'machine',
  'plateLoaded',
  'cable',
  'barbell',
  'dumbbell',
  'kettlebell',
  'suspension',
  'band',
  'conditioning',
  'bench',
]);
