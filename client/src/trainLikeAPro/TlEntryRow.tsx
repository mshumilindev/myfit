import { Card } from '../components/ui/Card';
import { ListRow } from '../components/ui/GroupedList';
import { useT } from '../i18n';
import { STRINGS } from './strings';

/** The one quiet row on Programs that opens the catalog. */
export function TlEntryRow({ onOpen }: { onOpen: () => void }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  return (
    <Card pad="none" emphasis="card">
      <ListRow strong label={s.name} sub={s.entrySub} onClick={onOpen} />
    </Card>
  );
}
