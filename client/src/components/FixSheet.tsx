/**
 * Fix-it suggestion sheet (design FIX-2/3): pick a lagging muscle, get real
 * exercises that hit it and that your gym can equip, each with a ready scheme,
 * and add one to the session in a tap. Reuses the muscle chips and the Sheet.
 */
import { useState } from 'react';
import { Icon, Sheet } from '../ui';
import { useStore, addExercise, startWorkout } from '../store';
import { useT } from '../i18n';
import { MuscleSetChip, equipmentLabel } from './Muscle';
import { activeGym, fixCandidates, type FixCandidate } from '../fixit';
import type { MuscleGroup } from '../data/exercises';

export function FixSheet({ muscle, onClose }: { muscle: MuscleGroup; onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const gym = activeGym(store.gyms, finished);
  const open = store.workouts.find((w) => w.finishedAt === null) ?? null;
  const [candidates] = useState(() => fixCandidates(muscle, gym, 3));
  const [addedName, setAddedName] = useState<string | null>(null);

  function add(c: FixCandidate) {
    const plan = {
      plannedSets: c.scheme.sets,
      plannedReps: c.scheme.reps,
      primaryMuscle: c.primary,
      secondaryMuscles: c.secondary,
      equipment: c.equipment,
    };
    if (open) {
      addExercise(open.id, c.name, 'strength', plan);
    } else {
      const w = startWorkout(gym?.id ?? null);
      addExercise(w.id, c.name, 'strength', plan);
    }
    setAddedName(c.name);
  }

  const addLabel = open ? t.fixAddToSession : t.fixStartAndAdd;

  return (
    <Sheet onClose={onClose} className="fix-sheet">
      <div className="fix-title">{t.fixTitle(t.muscleGroups[muscle])}</div>
      <div className="fix-sub">{t.fixSub}</div>
      {!gym && <div className="fix-hint">{t.fixNoGym}</div>}
      <div className="fix-cands">
        {candidates.map((c) => {
          const added = addedName === c.name;
          const avail = c.bodyweight
            ? { cls: 'any', icon: 'person-simple', text: t.fixAnywhere }
            : !gym
              ? {
                  cls: 'neutral',
                  icon: 'barbell',
                  text: c.equipment.map((e) => equipmentLabel(e)).join(' · ') || t.fixAnywhere,
                }
              : c.available
                ? { cls: 'ok', icon: 'check-circle', text: t.fixAtGym(gym.name) }
                : {
                    cls: 'warn',
                    icon: 'warning-circle',
                    text: t.fixMissing(c.missing.map((e) => equipmentLabel(e)).join(' · ')),
                  };
          return (
            <div key={c.name} className={`fix-card${added ? ' done' : ''}`}>
              <div className="fix-card-head">
                <span className="fix-name">{c.name}</span>
                <span className="fix-scheme">{c.scheme.label}</span>
              </div>
              {c.primary && (
                <div className="fix-chips">
                  <MuscleSetChip muscle={c.primary} tone="primary" />
                  {c.secondary.slice(0, 2).map((m) => (
                    <MuscleSetChip key={m} muscle={m} tone="secondary" />
                  ))}
                </div>
              )}
              <div className={`fix-avail ${avail.cls}`}>
                <Icon name={avail.icon} />
                <span>{avail.text}</span>
              </div>
              <button className="fix-add" onClick={() => add(c)} disabled={added}>
                {added ? (
                  <>
                    <Icon name="check" weight="bold" />
                    {open ? t.fixAdded : t.fixAddedNew}
                  </>
                ) : (
                  addLabel
                )}
              </button>
            </div>
          );
        })}
        {candidates.length === 0 && <div className="fix-hint">{t.fixNone}</div>}
      </div>
    </Sheet>
  );
}
