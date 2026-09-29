import type { DragEvent, KeyboardEvent } from 'react';
import { Icon } from '../../ui';
import './DragHandle.css';

export interface DragHandleProps {
  /** Accessible name, e.g. "Drag Nudges". */
  label: string;
  /** Pinned items can't move: a faint pin instead of the grip, not draggable. */
  pinned?: boolean;
  /** The item is being dragged right now. */
  dragging?: boolean;
  onDragStart?: (e: DragEvent<HTMLSpanElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLSpanElement>) => void;
  /** Keyboard path: ↑ / ↓ on the focused handle move the item by one. */
  onMove?: (dir: -1 | 1) => void;
  className?: string;
}

/** ⋮⋮ grip to reorder by drag & drop (native HTML5 DnD, desktop). Focusable;
 *  the arrow keys move the item, so it's never mouse-only. */
export function DragHandle({
  label,
  pinned = false,
  dragging = false,
  onDragStart,
  onDragEnd,
  onMove,
  className,
}: DragHandleProps) {
  const cls = ['uidrag', pinned ? 'is-pinned' : '', dragging ? 'is-dragging' : '', className]
    .filter(Boolean)
    .join(' ');
  if (pinned)
    return (
      <span className={cls} aria-hidden="true">
        <Icon name="push-pin" />
      </span>
    );
  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (!onMove) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      onMove(e.key === 'ArrowUp' ? -1 : 1);
    }
  };
  return (
    <span
      className={cls}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-roledescription="drag handle"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={onKeyDown}
    >
      <Icon name="dots-six" weight="bold" />
    </span>
  );
}
