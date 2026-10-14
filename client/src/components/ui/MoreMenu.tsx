import type { ReactNode, RefObject } from 'react';
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
  const body = (
    <MoreMenuBody
      items={items?.map((i) => ({ ...i, onSelect: done(i.onSelect) }))}
      extraItems={extraItems?.map((i) => ({ ...i, onSelect: done(i.onSelect) }))}
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

/** The menu content without a container, for custom presentations and stories. */
export function MoreMenuBody<V extends string = string>({
  items,
  extraItems,
  apps,
  account,
}: Pick<MoreMenuProps<V>, 'items' | 'extraItems' | 'apps' | 'account'>): ReactNode {
  const hasList = !!apps || !!items?.length;
  const row = (i: MoreMenuItem) => (
    <ListRow
      key={i.id}
      icon={<Icon name={i.icon} />}
      label={i.label}
      chevron
      selected={i.active}
      aria-current={i.active ? 'page' : undefined}
      trailing={i.count ? <Badge n={i.count} anchor="inline" /> : undefined}
      onClick={i.onSelect}
    />
  );
  return (
    <div className="uimore-body">
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
