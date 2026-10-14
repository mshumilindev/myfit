import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Icon } from '../../ui';
import { IconButton } from './Button';
import { ListRow } from './GroupedList';
import { Notice } from './Notice';
import { Popover } from './Popover';
import './ActionMenu.css';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: string;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * "..." button + menu popover (Client 360 header, later chat and decision rows). Items are `role="menuitem"`,
 * Up/Down/Home/End move, Esc closes and returns focus to the button. `dot` marks the button with an unread
 * dot (the phone header, where Message lives inside the menu); `dotLabel` is then part of the spoken name.
 */
export function ActionMenu({
  label,
  items,
  note,
  dot,
  dotLabel,
  icon = 'dots-three',
  defaultOpen = false,
}: {
  /** Accessible name of the button and the menu ("More actions"). */
  label: string;
  items: readonly ActionMenuItem[];
  /** A quiet sentence under the items ("Reads are logged and visible to the client."). */
  note?: ReactNode;
  dot?: boolean;
  dotLabel?: string;
  icon?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const anchor = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
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

  return (
    <>
      <span ref={anchor} className="amenu-anchor">
        <IconButton
          icon={icon}
          label={dot && dotLabel ? `${label}, ${dotLabel}` : label}
          variant="ghost"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        />
        {dot && <span className="amenu-dot" aria-hidden />}
      </span>
      <Popover
        open={open}
        onClose={close}
        anchorRef={anchor}
        side="bottom"
        align="end"
        width={280}
        role="menu"
        label={label}
        scrim
      >
        <div ref={listRef} className="amenu" onKeyDown={onKey}>
          <FocusFirst root={listRef} />
          {items.map((it) => (
            <ListRow
              key={it.id}
              role="menuitem"
              dense
              icon={it.icon ? <Icon name={it.icon} /> : undefined}
              label={it.label}
              disabled={it.disabled}
              onClick={() => {
                close();
                it.onSelect();
              }}
            />
          ))}
          {note != null && (
            <Notice tone="neutral" icon="eye" className="amenu-note" role="none">
              {note}
            </Notice>
          )}
        </div>
      </Popover>
    </>
  );
}

/** Moves focus to the first enabled item when the menu opens (arrow keys take it from there). */
function FocusFirst({ root }: { root: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [root]);
  return null;
}
