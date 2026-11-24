/**
 * The "Superset with…" sheet (Supersets chunk): pick the exercises to alternate with the base one and group them. Moved out of the
 * session screen so the base carries none of it; the core opens it only through `supersetsHost` while Supersets is installed.
 */
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { ListRow } from '../components/ui/GroupedList';
import { useT } from '../i18n';
import { isStrengthExercise, nextSupersetLetter } from '../store';
import type { SupersetSheetProps } from '../supersetsApi';
import { Icon, Sheet, useExerciseName } from '../ui';
import { STRINGS } from './strings';

export function SupersetSheet(props: SupersetSheetProps) {
  const { t, locale } = useT();
  const cs = STRINGS[locale];
  const exName = useExerciseName();
  const [sel, setSel] = useState<string[]>([]);
  const letter = nextSupersetLetter(props.workout);
  const candidates = [...props.workout.exercises]
    .sort((a, b) => a.position - b.position)
    .filter((e) => e.id !== props.base.id && isStrengthExercise(e) && !e.groupId);

  function toggle(id: string): void {
    setSel((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]));
  }

  return (
    <Sheet onClose={props.onClose}>
      <h4 className="ss-sheet-title">{t.supersetWith}</h4>
      <p className="ss-sheet-sub">{cs.supersetWithBody(props.base.name)}</p>
      <div className="ss-pick-list">
        <div className="ss-pick-row">
          <span className="idx">{letter}1</span>
          <span className="n">{props.base.name}</span>
          <span className="meta">{cs.thisOne}</span>
        </div>
        {candidates.map((e) => {
          const si = sel.indexOf(e.id);
          const on = si >= 0;
          return (
            <ListRow
              key={e.id}
              dense
              dim={!on}
              time={on ? `${letter}${si + 2}` : undefined}
              label={exName(e.name)}
              check={on}
              onClick={() => toggle(e.id)}
            />
          );
        })}
      </div>
      <div className="sheet-note">
        <Icon name="info" />
        <p>{cs.supersetKeepNote}</p>
      </div>
      <div className="sheet-actions">
        <Button variant="secondary" className="grow" onClick={props.onClose}>
          {t.cancel}
        </Button>
        <Button
          variant="primary"
          className="grow"
          disabled={sel.length === 0}
          onClick={() => props.onGroup([props.base.id, ...sel])}
        >
          {cs.groupAs(letter)}
        </Button>
      </div>
    </Sheet>
  );
}
