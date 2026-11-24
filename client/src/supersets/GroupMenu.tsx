import { ListRow } from '../components/ui/GroupedList';
import { useT } from '../i18n';
import type { SupersetGroupMenuProps } from '../supersetsApi';
import { IconTile } from '../components/ui/IconTile';
import { Sheet, useExerciseName } from '../ui';

/** The menu of one superset in the session list: ungroup, add an exercise, open a member. */
export function SupersetGroupMenu(p: SupersetGroupMenuProps) {
  const { t } = useT();
  const exName = useExerciseName();
  return (
    <Sheet padded={false} onClose={p.onClose}>
      <div className="sheet-label">{t.supersetTag(p.letter)}</div>
      <ListRow icon={<IconTile icon="x" />} label={t.ungroup} onClick={p.onUngroup} />
      <ListRow icon={<IconTile icon="plus" />} label={t.addExercise} onClick={p.onAdd} />
      <div className="sheet-rule" />
      {p.members.map((e) => (
        <ListRow
          key={e.id}
          icon={<IconTile icon="dots-three-vertical" />}
          label={exName(e.name)}
          onClick={() => p.onOpenMember(e.id)}
        />
      ))}
    </Sheet>
  );
}
