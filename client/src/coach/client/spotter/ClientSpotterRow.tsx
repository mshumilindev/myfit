import { Badge } from '../../../components/ui/Badge';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { useClientT } from '../../../i18n/coachClient';
import { coachClock, coachDayMonth } from '../../format';
import type { ClientSpotterPort } from './clientSpotterPort';
import { useClientSpotter } from './useClientSpotter';

/**
 * The pinned Spotter line (SPO-236, board C4): the first line above the chat with the trainer. It is always there (it
 * cannot be removed or archived), with the unread count and the time of the newest message.
 */
export function ClientSpotterRow({
  onOpen,
  port,
}: {
  onOpen: () => void;
  port?: ClientSpotterPort;
}) {
  const { cc, locale } = useClientT();
  const { feed } = useClientSpotter(port);
  const last = feed?.items[0];
  return (
    <GroupedList list label={cc.spListLabel}>
      <li>
        <ListRow
          strong={(feed?.unread ?? 0) > 0}
          icon={<IconTile tone="accent" size={30} icon="envelope" />}
          label={cc.spTitle}
          sub={cc.spSub}
          value={
            last
              ? `${coachDayMonth(last.createdAt, locale)} ${coachClock(last.createdAt)}`
              : undefined
          }
          trailing={feed && feed.unread > 0 ? <Badge n={feed.unread} /> : undefined}
          chevron
          onClick={onOpen}
        />
      </li>
    </GroupedList>
  );
}
