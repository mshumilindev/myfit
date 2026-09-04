/**
 * EquipmentDetailView — the machine/equipment detail (design "My Fit · Machine
 * Details", MD-02…MD-04). Behind every inventory item: a photo, one-line
 * what-it-is, the muscles it works (primary in gold, secondary in grey on the
 * same chips the rest of the app uses), the exercises from our database you can
 * do on it (matched by the item's equipment class and muscles), a jump into
 * logging, the notable model lines, aliases, and same-muscle alternatives —
 * each flagged for whether *this* gym has it. Pulls straight from the equipment
 * catalog and the exercise DB; no new data.
 */
import { useMemo } from 'react';
import { equipmentById, enrichedCatalog, type EquipmentItem } from '../data/equipmentCatalog';
import { localizedEquipName, localizedEquipInfo, equipCategoryLabel } from '../data/equipmentI18n';
import { MuscleChip } from '../components/Muscle';
import {
  searchCatalog,
  secondaryMusclesOf,
  richExerciseByName,
  type CatalogExercise,
  type MuscleGroup,
} from '../data/exercises';
import { focusLists } from '../goals';
import { focusToGroup } from '../data/subregions';
import { addExercise, startWorkout, setGymEquipment, useStore } from '../store';
import { useT, LOCALE_IDS } from '../i18n';
import { Icon } from '../ui';
import type { Shell } from '../App';

