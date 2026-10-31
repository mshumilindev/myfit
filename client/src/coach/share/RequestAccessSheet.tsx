import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Notice } from '../../components/ui/Notice';
import { Sheet } from '../../components/ui/Overlays';
import { useT } from '../../i18n';
import { useClientT, type ClientStrings } from '../../i18n/coachClient';
import type { Level } from '../domain/types';
import { levelWord } from '../client/labels';
import { shareRowMeta } from '../client/shareLabels';
import { SHARE_GROUPS, type ShareGroupId, type ShareId } from '../client/shareModel';
import { requestableIds, type AskPause } from './accessAsk';
import '../client/ClientCoach.css';

export interface RequestAccessSheetProps {
  /** Client's first name. */
  first: string;
  /** What the client already shares (their six grant levels; the four on-device rows are never known here). */
  shared: Partial<Record<ShareId, Level>>;
  /** The client's mode is `program`: no app, nothing can be sent. */
  noApp?: boolean;
  /** No conversation with this client yet. */
  noChat?: boolean;
  pause?: AskPause;
  /** Rows ticked when the sheet opens. */
  initial?: readonly ShareId[];
  /** Resolves when the message is queued; the sheet closes after. */
  onSend: (cats: ShareId[]) => void;
  onClose: () => void;
}

const GROUP_TITLE = (cc: ClientStrings, id: ShareGroupId): string =>
  id === 'training' ? cc.shGroupTraining : id === 'body' ? cc.shGroupBody : cc.shGroupLife;

/** "Request access" (SPO-99): the trainer ticks what they need from the whole sharing list; the client decides levels. */
export function RequestAccessSheet(p: RequestAccessSheetProps) {
  const { cc, locale } = useClientT();
  const { t } = useT();
  const open = useMemo(() => new Set(requestableIds(p.shared)), [p.shared]);
  const [picked, setPicked] = useState<ReadonlySet<ShareId>>(
    () => new Set((p.initial ?? []).filter((id) => requestableIds(p.shared).includes(id))),
  );
  const blocked = !!p.noApp || !!p.noChat || !!p.pause?.blocked;
  const toggle = (id: ShareId, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const have = SHARE_GROUPS.flatMap((g) => g.ids).filter((id) => !open.has(id));
  const when = p.pause?.blocked
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(p.pause.until)
    : '';
  const send = () => {
    const cats = SHARE_GROUPS.flatMap((g) => g.ids).filter((id) => picked.has(id));
    if (!blocked && cats.length) p.onSend(cats);
  };
  return (
    <Sheet onClose={p.onClose} label={cc.raTitle(p.first)} closeLabel={cc.ccDone} padded>
      <div className="cc-stack">
        <span className="ut-lg ut-w7">{cc.raTitle(p.first)}</span>
        {p.noApp ? (
          <Notice tone="neutral" icon="lock-simple" below={cc.raNoAppBody(p.first)}>
            {cc.raNoAppTitle(p.first)}
          </Notice>
        ) : (
          <p className="ut-sm ut-muted">{cc.raLead(p.first)}</p>
        )}
        {p.noChat && !p.noApp && (
          <Notice tone="neutral" icon="chat-circle">
            {cc.raNoChat}
          </Notice>
        )}
        {p.pause?.blocked && !p.noApp && (
          <Notice
            tone="neutral"
            icon="clock"
            below={p.pause.reason === 'declined' ? cc.raPauseDeclined(when) : cc.raPauseBody(when)}
          >
            {cc.raPauseTitle}
          </Notice>
        )}
        {SHARE_GROUPS.map((g) => {
          const ids = g.ids.filter((id) => open.has(id));
          if (!ids.length) return null;
          return (
            <GroupedList key={g.id} header={GROUP_TITLE(cc, g.id)} label={GROUP_TITLE(cc, g.id)}>
              {ids.map((id) => {
                const m = shareRowMeta(id, cc, t);
                return (
                  <ListRow
                    key={id}
                    as="label"
                    icon={<IconTile tone={m.tone} size={30} icon={m.icon} />}
                    label={m.title}
                    sub={m.sees.effects}
                    disabled={blocked}
                    trailing={
                      <Checkbox
                        checked={picked.has(id)}
                        disabled={blocked}
                        aria-label={m.title}
                        onChange={(v) => toggle(id, v)}
                      />
                    }
                  />
                );
              })}
            </GroupedList>
          );
        })}
        {open.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={blocked}
            onClick={() => setPicked(new Set(open))}
          >
            {cc.raEverything}
          </Button>
        )}
        {have.length > 0 && (
          <GroupedList header={cc.raHave} label={cc.raHave}>
            {have.map((id) => (
              <ListRow
                key={id}
                label={shareRowMeta(id, cc, t).title}
                value={levelWord(cc, p.shared[id] ?? 'off')}
              />
            ))}
          </GroupedList>
        )}
        <Button variant="primary" fullWidth disabled={blocked || picked.size === 0} onClick={send}>
          {picked.size ? cc.raSend(picked.size) : cc.raSendNone}
        </Button>
        <p className="ut-sm ut-muted">{cc.raFoot(p.first)}</p>
      </div>
    </Sheet>
  );
}
