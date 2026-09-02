/**
 * Focus editor (Goals · design GL-03): set each fine muscle to grow / hold /
 * ease for the current block. A live FocusBodyMap tints grow (accent) and ease
 * (danger) as you go. Saved onto goals.focus; absent = hold. Fine granularity —
 * the three delt heads, upper/lower chest — is the whole point.
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { useStore, setBlockFocus } from '../store';
import { Sheet, Icon } from '../ui';
import { FocusBodyMap } from '../components/Muscle';
import { FOCUS_MUSCLES, focusToGroup, type FocusMuscle } from '../data/subregions';
import type { Emphasis } from '../goals';

type Grp = { key: 'grpShoulders' | 'grpChest' | 'grpBack' | 'grpLegs' | 'grpArms' | 'grpCore'; muscles: FocusMuscle[] };
const GROUPS: Grp[] = [
  { key: 'grpShoulders', muscles: ['delt-front', 'delt-side', 'delt-rear'] },
  { key: 'grpChest', muscles: ['chest-upper', 'chest-lower'] },
  { key: 'grpBack', muscles: ['lats', 'traps', 'lower_back'] },
  { key: 'grpLegs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { key: 'grpArms', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'grpCore', muscles: ['abs'] },
];

export function FocusEditor({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const [emphasis, setEmphasis] = useState<Partial<Record<FocusMuscle, Emphasis>>>(
    store.goals.focus?.emphasis ?? {},
  );

  const muscleLabel = (f: FocusMuscle): string =>
    t.subMuscleNames[f] ?? t.muscleGroups[focusToGroup(f)];
  const set = (f: FocusMuscle, e: Emphasis) =>
    setEmphasis((prev) => {
      const next = { ...prev };
      if (e === 'hold') delete next[f];
      else next[f] = e;
      return next;
    });

  const grow = FOCUS_MUSCLES.filter((f) => emphasis[f] === 'grow');
  const ease = FOCUS_MUSCLES.filter((f) => emphasis[f] === 'ease');
  const held = FOCUS_MUSCLES.length - grow.length - ease.length;

  const save = () => {
    const prev = store.goals.focus;
    setBlockFocus({
      label: prev?.label ?? 'Block 1',
      startedAt: prev?.startedAt ?? Date.now(),
      weeks: prev?.weeks ?? 6,
      emphasis,
    });
    onClose();
  };

  const segs: Emphasis[] = ['ease', 'hold', 'grow'];
  const segLabel = (e: Emphasis) => (e === 'ease' ? t.emphEase : e === 'hold' ? t.emphHold : t.emphGrow);

  return (
    <Sheet onClose={onClose} className="focus-sheet">
      <div className="sheet-head with-back">
        <button className="sheet-back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="t">{t.focusTitle}</span>
        <button className="focus-reset" onClick={() => setEmphasis({})}>
          {t.focusReset}
        </button>
      </div>

      <div className="focus-map-row">
        <FocusBodyMap grow={grow} ease={ease} view="both" width={132} />
        <p className="focus-hint">{t.focusHint}</p>
      </div>

      <div className="focus-rows">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <div className="focus-grp">{t[g.key]}</div>
            {g.muscles.map((f) => {
              const e: Emphasis = emphasis[f] ?? 'hold';
              return (
                <div className="focus-row" key={f}>
                  <span className={`focus-dot ${e}`} />
                  <span className="focus-name">{muscleLabel(f)}</span>
                  <div className="focus-seg">
                    {segs.map((s) => (
                      <button
                        key={s}
                        className={e === s ? `on-${s}` : ''}
                        onClick={() => set(f, s)}
                      >
                        {segLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="focus-foot">
        <span className="focus-count">{t.focusSummary(grow.length, ease.length, held)}</span>
        <button className="btn btn-primary" onClick={save}>
          {t.focusSaveBtn}
        </button>
      </div>
    </Sheet>
  );
}
