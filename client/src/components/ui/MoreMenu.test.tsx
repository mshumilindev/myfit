import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MoreMenu, type MoreMenuProps } from './MoreMenu';
import { SuiteLauncherRow } from './SuiteLauncherRow';

afterEach(cleanup);

function Host(props: Partial<MoreMenuProps>) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref}>anchor</button>
      <MoreMenu
        presentation="popover"
        open
        onClose={() => undefined}
        anchorRef={ref}
        title="More"
        {...props}
      />
    </>
  );
}
const item = (id: string, extra: object = {}) => ({
  id,
  label: id,
  icon: 'pulse',
  onSelect: () => undefined,
  ...extra,
});

describe('MoreMenu', () => {
  it('popover: a labelled dialog; items, then Apps LAST, then the account block', () => {
    render(
      <Host
        items={[item('Signals'), item('Live', { count: 3 })]}
        apps={{ label: 'Apps', onOpen: () => undefined }}
        account={{
          name: 'Iryna Koval',
          roleLabel: 'Trainer',
          profile: { label: 'Profile', onOpen: () => undefined },
        }}
      />,
    );
    const dlg = screen.getByRole('dialog', { name: 'More' });
    const rows = [...dlg.querySelectorAll('button.uirow')].map((b) => b.textContent);
    expect(rows).toEqual(['Signals', 'Live3', 'Apps']);
    expect([...document.querySelectorAll('.uiacct-action')].map((b) => b.textContent)).toEqual([
      'Profile',
    ]);
    expect(within(dlg).getByText('Iryna Koval')).toBeTruthy();
    expect(dlg.querySelector('.uibadge')?.textContent).toBe('3');
  });

  it('sheet: heading, closed renders nothing', () => {
    const { rerender } = render(<Host presentation="sheet" open={false} />);
    expect(screen.queryByRole('heading', { name: 'More' })).toBeNull();
    rerender(<Host presentation="sheet" open apps={{ label: 'Apps', onOpen: () => undefined }} />);
    expect(screen.getByRole('heading', { name: 'More' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apps' })).toBeTruthy();
  });

  it.each(['popover', 'sheet'] as const)(
    '%s: a row closes the menu and then acts',
    (presentation) => {
      const order: string[] = [];
      const onApps = vi.fn(() => order.push('apps'));
      render(
        <Host
          presentation={presentation}
          onClose={() => order.push('close')}
          apps={{ label: 'Apps', onOpen: onApps }}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
      expect(order).toEqual(['close', 'apps']);
    },
  );

  it('closeOnSelect={false} keeps it open', () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} closeOnSelect={false} items={[item('Live')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Live' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('marks the current item and wires the mode switch and Profile through close', () => {
    const onClose = vi.fn();
    const onMode = vi.fn();
    const onProfile = vi.fn();
    render(
      <Host
        onClose={onClose}
        items={[item('Live', { active: true })]}
        account={{
          name: 'X',
          modes: [
            { value: 'a', label: 'Coach' },
            { value: 'b', label: 'Mine' },
          ],
          mode: 'a',
          onModeChange: onMode,
          profile: { label: 'Profile', onOpen: onProfile },
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Live' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
    expect(onMode).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(onProfile).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('no list when there is nothing to list; account only', () => {
    const { baseElement } = render(<Host account={{ name: 'Only Me' }} />);
    expect(baseElement.querySelector('.uimore-list')).toBeNull();
    expect(screen.getByText('Only Me')).toBeTruthy();
  });
});

describe('SuiteLauncherRow', () => {
  it('is a button row with a chevron and fires onOpen', () => {
    const onOpen = vi.fn();
    const { container } = render(<SuiteLauncherRow label="Apps" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.uirow-chev')).not.toBeNull();
  });
});

describe('MoreMenu extraItems', () => {
  it('lists the collapsed foot extras as a second group under the items, before the account', () => {
    render(
      <Host
        items={[item('Signals')]}
        extraItems={[item('Bell', { count: 2 })]}
        account={{ name: 'Iryna Koval' }}
      />,
    );
    const dlg = screen.getByRole('dialog', { name: 'More' });
    const groups = [...dlg.querySelectorAll('.uimore-list')].map((g) =>
      [...g.querySelectorAll('button.uirow')].map((b) => b.textContent),
    );
    expect(groups).toEqual([['Signals'], ['Bell2']]);
    const all = [...dlg.querySelectorAll('*')];
    expect(all.indexOf(within(dlg).getByText('Bell'))).toBeLessThan(
      all.indexOf(within(dlg).getByText('Iryna Koval')),
    );
  });
});

describe('MoreMenu submenu', () => {
  const lang = (onChange = vi.fn(), onSelect = vi.fn()) =>
    item('Language', {
      onSelect,
      submenu: {
        title: 'Language',
        value: 'uk',
        options: [
          { id: 'en', label: 'English' },
          { id: 'uk', label: 'Українська' },
          { id: 'pl', label: 'Polski' },
        ],
        onChange,
      },
    });

  it('a click opens the list with the current option marked; nothing changes until a pick', () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<Host items={[lang(onChange, onSelect)]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    const list = screen.getByRole('listbox', { name: 'Language' });
    const opts = within(list).getAllByRole('option');
    expect(opts.map((o) => o.textContent)).toEqual(['English', 'Українська', 'Polski']);
    expect(opts.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(document.activeElement).toBe(opts[1]);
  });

  it('a pick changes the value and closes the menu', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<Host items={[lang(onChange)]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    fireEvent.click(screen.getByRole('option', { name: 'Polski' }));
    expect(onChange).toHaveBeenCalledWith('pl');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the row announces a popup; → opens, ↑/↓/Home/End move, ← and Esc return to the row', () => {
    const onClose = vi.fn();
    render(<Host items={[lang()]} onClose={onClose} />);
    const row = screen.getByRole('button', { name: 'Language' });
    expect(row.getAttribute('aria-haspopup')).toBe('listbox');
    row.focus();
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    const opts = screen.getAllByRole('option');
    expect(document.activeElement).toBe(opts[1]);
    fireEvent.keyDown(opts[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(opts[2]);
    fireEvent.keyDown(opts[2], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(opts[0]);
    fireEvent.keyDown(opts[0], { key: 'End' });
    expect(document.activeElement).toBe(opts[2]);
    fireEvent.keyDown(opts[2], { key: 'Home' });
    expect(document.activeElement).toBe(opts[0]);
    fireEvent.keyDown(opts[0], { key: 'ArrowLeft' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Language' }));
    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    fireEvent.keyDown(screen.getAllByRole('option')[0], { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the Back row returns to the list', () => {
    render(<Host items={[lang(), item('Signals')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    expect(screen.queryByRole('button', { name: 'Signals' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Language' })[0]);
    expect(screen.getByRole('button', { name: 'Signals' })).toBeTruthy();
  });
});
