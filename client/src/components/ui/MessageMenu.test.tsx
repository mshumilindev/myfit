import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MessageMenu, type MessageMenuItem } from './MessageMenu';

function stubWidth(desktop: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  }));
}

beforeEach(() => stubWidth(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(
  over: { items?: MessageMenuItem[]; rule?: string; preview?: string; open?: boolean } = {},
) {
  const onClose = vi.fn();
  const onCopy = vi.fn();
  const onDelete = vi.fn();
  const items: MessageMenuItem[] = over.items ?? [
    { id: 'copy', label: 'Copy', icon: 'copy', onSelect: onCopy },
    { id: 'del', label: 'Delete', danger: true, hint: 'Only your copy', onSelect: onDelete },
    { id: 'off', label: 'Edit', disabled: true, hint: 'Too old', onSelect: vi.fn() },
  ];
  const anchorRef = createRef<HTMLElement>();
  const utils = render(
    <>
      <button ref={anchorRef as React.RefObject<HTMLButtonElement>}>more</button>
      <MessageMenu
        open={over.open ?? true}
        onClose={onClose}
        anchorRef={anchorRef}
        label="Message actions"
        items={items}
        rule={over.rule}
        preview={over.preview}
      />
    </>,
  );
  return { onClose, onCopy, onDelete, ...utils };
}

describe('MessageMenu', () => {
  it('renders nothing while closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('desktop: a labelled menu popover with menuitems', () => {
    setup();
    expect(screen.getByRole('menu', { name: 'Message actions' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('selecting an item closes the menu and runs its action', () => {
    const { onClose, onCopy } = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('shows the hint under the label and disables disabled items', () => {
    const { onClose } = setup();
    expect(screen.getByText('Only your copy')).toBeTruthy();
    const off = screen.getByRole('menuitem', { name: /Edit/ }) as HTMLButtonElement;
    expect(screen.getByText('Too old')).toBeTruthy();
    expect(off.disabled).toBe(true);
    fireEvent.click(off);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('arrow keys, Home and End move focus across enabled items and wrap', () => {
    setup();
    const [copy, del] = screen.getAllByRole('menuitem') as HTMLButtonElement[];
    copy.focus();
    fireEvent.keyDown(copy, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(del);
    fireEvent.keyDown(del, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(copy);
    fireEvent.keyDown(copy, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(del);
    fireEvent.keyDown(del, { key: 'Home' });
    expect(document.activeElement).toBe(copy);
    fireEvent.keyDown(copy, { key: 'End' });
    expect(document.activeElement).toBe(del);
  });

  it('shows the rule sentence when given and omits it otherwise', () => {
    const a = setup({ rule: 'You can delete only your own messages' });
    expect(screen.getByText('You can delete only your own messages')).toBeTruthy();
    a.unmount();
    setup();
    expect(screen.queryByText('You can delete only your own messages')).toBeNull();
  });

  it('phone: a bottom sheet quoting the preview', () => {
    stubWidth(false);
    setup({ preview: 'See you at six' });
    expect(screen.getByText('See you at six')).toBeTruthy();
    expect(screen.getByRole('menu', { name: 'Message actions' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('desktop never shows the preview quote', () => {
    setup({ preview: 'See you at six' });
    expect(screen.queryByText('See you at six')).toBeNull();
  });
});
