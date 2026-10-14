import type { RefObject } from 'react';
import { AccountPanel, withClose, type AccountPanelProps } from './AccountPanel';
import { Popover } from './Popover';
import type { PopoverAlign, PopoverSide } from './popoverPosition';

export interface AccountPopoverProps<V extends string = string> {
  open: boolean;
  onClose: () => void;
  /** The avatar button the popover points at. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Accessible name of the dialog ("Profile and mode"). */
  title: string;
  account: AccountPanelProps<V>;
  side?: PopoverSide;
  align?: PopoverAlign;
  width?: number;
  /** Close the popover after a mode change or Profile press (default true). */
  closeOnSelect?: boolean;
}

/**
 * Desktop account popover (kit, app-agnostic): opened by the rail's avatar, shows ONLY the
 * `AccountPanel` (avatar, name, role, mode switch when allowed, privacy note, Profile row).
 * Navigation overflow lives in `MoreMenu`, never here.
 */
export function AccountPopover<V extends string = string>({
  open,
  onClose,
  anchorRef,
  title,
  account,
  side = 'right',
  align = 'end',
  width = 320,
  closeOnSelect = true,
}: AccountPopoverProps<V>) {
  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      side={side}
      align={align}
      width={width}
      label={title}
    >
      <AccountPanel<V> {...(closeOnSelect ? withClose(account, onClose) : account)} />
    </Popover>
  );
}
