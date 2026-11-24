import { useT } from '../i18n';
import { Icon } from '../ui';
import { STRINGS } from './strings';

/** The note under the set-type list: a drop is still one set. */
export function TypeNote() {
  const { locale } = useT();
  const s = STRINGS[locale];
  return (
    <div className="sheet-note umt-8">
      <Icon name="info" />
      <p>
        {s.noteA}
        <strong>{s.noteStrong}</strong>
        {s.noteB}
      </p>
    </div>
  );
}
