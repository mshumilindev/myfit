import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import type { LocaleId } from '../../../i18n';
import type { RosterStrings } from '../../../i18n/coachRoster';
import type { RosterRow } from '../../domain/roster';
import type { Signal, Slot } from '../../domain/types';
import { ClientAvatar } from '../../ClientAvatar';
import { RosterDetailBody } from './RosterDetail';

/** The selected client's card: avatar, goal, Message / Open client, and the detail rows. */
export function RosterDetailCard(p: {
  row: RosterRow;
  r: RosterStrings;
  now: number;
  locale: LocaleId;
  slots: readonly Slot[];
  signals: readonly Signal[];
  onChat: () => void;
  onOpen: (id: string) => void;
}) {
  const { row } = p;
  return (
    <Card as="section" pad="lg" aria-label={row.client.name}>
      <div className="ro-det-top">
        <ClientAvatar
          id={row.client.id}
          name={row.client.name}
          hasPhoto={row.client.hasPhoto}
          size={56}
        />
        <span className="ro-det-id">
          <b>{row.client.name}</b>
          {row.client.goal ? <small>{row.client.goal}</small> : null}
        </span>
        <span className="ro-det-btns">
          <Button variant="ghost" icon="envelope" onClick={p.onChat}>
            {p.r.roMessage}
          </Button>
          <Button
            variant="primary"
            iconTrailing="arrow-right"
            onClick={() => p.onOpen(row.client.id)}
          >
            {p.r.roOpenClient}
          </Button>
        </span>
      </div>
      <RosterDetailBody
        row={row}
        r={p.r}
        now={p.now}
        locale={p.locale}
        slots={p.slots}
        signals={p.signals}
      />
    </Card>
  );
}
