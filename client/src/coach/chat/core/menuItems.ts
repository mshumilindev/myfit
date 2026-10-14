import type { MessageMenuItem } from '../../../components/ui/MessageMenu';
import type { ChatMessage as Msg } from '../types';
import type { ChatWords } from './useThreadCore';

/**
 * Items of one message's menu. Text: Copy + Delete (own; the other person's is disabled with a hint). Share:
 * Delete only. `rule` is the "who sees the deletion" line, shown for own messages.
 */
export function messageMenuItems(o: {
  m: Msg;
  mine: boolean;
  first: string;
  ch: ChatWords;
  copy: (text: string) => void;
  askDelete: (id: string) => void;
}): { items: MessageMenuItem[]; rule?: string } {
  const { m, mine, first, ch } = o;
  const rule = mine ? ch.chDeleteRule(first) : undefined;
  if (m.body.kind === 'share') {
    return {
      items: [
        {
          id: 'del',
          icon: 'trash',
          label: ch.chDelete,
          danger: true,
          onSelect: () => o.askDelete(m.id),
        },
      ],
      rule,
    };
  }
  const text = m.body.kind === 'text' ? m.body.text : '';
  return {
    items: [
      { id: 'copy', icon: 'copy', label: ch.chCopy, onSelect: () => o.copy(text) },
      mine
        ? {
            id: 'del',
            icon: 'trash',
            label: ch.chDelete,
            danger: true,
            onSelect: () => o.askDelete(m.id),
          }
        : {
            id: 'del',
            icon: 'trash',
            label: ch.chDelete,
            disabled: true,
            hint: ch.chDeleteTheirs(first),
            onSelect: () => undefined,
          },
    ],
    rule,
  };
}
