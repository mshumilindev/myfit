import { Badge } from '../../components/ui/Badge';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { useTeamT } from '../../i18n/coachTeam';
import { coachClock, coachDayMonth } from '../format';
import type { SpotterFeed } from './types';

/** The pinned Spotter line at the top of the Chat list (SPO-236): always there (never removed or archived), with the newest team message and the unread count when there are any. */
export function SpotterRow({ feed, onOpen }: { feed: SpotterFeed; onOpen: () => void }) {
  const { tm, locale } = useTeamT();
  const last = feed.items[0];
  return (
    <GroupedList list label={tm.spListLabel}>
      <li>
        <ListRow
          strong
          icon={<IconTile tone="accent" size={40} icon="envelope" />}
          label={tm.spTitle}
          sub={tm.spSub}
          value={
            last
              ? `${coachDayMonth(last.createdAt, locale)} ${coachClock(last.createdAt)}`
              : undefined
          }
          trailing={feed.unread > 0 ? <Badge n={feed.unread} /> : undefined}
          onClick={onOpen}
        />
      </li>
    </GroupedList>
  );
}
