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
