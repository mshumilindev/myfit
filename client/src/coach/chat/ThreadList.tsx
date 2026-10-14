import { Badge } from '../../components/ui/Badge';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { useChatT } from '../../i18n/coachChat';
import { ClientAvatar } from '../ClientAvatar';
import type { CoachClient } from '../domain/types';
import { listTime } from './format';
import type { ChatThread } from './types';

export interface ThreadListProps {
  threads: readonly ChatThread[];
  /** clientId -> client (names, photos); a thread whose client is unknown shows the fallback name */
  clients: ReadonlyMap<string, CoachClient>;
  /** exact unread per client: the ONE source (useCoachUnreadState), the same numbers as the nav badge */
  unread: Readonly<Record<string, number>>;
  now: number;
  selectedId?: string | null;
  onOpen: (clientId: string) => void;
}

/**
 * The conversations (S-16 list): avatar, bold name, last line, time, exact unread badge next to each person
 * (1..9, "9+"). Unread rows are bold; the open thread shows no number anywhere. Sorted by last activity.
 */
export function ThreadList({ threads, clients, unread, now, selectedId, onOpen }: ThreadListProps) {
  const { ch, locale } = useChatT();
  const rows = [...threads]
    .filter((t) => t.active)
    .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
  return (
    <GroupedList list label={ch.chListLabel} className="ch-list">
      {rows.map((t) => {
        const c = clients.get(t.clientId);
        const name = c?.name ?? ch.chClient;
        const n = unread[t.clientId] ?? 0;
        const line =
          t.preview == null ? (
            <span className="ch-pv">{ch.chNoMessages}</span>
          ) : (
            <span className={n > 0 ? 'ch-pv is-new' : 'ch-pv'}>
              {t.lastFrom === 'trainer' ? ch.chYouPrefix : ''}
              {t.preview}
            </span>
          );
        return (
          <li key={t.cid}>
            <ListRow
              strong
              icon={<ClientAvatar id={t.clientId} name={name} size={40} hasPhoto={c?.hasPhoto} />}
              label={name}
              sub={line}
              value={t.lastAt != null ? listTime(t.lastAt, now, ch, locale) : undefined}
              trailing={
                n > 0 ? (
                  <span role="img" aria-label={ch.chUnreadLabel(n)} className="ch-bd">
                    <Badge n={n} />
                  </span>
                ) : undefined
              }
              selected={selectedId === t.clientId}
              aria-current={selectedId === t.clientId ? 'true' : undefined}
              onClick={() => onOpen(t.clientId)}
            />
          </li>
        );
      })}
    </GroupedList>
  );
}
