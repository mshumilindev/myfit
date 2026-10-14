import type { ReactNode, RefObject } from 'react';
import { ChatComposer } from '../../../components/ui/ChatComposer';
import { ConfirmEffectsDialog } from '../../../components/ui/ConfirmEffectsDialog';
import { MessageMenu, type MessageMenuItem } from '../../../components/ui/MessageMenu';
import { MAX_TEXT, type ChatMessage as Msg } from '../types';
import type { ChatWords } from './useThreadCore';

/** The composer with the strings every thread shares (send, empty reason, limit, encryption note). */
export function ThreadComposer(p: {
  ch: ChatWords;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  allowEmpty: boolean;
  placeholder: string;
  lead?: ReactNode;
  chips?: ReactNode;
}) {
  const { ch } = p;
  return (
    <div className="ch-comp">
      <ChatComposer
        value={p.value}
        onChange={p.onChange}
        onSend={p.onSend}
        allowEmpty={p.allowEmpty}
        placeholder={p.placeholder}
        sendLabel={ch.chSend}
        emptyReason={ch.chSendNeedsText}
        maxLength={MAX_TEXT}
        tooLongText={ch.chTooLong(MAX_TEXT)}
        footnote={ch.chEncNote}
        lead={p.lead}
        chips={p.chips}
      />
    </div>
  );
}

/** The thread's menu: one message's (Copy / Delete) or the head's (Clear chat and the host's own items). */
export function ThreadMenu(p: {
  ch: ChatWords;
  menu: string | null;
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** the open message and its items */
  msg?: Msg;
  data: { items: MessageMenuItem[]; rule?: string } | null;
  headItems: MessageMenuItem[];
}) {
  const { ch, menu, msg, data } = p;
  const textMsg = msg && !msg.deleted && !msg.unverified && msg.body.kind === 'text' ? msg : null;
  return (
    <MessageMenu
      open={menu !== null && (menu === 'head' || !!data)}
      onClose={p.onClose}
      anchorRef={p.anchor}
      label={menu === 'head' ? ch.chMenuChat : ch.chMenuMsg}
      items={menu === 'head' ? p.headItems : (data?.items ?? [])}
      rule={menu === 'head' ? undefined : data?.rule}
      preview={textMsg && textMsg.body.kind === 'text' ? textMsg.body.text : undefined}
    />
  );
}

/** Confirm deleting one of my text messages (8 s Undo afterwards). */
export function DeleteMessageDialog(p: {
  ch: ChatWords;
  first: string;
  quote: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { ch, first } = p;
  return (
    <ConfirmEffectsDialog
      title={ch.chDelTitle}
      body={ch.chDelBody(first)}
      quote={p.quote}
      effects={[{ icon: 'eye-slash', text: ch.chDelWho(first) }]}
      small={ch.chUndoSmall}
      confirmLabel={ch.chDelConfirm}
      cancelLabel={ch.chCancel}
      onCancel={p.onCancel}
      onConfirm={p.onConfirm}
    />
  );
}

/** Confirm clearing the chat for me (8 s Undo afterwards). */
export function ClearChatDialog(p: {
  ch: ChatWords;
  first: string;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { ch, first } = p;
  return (
    <ConfirmEffectsDialog
      title={ch.chClearTitle}
      body={ch.chClearBody(first)}
      effects={[
        { icon: 'eye-slash', text: ch.chClearWho(p.count) },
        { icon: 'lock-simple', text: ch.chClearKeeps(first) },
      ]}
      small={ch.chUndoSmall}
      confirmLabel={ch.chClearConfirm}
      cancelLabel={ch.chCancel}
      onCancel={p.onCancel}
      onConfirm={p.onConfirm}
    />
  );
}
