import { GroupedList } from '../../../components/ui/GroupedList';
import { ClientRow } from '../../../components/ui/RosterRows';
import type { RosterStrings } from '../../../i18n/coachRoster';
import type { RosterRow } from '../../domain/roster';
import { ClientAvatar } from '../../ClientAvatar';
import { firstName, modeLabel, statusLabel } from '../format';

/** The client rows. On desktop a click selects (detail pane), on a phone it opens the client. */
export function RosterList(p: {
  list: readonly RosterRow[];
  r: RosterStrings;
  desktop: boolean;
  inviteOpen: boolean;
  selectedId: string | undefined;
  unread: Readonly<Record<string, number>>;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <GroupedList list label={p.r.roListLabel}>
      {p.list.map((x) => {
        const c = x.client;
        const nameFirst = firstName(c.name);
        return (
          <li key={c.id}>
            <ClientRow
              name={c.name}
              avatar={<ClientAvatar id={c.id} name={c.name} hasPhoto={c.hasPhoto} size={40} />}
              program={c.program}
              weekLabel={c.mode === 'program' ? p.r.c3NotLogged : p.r.roWeek(c.done, c.planned)}
              status={x.status}
              statusLabel={statusLabel(p.r, x.status)}
              signalCount={x.signalCount}
              signalLabel={p.r.roSignalsN(x.signalCount)}
              logMode={{ mode: c.mode, label: modeLabel(p.r, c.mode) }}
              unread={p.unread[c.id] ?? 0}
              unreadLabel={
                p.unread[c.id] ? p.r.c3MessageUnread(nameFirst, p.unread[c.id]) : undefined
              }
              selected={p.desktop && !p.inviteOpen && x.client.id === p.selectedId}
              onClick={() => (p.desktop ? p.onSelect(c.id) : p.onOpen(c.id))}
              ariaLabel={`${c.name}, ${c.program}, ${statusLabel(p.r, x.status)}`}
            />
          </li>
        );
      })}
    </GroupedList>
  );
}
