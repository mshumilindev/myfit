/**
 * Physique picker (Goals · design GL-02/02b). Sex-aware archetype cards — each
 * previews its shape on the muscle map (grow muscles lit). Choosing one sets the
 * physique target and seeds those muscles to grow in the block focus (additive —
 * existing emphasis is kept). Cards render the body-muscles map for now; the
 * stylised silhouettes swap in here once available.
 */
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Segmented } from '../components/ui/Segmented';
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
      <div className="sheet-head">
        <span className="t">{t.goalsPhysiqueTitle}</span>
        {cur && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setPhysiqueTarget(undefined);
              onClose();
            }}
          >
            {t.physRemove}
          </Button>
        )}
      </div>

      <p className="phys-intro">{t.physIntro}</p>

      {!accountSex && (
        <Segmented
          className="phys-sex"
          value={sex}
          onChange={setSexState}
          options={[
            { value: 'male', label: t.sexMale },
            { value: 'female', label: t.sexFemale },
          ]}
        />
      )}

      <div className="phys-grid">
        {ids.map((id) => (
          <Card
            as="button"
            pad="none"
            emphasis="quiet"
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
          </Card>
        ))}
      </div>

      <Button variant="primary" className="phys-use" disabled={!picked} onClick={use}>
        {t.physUseThis}
      </Button>
    </Sheet>
  );
}
