import { BackButton } from '../../../../components/ui/BackButton';
import { IconButton } from '../../../../components/ui/Button';
import type { ChatStrings } from '../../../../i18n/coachChat';
import type { ClientStrings } from '../../../../i18n/coachClient';
import { ClientAvatar } from '../../../ClientAvatar';
import { clock } from '../../../chat/format';

/** Head of the client chat: Back, trainer, What they see (eye), Notes (pencil + dot), menu. */
export function ClientChatBar({
  cc,
  ch,
  trainer,
  lastSeenAt,
  first,
  notesCount,
  notesOpen,
  menuOpen,
  onBack,
  onOpenSharing,
  onOpenNotes,
  onOpenMenu,
}: {
  cc: ClientStrings;
  ch: ChatStrings;
  trainer: { id: string; name: string; hasPhoto?: boolean };
  lastSeenAt?: number | null;
  first: string;
  notesCount: number;
  notesOpen: boolean;
  menuOpen: boolean;
  onBack: () => void;
  onOpenSharing: () => void;
  onOpenNotes: () => void;
  onOpenMenu: (el: HTMLElement) => void;
}) {
  return (
    <div className="ch-bar ctl-row--md">
      <BackButton label={cc.ccBack} onClick={onBack} />
      <ClientAvatar id={trainer.id} name={trainer.name} size={36} hasPhoto={trainer.hasPhoto} />
      <div className="ch-bar-id">
        <b>{trainer.name}</b>
        <small>{cc.chRole(lastSeenAt ? cc.chSeen(clock(lastSeenAt)) : cc.ccTrainer)}</small>
      </div>
      <IconButton icon="eye" label={cc.chSeesBtn(first)} onClick={onOpenSharing} />
      <span className="cc-notebtn">
        <IconButton
          icon="pencil-simple"
          label={notesCount > 0 ? cc.chNotesAria(notesCount) : cc.chNotesBtn}
          aria-expanded={notesOpen}
          onClick={onOpenNotes}
        />
        {notesCount > 0 && <span className="cc-dot" aria-hidden />}
      </span>
      <IconButton
        icon="dots-three"
        label={ch.chMenuChat}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => onOpenMenu(e.currentTarget)}
      />
    </div>
  );
}
