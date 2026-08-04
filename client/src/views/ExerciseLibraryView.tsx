/** Exercise library — design MG-5: the filter as a bar, one control in three
 * places (here, the exercise picker, Programs). Desktop-first screen. */
import { useMemo, useRef, useState } from 'react';
import { CURATED, secondaryMusclesOf, type MuscleGroup } from '../data/exercises';
import { EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import { knownExercises, recordWeight, useStore } from '../store';
import { muscleInfoByName } from '../data/exercises';
import { fmtDayMonth, LOCALE_IDS, useT } from '../i18n';
import { Icon, useIsDesktop } from '../ui';
import { MuscleIcon, MUSCLE_IDS } from '../components/Muscle';

interface Row {
  key: string;
  name: string;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: EquipmentId | null;
  lastTs: number | null;
  record: number;
}

export function ExerciseLibraryView({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const store = useStore();
  const isDesktop = useIsDesktop();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | undefined>(undefined);
  const [equip, setEquip] = useState<EquipmentId | undefined>(undefined);
  const [scope, setScope] = useState<'here' | 'all'>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const li = LOCALE_IDS.indexOf(locale);

  const gymCounts = new Map<string, number>();
  for (const w of store.workouts) {
    if (w.gymId) gymCounts.set(w.gymId, (gymCounts.get(w.gymId) ?? 0) + 1);
  }
  const homeGym =
    [...gymCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => store.gyms.find((g) => g.id === id))
      .find((g) => !!g?.inventory && g.inventory.length > 0) ?? null;

  const lastByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of store.workouts) {
      if (w.finishedAt === null) continue;
      for (const e of w.exercises) {
        const k = e.name.trim().toLowerCase();
        if (e.sets.length > 0 && (m.get(k) ?? 0) < w.startedAt) m.set(k, w.startedAt);
      }
    }
    return m;
  }, [store.workouts]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const c of CURATED) {
      const name = c.names[li] ?? c.names[0];
      out.push({
        key: c.id,
        name,
        primary: c.muscle === 'cardio' ? null : c.muscle,
        secondary: secondaryMusclesOf(c),
        equipment: c.equipment ?? null,
        lastTs: lastByName.get(name.toLowerCase()) ?? null,
        record: recordWeight(name),
      });
      for (const n of c.names) seen.add(n.toLowerCase());
    }
    for (const k of knownExercises()) {
      if (seen.has(k.name.toLowerCase())) continue;
      const info = muscleInfoByName(k.name);
      out.push({
        key: `hist-${k.name}`,
        name: k.name,
        primary: info && info.primary !== 'cardio' ? info.primary : null,
        secondary: info?.secondary ?? [],
        equipment: (info?.equipment as EquipmentId | null) ?? null,
        lastTs: lastByName.get(k.name.toLowerCase()) ?? null,
        record: recordWeight(k.name),
      });
    }
    return out;
  }, [li, lastByName]);

  const needle = q.trim().toLowerCase();
  const matches = rows
    .filter(
      (r) =>
        (!needle || r.name.toLowerCase().includes(needle)) &&
        (muscle === undefined || r.primary === muscle || r.secondary.includes(muscle)) &&
        (equip === undefined || r.equipment === equip),
    )
    .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0) || a.name.localeCompare(b.name));
  const shown = matches.slice(0, 40);

  const equipLabel = (id: string) => {
    const names = t.equipmentNames as Record<string, string>;
    return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
  };
  const unavailable = (r: Row): boolean =>
    scope === 'here' &&
    !!homeGym?.inventory &&
    !!r.equipment &&
    !homeGym.inventory.includes(r.equipment);

  return (
    <div className="screen exlib">
      <div className="exlib-top">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="title-26">{t.exercisesTitle}</h2>
          <div className="exlib-sub">{t.inLibraryMatch(rows.length, matches.length)}</div>
        </div>
        <button className="btn btn-secondary" onClick={() => searchRef.current?.focus()}>
          {t.newExercise}
        </button>
      </div>
      <div className="exlib-filters">
        <label className="exlib-search">
          <Icon name="magnifying-glass" />
          <input
            ref={searchRef}
            value={q}
            placeholder={t.searchExercises}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        {(muscle !== undefined || equip !== undefined) && (
          <div className="exlib-applied">
            {muscle !== undefined && (
              <button className="fchip active" onClick={() => setMuscle(undefined)}>
                {t.muscleGroups[muscle]}
              </button>
            )}
            {equip !== undefined && (
              <button className="fchip active" onClick={() => setEquip(undefined)}>
                {equipLabel(equip)}
              </button>
            )}
            <button
              className="fchip"
              onClick={() => {
                setMuscle(undefined);
                setEquip(undefined);
              }}
            >
              {t.clearLabel}
            </button>
          </div>
        )}
        {homeGym && (
          <div className="seg3 exlib-scope">
            <button className={scope === 'here' ? 'active' : ''} onClick={() => setScope('here')}>
              {t.availableHere}
            </button>
            <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
              {t.allGyms}
            </button>
          </div>
        )}
      </div>
      <div className="exlib-vocab">
        {MUSCLE_IDS.map((m) => (
          <button
            key={m}
            className={`vchip${muscle === m ? ' active' : ''}`}
            onClick={() => setMuscle((x) => (x === m ? undefined : m))}
          >
            {t.muscleGroups[m]}
          </button>
        ))}
        {isDesktop &&
          EQUIPMENT_IDS.slice(0, 6).map((id) => (
            <button
              key={id}
              className={`vchip${equip === id ? ' active' : ''}`}
              onClick={() => setEquip((x) => (x === id ? undefined : id))}
            >
              {equipLabel(id)}
            </button>
          ))}
      </div>
      <table className="table exlib-table">
        <thead>
          <tr>
            <th style={{ width: 30 }}></th>
            <th>{t.exerciseLabel}</th>
            <th style={{ width: 230 }}>{t.musclesCol}</th>
            <th style={{ width: 190 }}>{t.progEquipment}</th>
            <th style={{ width: 120 }}>{t.lastDoneCol}</th>
            <th style={{ width: 110 }}>{t.recordKg}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const off = unavailable(r);
            return (
              <tr key={r.key} className={off ? 'exlib-off' : ''}>
                <td>
                  {r.primary && <MuscleIcon muscle={r.primary} variant="chip" tone="primary" />}
                </td>
                <td>{r.name}</td>
                <td>
                  {r.primary && (
                    <>
                      <span className="exlib-primary">{t.muscleGroups[r.primary]}</span>
                      {r.secondary.length > 0 && (
                        <span className="exlib-secondary">
                          {' · '}
                          {r.secondary.map((x) => t.muscleGroups[x]).join(' · ')}
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="exlib-eq">
                  {r.equipment ? (
                    off ? (
                      <span className="exlib-miss">{t.notAtThisGym(equipLabel(r.equipment))}</span>
                    ) : (
                      equipLabel(r.equipment)
                    )
                  ) : (
                    '—'
                  )}
                </td>
                <td className="exlib-last">{r.lastTs ? fmtDayMonth(r.lastTs, locale) : t.never}</td>
                <td className="exlib-rec">{r.record > 0 ? `${r.record} kg` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="exlib-note">{t.filtersCombineNote}</p>
    </div>
  );
}
