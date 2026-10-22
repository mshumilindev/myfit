/** "What Spotter knows about you" (SPO-295 N5): one row per area, the data copy (N6) and the account deletion. */
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { useDeleteT } from '../../i18n/accountDelete';
import { useMyDataT } from '../../i18n/myData';
import { AREA_LOOK, AREA_ORDER, type AreaId } from './areas';
import { MyDataFrame } from './MyDataFrame';

export function MyDataOverview({
  onBack,
  onOpen,
  onExport,
  onDeleteAccount,
}: {
  onBack: () => void;
  onOpen: (a: AreaId) => void;
  onExport: () => void;
  onDeleteAccount: () => void;
}) {
  const m = useMyDataT();
  const d = useDeleteT();
  return (
    <MyDataFrame title={m.title} sub={m.sub} onBack={onBack}>
      <Notice tone="neutral" icon="info">
        {m.notice}
      </Notice>
      <GroupedList header={m.groupData}>
        {AREA_ORDER.map((a) => (
          <ListRow
            key={a}
            icon={<IconTile tone={AREA_LOOK[a].tone} size={30} icon={AREA_LOOK[a].icon} />}
            label={m.areas[a].title}
            sub={m.areas[a].sub}
            chevron
            onClick={() => onOpen(a)}
          />
        ))}
      </GroupedList>
      <GroupedList header={m.groupTake} footer={m.takeFoot}>
        <ListRow
          icon={<IconTile size={30} icon="download-simple" />}
          label={m.takeLabel}
          chevron
          onClick={onExport}
        />
      </GroupedList>
      <GroupedList header={m.groupDelete}>
        <ListRow action tone="danger" label={d.rowLabel} onClick={onDeleteAccount} />
      </GroupedList>
    </MyDataFrame>
  );
}
