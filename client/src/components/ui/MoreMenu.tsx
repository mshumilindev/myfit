import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Badge } from './Badge';
import { Icon } from '../../ui';
import { AccountPanel, withClose, type AccountPanelProps } from './AccountPanel';
import { GroupedList, ListRow } from './GroupedList';
import { Sheet } from './Overlays';
import type { Tone } from './tones';
import { Popover } from './Popover';
import type { PopoverAlign, PopoverSide } from './popoverPosition';
import { SuiteLauncherRow } from './SuiteLauncherRow';
import './MoreMenu.css';

/** A choose-one list a row opens inside the menu (Language: the current locale is marked). */
export interface MoreMenuSubmenu {
  /** Heading of the list and its accessible name (the row's own label). */
  title: string;
  options: { id: string; label: string; /** Leading glyph (a flag). */ icon?: ReactNode }[];
  /** The current option (marked, `aria-selected`). */
  value: string;
  /** A pick; the menu closes after it like after any row (`closeOnSelect`). */
  onChange: (id: string) => void;
}

export interface MoreMenuItem {
  id: string;
  label: string;
  /** Icon name from the app registry. */
  icon: string;
  onSelect: () => void;
  /** The current destination (marks the row, `aria-current="page"`). */
  active?: boolean;
  /** Unread count (kit Badge, 1..9, 9+). */
  count?: number;
  /**
   * The row opens this list inside the menu (Enter / click / →; Esc / ← / Back return) instead of
   * running `onSelect`, which is then unused.
   */
  submenu?: MoreMenuSubmenu;
}

export interface MoreMenuProps<V extends string = string> {
  /** `popover` = desktop, anchored to a rail item; `sheet` = phone bottom sheet. */
  presentation: 'popover' | 'sheet';
  open: boolean;
  onClose: () => void;
  /** Sheet heading and the popover's accessible name ("More"). */
  title: string;
  /** The app's secondary destinations that do not fit its rail / tab bar. */
  items?: MoreMenuItem[];
  /**
   * A second group under `items`: the rail's foot extras that collapsed (bell, mastery, settings…),
   * each listed by its own name. Used by the desktop rail overflow only.
   */
  extraItems?: MoreMenuItem[];
  /** The "Apps" row that opens the suite launcher; always the LAST row of the list. Omit when Apps is itself an `items` entry. */
  apps?: { label: string; onOpen: () => void };
  /** The account block (avatar, role, mode switch, privacy note, Profile). */
  account?: AccountPanelProps<V>;
  /** Popover only: the element it points at (rail More item / avatar group). */
  anchorRef?: RefObject<HTMLElement | null>;
  side?: PopoverSide;
  align?: PopoverAlign;
  /** Popover width in px (default 320). */
  width?: number;
  /** Close the menu after any row, mode change or Profile press (default true). */
  closeOnSelect?: boolean;
  className?: string;
  /** Sheet only: colour family of the drawer (current app), as the launcher sheet. */
  tone?: Tone;
}

/**
 * "More" (kit, app-agnostic): Apps + the app's secondary destinations + the account block.
 * Desktop shows it as a `Popover` next to the rail's More item, phone as a bottom `Sheet`
 * opened by the tab bar's More tab. Every app passes its own `items`, `apps` handler and
 * `account` (see `MoreMenuBody` for the content alone).
 */
export function MoreMenu<V extends string = string>({
  presentation,
  open,
  onClose,
  title,
  items,
  extraItems,
  apps,
  account,
  anchorRef,
  side = 'right',
  align = 'end',
  width = 320,
  closeOnSelect = true,
  className,
  tone,
}: MoreMenuProps<V>) {
  const done = <A extends unknown[]>(fn: (...a: A) => void) =>
    closeOnSelect
      ? (...a: A) => {
          onClose();
          fn(...a);
        }
      : fn;
  const wrap = (i: MoreMenuItem): MoreMenuItem => ({
    ...i,
    onSelect: done(i.onSelect),
    ...(i.submenu ? { submenu: { ...i.submenu, onChange: done(i.submenu.onChange) } } : {}),
  });
  const body = (
    <MoreMenuBody
      items={items?.map(wrap)}
      extraItems={extraItems?.map(wrap)}
      apps={apps && { ...apps, onOpen: done(apps.onOpen) }}
      account={account && (closeOnSelect ? withClose(account, onClose) : account)}
    />
  );
  if (presentation === 'sheet') {
    if (!open) return null;
    return (
      <Sheet
        onClose={onClose}
        tone={tone}
        label={title}
        className={['uimore', className].filter(Boolean).join(' ')}
      >
        <h2 className="uimore-title">{title}</h2>
        {body}
      </Sheet>
    );
  }
  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef ?? { current: null }}
      side={side}
      align={align}
      width={width}
      label={title}
      className={className}
    >
      {body}
    </Popover>
  );
}