export function EquipmentDetailView({
  itemId,
  gymId,
  shell,
  onClose,
}: {
  itemId: string;
  gymId?: string;
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const li = Math.max(0, LOCALE_IDS.indexOf(locale));

  const item = useMemo(() => equipmentById(itemId), [itemId]);
  const gym = gymId ? store.gyms.find((g) => g.id === gymId) : undefined;
  const inGym = (id: string): boolean => !!gym?.equipmentItems?.includes(id);

  // Exercises for this equipment class, ranked so ones hitting the item's own
  // muscles come first.
  const exercises = useMemo<CatalogExercise[]>(() => {
    if (!item) return [];
    // Match by the item's muscles, not just its coarse equipment class — a class
    // match alone drags in cardio machines (treadmill, bike) for a leg press.
    const prim = new Set<MuscleGroup>(
      item.muscles.filter((m) => m !== 'cardio' && m !== 'fullbody'),
    );
    // No muscle tags → not something you train ON (timer, chalk, mat): show no
    // exercise list at all rather than a class-only fallback of noise.
    if (prim.size === 0) return [];
    const pool = searchCatalog('', 150, item.cls);
    const seen = new Set<string>();
    const relevant: CatalogExercise[] = [];
    for (const e of pool) {
      const k = e.names[0].toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      if (e.muscle === 'cardio') continue;
      const rich = richExerciseByName(e.names[0]);
      if (rich?.category === 'cardio' || rich?.category === 'stretching') continue;
      if (prim.has(e.muscle) || secondaryMusclesOf(e).some((m) => prim.has(m))) relevant.push(e);
    }
    relevant.sort((a, b) => (prim.has(a.muscle) ? 0 : 1) - (prim.has(b.muscle) ? 0 : 1));
    return relevant.slice(0, 8);
  }, [item]);

  // Secondary muscles = extra muscles the matched exercises hit, minus primary.
  const secondary = useMemo<MuscleGroup[]>(() => {
    if (!item) return [];
    const prim = new Set<MuscleGroup>(item.muscles);
    const out: MuscleGroup[] = [];
    for (const ex of exercises) {
      for (const m of [ex.muscle, ...secondaryMusclesOf(ex)]) {
        if (m === 'cardio' || m === 'fullbody') continue;
        if (!prim.has(m) && !out.includes(m)) out.push(m);
      }
    }
    return out.slice(0, 4);
  }, [item, exercises]);

  // Goals: which of the item's muscles are on the current block's grow list.
  const growHits = useMemo<MuscleGroup[]>(() => {
    if (!item) return [];
    const grow = new Set<MuscleGroup>(focusLists(store.goals).grow.map(focusToGroup));
    return item.muscles.filter((m) => grow.has(m));
  }, [item, store.goals]);

  // Same-muscle alternatives: other kit sharing a muscle, same category first.
  const alternatives = useMemo<EquipmentItem[]>(() => {
    if (!item) return [];
    const prim = new Set<MuscleGroup>(
      item.muscles.filter((m) => m !== 'cardio' && m !== 'fullbody'),
    );
    if (prim.size === 0) return [];
    const scored = enrichedCatalog()
      .filter((e) => e.id !== item.id)
      .map((e) => ({ e, overlap: e.muscles.filter((m) => prim.has(m)).length }))
      .filter((x) => x.overlap > 0)
      .sort(
        (a, b) =>
          b.overlap - a.overlap ||
          (a.e.category === item.category ? 0 : 1) - (b.e.category === item.category ? 0 : 1) ||
          (inGym(b.e.id) ? 1 : 0) - (inGym(a.e.id) ? 1 : 0),
      );
    return scored.slice(0, 6).map((x) => x.e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, gym]);

  if (!item) {
    return (
      <div className="screen exd eqd">
        <div className="eqd-body">
          <button className="eqd-back" onClick={onClose} aria-label={t.backAction}>
            <Icon name="caret-left" />
          </button>
          <div className="detail-muted eqd-empty">—</div>
        </div>
      </div>
    );
  }

  const name = localizedEquipName(item, locale);
  const info = localizedEquipInfo(item, locale);
  const here = inGym(item.id);

  function logASet() {
    if (!item || exercises.length === 0) return;
    const open = store.workouts.find((w) => w.finishedAt === null);
    const w = open ?? startWorkout(null);
    addExercise(w.id, exercises[0].names[0], 'strength');
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  }

  function addToGym() {
    if (!item || !gym) return;
    const next = new Set(gym.equipmentItems ?? []);
    next.add(item.id);
    setGymEquipment(gym.id, [...next]);
  }

  return (
    <div className="screen exd eqd">
      <div className="eqd-body">
        <button className="eqd-back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div className="eqd-hero">
          {item.image ? (
            <img src={item.image.thumbUrl} alt="" onError={hideBroken} />
          ) : (
            <span className="eqd-hero-ph" aria-hidden />
          )}
        </div>

        <div className="eqd-cat lbl">
          {equipCategoryLabel(item.category, locale)}
          {gym &&
            (here ? (
              <span className="eqd-here on">
                <Icon name="check-circle" weight="fill" /> {t.eqInThisGym}
              </span>
            ) : (
              <button className="eqd-here add" onClick={addToGym}>
                <Icon name="plus" /> {t.add}
              </button>
            ))}
        </div>

        <h1 className="eqd-title">{name}</h1>
        {info && <p className="eqd-info">{info}</p>}

        {(item.muscles.length > 0 || secondary.length > 0) && (
          <section className="eqd-sec">
            <div className="lbl eqd-lbl">{t.eqMusclesWorked}</div>
            {item.muscles.length > 0 && (
              <>
                <div className="lbl eqd-sub">{t.eqPrimary}</div>
                <div className="eqd-chips">
                  {item.muscles.map((m) => (
                    <MuscleChip key={m} muscle={m} tone="primary" />
                  ))}
                </div>
              </>
            )}
            {secondary.length > 0 && (
              <>
                <div className="lbl eqd-sub">{t.eqSecondary}</div>
                <div className="eqd-chips">
                  {secondary.map((m) => (
                    <MuscleChip key={m} muscle={m} tone="secondary" />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {growHits.length > 0 && (
          <div className="eqd-goal">
            <Icon name="crosshair" weight="fill" />
            <span>
              {t.eqHits} {growHits.map((m) => t.muscleGroups[m]).join(' + ')} — {t.eqOnGrowList}
            </span>
          </div>
        )}

        {exercises.length > 0 && (
          <section className="eqd-sec">
            <div className="lbl eqd-lbl">
              {t.eqExercisesOnIt}
              <span className="eqd-count">{exercises.length}</span>
            </div>
            <div className="detail-muted eqd-note">{t.eqFromDb}</div>
            <div className="eqd-exs">
              {exercises.map((ex) => (
                <button
                  key={ex.id}
                  className="eqd-ex"
                  onClick={() =>
                    shell.openOverlay({ screen: 'exercise-detail', name: ex.names[0] })
                  }
                >
                  <span className={`eqd-dot m-${ex.muscle}`} aria-hidden />
                  <span className="eqd-ex-name">{ex.names[li] || ex.names[0]}</span>
                  <span className="eqd-ex-mus">{t.muscleGroups[ex.muscle]}</span>
                  <Icon name="caret-right" />
                </button>
              ))}
            </div>
            <button className="btn btn-primary eqd-log" onClick={logASet}>
              <Icon name="plus" weight="bold" /> {t.eqLogSet}
            </button>
          </section>
        )}

        {item.models && item.models.length > 0 && (
          <section className="eqd-sec">
            <div className="lbl eqd-lbl">{t.eqCommonModels}</div>
            <div className="eqd-models">
              {item.models.map((m, i) => (
                <div className="eqd-model" key={`${m.brand}-${m.name}-${i}`}>
                  <Icon name="gear" />
                  <span className="eqd-model-brand">{m.brand}</span>
                  <span className="eqd-model-name">{m.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {item.aka && item.aka.length > 0 && (
          <section className="eqd-sec">
            <div className="lbl eqd-lbl">{t.eqAlsoKnownAs}</div>
            <div className="eqd-akas">
              {item.aka.map((a) => (
                <span className="eqd-aka" key={a}>
                  {a}
                </span>
              ))}
            </div>
          </section>
        )}

        {alternatives.length > 0 && (
          <section className="eqd-sec">
            <div className="lbl eqd-lbl">{t.eqTrainsSame}</div>
            <div className="eqd-alts">
              {alternatives.map((alt) => (
                <button
                  key={alt.id}
                  className="eqd-alt"
                  onClick={() => shell.openOverlay({ screen: 'equipment', itemId: alt.id, gymId })}
                >
                  <span className="eqd-alt-thumb">
                    {alt.image ? (
                      <img src={alt.image.thumbUrl} alt="" loading="lazy" onError={hideBroken} />
                    ) : (
                      <span className="eqd-thumb-ph" aria-hidden />
                    )}
                  </span>
                  <span className="eqd-alt-name">{localizedEquipName(alt, locale)}</span>
                  {gym && (
                    <span className={`eqd-alt-flag${inGym(alt.id) ? ' on' : ''}`}>
                      {inGym(alt.id) ? (
                        <>
                          <Icon name="check-circle" weight="fill" /> {t.eqHere}
                        </>
                      ) : (
                        t.eqNotHere
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const hideBroken = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.display = 'none';
};
