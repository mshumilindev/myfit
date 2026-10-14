import { useRef, type ReactNode, type RefObject } from 'react';
import { Icon } from '../../ui';
import { ListRow } from './GroupedList';
import { Notice } from './Notice';
import { Popover } from './Popover';
import { Sheet } from './Overlays';
import { COACH_BREAKPOINT, useMinWidth } from './breakpoints';
import './MessageMenu.css';

export interface MessageMenuItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Why it is disabled, or a short qualifier ("Only your copy"); shown under the label. */
  hint?: string;
  onSelect: () => void;
}

export interface MessageMenuProps {
  open: boolean;
  onClose: () => void;
  /** The "..." button (desktop popover points at it). */
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  items: readonly MessageMenuItem[];
  /** A quiet sentence under the items ("You can delete only your own messages"). */
  rule?: ReactNode;
  /** Phone sheet: the message being acted on, quoted above the items. */
  preview?: string;
}

/**
 * Actions of one chat message or of the chat header (kit group `Coach/Message menu`): a glass popover next to
 * the "..." button from the Coach breakpoint up, a bottom sheet below it (long press opens it). Items are
 * `role="menuitem"`; a disabled item always says why. Up/Down/Home/End move, Esc closes.
 */
export function MessageMenu({
  open,
  onClose,
  anchorRef,
  label,
  items,
  rule,
  preview,
}: MessageMenuProps) {
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const listRef = useRef<HTMLDivElement>(null);
  if (!open) return null;
  const onKey = (e: React.KeyboardEvent) => {
    const els = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
    );
    if (!els.length) return;
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    let n = -1;
    if (e.key === 'ArrowDown') n = (i + 1) % els.length;
    else if (e.key === 'ArrowUp') n = (i - 1 + els.length) % els.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = els.length - 1;
    if (n < 0) return;
    e.preventDefault();
    els[n].focus();
  };
  const rows = (
    <div ref={listRef} className="uimm" role="presentation" onKeyDown={onKey}>
      {!desktop && preview && (
        <p className="uimm-prev">
          <span className="uimm-prev-t">{preview}</span>
        </p>
      )}
      {items.map((it) => (
        <ListRow
          key={it.id}
          role="menuitem"
          dense
          tone={it.danger ? 'danger' : undefined}
          icon={it.icon ? <Icon name={it.icon} /> : undefined}
          label={it.label}
          sub={it.hint}
          disabled={it.disabled}
          onClick={() => {
            onClose();
            it.onSelect();
          }}
        />
      ))}
      {rule != null && (
        <Notice tone="neutral" icon="info" className="uimm-rule" role="none">
          {rule}
        </Notice>
      )}
    </div>
  );
  if (desktop) {
    return (
      <Popover
        open
        onClose={onClose}
        anchorRef={anchorRef}
        side="bottom"
        align="end"
        width={280}
        role="menu"
        label={label}
        scrim
      >
        {rows}
      </Popover>
    );
  }
  return (
    <Sheet onClose={onClose} className="uimm-sheet" tone="accent" label={label}>
      <div role="menu" aria-label={label}>
        {rows}
      </div>
    </Sheet>
  );
}
