import type { ReactNode } from 'react';
import { Card } from './Card';
import { IconTile } from './IconTile';
import './StepList.css';

export interface StepItem {
  id: string;
  icon: string;
  title: string;
  body: ReactNode;
}

/**
 * "What happens next" (C-15): a list of consequences inside one card, each a kit `IconTile`, a bold
 * title and one or two plain lines (Program, Result check, <name> sees, Message to <name>). Not a
 * `ListRow`: the body may hold block content (a Textarea and Buttons while the message is edited),
 * which ListRow's inline `sub` span cannot host validly.
 */
export function StepList({ items, label }: { items: StepItem[]; label: string }) {
  return (
    <Card pad="none" className="uisteplist">
      <ul className="uisteplist-list" aria-label={label}>
        {items.map((it) => (
          <li key={it.id} className="uisteplist-row">
            <IconTile icon={it.icon} size={30} />
            <div className="uisteplist-t">
              <div className="uisteplist-title">{it.title}</div>
              <div className="uisteplist-body">{it.body}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