/** DOM id of a row (the keyboard handlers find the row a key press came from). */
const rowDomId = (id: string) => `uimore-row-${id}`;

/** The menu content without a container, for custom presentations and stories. */
export function MoreMenuBody<V extends string = string>({
  items,
  extraItems,
  apps,
  account,
}: Pick<MoreMenuProps<V>, 'items' | 'extraItems' | 'apps' | 'account'>): ReactNode {
  const [openId, setOpenId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const backTo = useRef<string | null>(null);
  const open = [...(items ?? []), ...(extraItems ?? [])].find((i) => i.id === openId && i.submenu);

  // Focus follows the view: into the list (the current option) on open, back onto its row on return.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    if (open) {
      const target =
        root.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ??
        root.querySelector<HTMLElement>('[role="option"]');
      target?.focus({ preventScroll: true });
    } else if (backTo.current) {
      document.getElementById(rowDomId(backTo.current))?.focus();
      backTo.current = null;
    }
  }, [open]);

  const close = () => {
    backTo.current = openId;
    setOpenId(null);
  };

  const row = (i: MoreMenuItem) => (
    <ListRow
      key={i.id}
      id={rowDomId(i.id)}
      icon={<Icon name={i.icon} />}
      label={i.label}
      chevron
      selected={i.active}
      aria-current={i.active ? 'page' : undefined}
      aria-haspopup={i.submenu ? 'listbox' : undefined}
      trailing={i.count ? <Badge n={i.count} anchor="inline" /> : undefined}
      onClick={i.submenu ? () => setOpenId(i.id) : i.onSelect}
    />
  );

  // → on a row with a submenu opens it (Enter / click are the button's own).
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight') return;
    const hit = [...(items ?? []), ...(extraItems ?? [])].find(
      (i) => i.submenu && rowDomId(i.id) === (e.target as HTMLElement).id,
    );
    if (!hit) return;
    e.preventDefault();
    setOpenId(hit.id);
  };

  const onSubKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' || e.key === 'ArrowLeft') {
      // Esc closes the submenu only; the popover's own Esc handler (on document) never sees it.
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      close();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const opts = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')];
    const at = opts.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? opts.length - 1
          : (at + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
    e.preventDefault();
    opts[next]?.focus();
  };

  if (open?.submenu) {
    const sub = open.submenu;
    return (
      <div className="uimore-body uimore-sub" ref={bodyRef} onKeyDown={onSubKey}>
        <div className="uimore-list">
          <GroupedList surface="raised">
            <ListRow
              icon={<Icon name="caret-left" />}
              label={sub.title}
              strong
              onClick={close}
              aria-label={sub.title}
            />
          </GroupedList>
        </div>
        <div className="uimore-list uimore-extra">
          <GroupedList surface="raised" rowsRole="listbox" label={sub.title}>
            {sub.options.map((o) => (
              <ListRow
                key={o.id}
                role="option"
                aria-selected={o.id === sub.value}
                icon={o.icon}
                label={o.label}
                check={o.id === sub.value}
                selected={o.id === sub.value}
                onClick={() => sub.onChange(o.id)}
              />
            ))}
          </GroupedList>
        </div>
      </div>
    );
  }

  const hasList = !!apps || !!items?.length;
  return (
    <div className="uimore-body" ref={bodyRef} onKeyDown={onListKey}>
      {hasList && (
        <div className="uimore-list">
          <GroupedList surface="raised">
            {items?.map(row)}
            {apps && <SuiteLauncherRow label={apps.label} onOpen={apps.onOpen} />}
          </GroupedList>
        </div>
      )}
      {!!extraItems?.length && (
        <div className="uimore-list uimore-extra">
          <GroupedList surface="raised">{extraItems.map(row)}</GroupedList>
        </div>
      )}
      {account && <AccountPanel<V> {...account} />}
    </div>
  );
}
