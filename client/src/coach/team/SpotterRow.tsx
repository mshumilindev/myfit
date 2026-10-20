import { Badge } from '../../components/ui/Badge';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { useTeamT } from '../../i18n/coachTeam';
import { coachClock, coachDayMonth } from '../format';
import type { SpotterFeed } from './types';

/** The pinned Spotter line at the top of the Chat list (SPO-236): the newest team message and the unread count. */
export function SpotterRow({ feed, onOpen }: { feed: SpotterFeed; onOpen: () => void }) {
  const { tm, locale } = useTeamT();
  const last = feed.items[0];
  if (!last) return null;
  return (
    <GroupedList list label={tm.spListLabel}>
      <li>
        <ListRow
          strong
          icon={<IconTile tone="accent" size={40} icon="envelope" />}
          label={tm.spTitle}
          sub={tm.spSub}
          value={`${coachDayMonth(last.createdAt, locale)} ${coachClock(last.createdAt)}`}
          trailing={feed.unread > 0 ? <Badge n={feed.unread} /> : undefined}
          onClick={onOpen}
        />
      </li>
    </GroupedList>
  );
}
