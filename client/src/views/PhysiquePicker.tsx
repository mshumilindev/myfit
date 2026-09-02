/**
 * Physique picker (Goals · design GL-02/02b). Sex-aware archetype cards — each
 * previews its shape on the muscle map (grow muscles lit). Choosing one sets the
 * physique target and seeds those muscles to grow in the block focus (additive —
 * existing emphasis is kept). Cards render the body-muscles map for now; the
 * stylised silhouettes swap in here once available.
 */
import { useState, useEffect } from 'react';
import { useT } from '../i18n';
import { useStore, setPhysiqueTarget, setBlockFocus } from '../store';
import { Sheet, Icon } from '../ui';
import { ARCHETYPES, ARCHETYPES_BY_SEX, type ArchetypeId, type Emphasis } from '../goals';
import type { FocusMuscle } from '../data/subregions';

export function PhysiquePicker({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const cur = store.goals.physique;
  // If the account states a sex, lock to it (no toggle); otherwise let the user pick.
  const accountSex = store.bodyMetrics.sex;
  const [sexState, setSexState] = useState<'male' | 'female'>(cur?.sex ?? 'male');
  const sex = accountSex ?? sexState;
  const [picked, setPicked] = useState<ArchetypeId | null>(cur?.archetype ?? null);
  const [hoverId, setHoverId] = useState<ArchetypeId | null>(null);

  const ids = ARCHETYPES_BY_SEX(sex);

  // Preload the highlighted variants so the hover/active swap is instant.
  // Depend on the primitive `sex` (not `ids`) so the React Compiler can't
  // create a temporal-dead-zone reference to `ids` in the effect.
  useEffect(() => {
    for (const id of ARCHETYPES_BY_SEX(sex)) {
      const img = new Image();
      img.src = `/physiques/${id}-lit.png`;
    }
  }, [sex]);

  const use = () => {
    if (!picked) return;
    setPhysiqueTarget({ archetype: picked, sex, setAt: Date.now() });
    // Seed the archetype's grow muscles into the block focus, keeping any
    // emphasis the athlete already set.
    const prev = store.goals.focus;
    const emphasis: Partial<Record<FocusMuscle, Emphasis>> = { ...(prev?.emphasis ?? {}) };
    for (const m of ARCHETYPES[picked].grow) emphasis[m] = 'grow';
    setBlockFocus({
      label: prev?.label ?? 'Block 1',
      startedAt: prev?.startedAt ?? Date.now(),
      weeks: prev?.weeks ?? 6,
      emphasis,
    });
    onClose();
  };

  return (
    <Sheet onClose={onClose} className="phys-sheet">
      <div className="sheet-head with-back">
        <button className="sheet-back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="t">{t.goalsPhysiqueTitle}</span>
        {cur && (
          <button
            className="phys-remove"
            onClick={() => {
              setPhysiqueTarget(undefined);
              onClose();
            }}
          >
            {t.physRemove}
          </button>
        )}
      </div>

      <p className="phys-intro">{t.physIntro}</p>

      {!accountSex && (
        <div className="phys-sex seg3">
          <button className={sex === 'male' ? 'active' : ''} onClick={() => setSexState('male')}>
            {t.sexMale}
          </button>
          <button className={sex === 'female' ? 'active' : ''} onClick={() => setSexState('female')}>
            {t.sexFemale}
          </button>
        </div>
      )}

      <div className="phys-grid">
        {ids.map((id) => (
          <button
            key={id}
            className={`phys-card${picked === id ? ' active' : ''}`}
            onClick={() => setPicked(id)}
            onMouseEnter={() => setHoverId(id)}
            onMouseLeave={() => setHoverId((h) => (h === id ? null : h))}
          >
            {picked === id && <Icon name="check-circle" weight="fill" className="phys-check" />}
            <img
              className="phys-fig"
              src={`/physiques/${id}${picked === id || hoverId === id ? '-lit' : ''}.png`}
              alt=""
            />
            <div className="phys-name">{t.archetypes[id].name}</div>
            <div className="phys-blurb">{t.archetypes[id].blurb}</div>
          </button>
        ))}
      </div>

      <button className="btn btn-primary phys-use" disabled={!picked} onClick={use}>
        {t.physUseThis}
      </button>
    </Sheet>
  );
}
