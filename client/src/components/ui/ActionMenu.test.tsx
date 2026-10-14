import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './ActionMenu';

afterEach(cleanup);

const mk = (over: Partial<Parameters<typeof ActionMenu>[0]> = {}) => {
  const a = vi.fn();
  const b = vi.fn();
  render(
    <ActionMenu
      label="More actions"
      note="Reads are logged and visible to the client."
      items={[
        { id: 'a', label: 'Message Oleh', icon: 'envelope', onSelect: a },
        { id: 'b', label: 'Edit program', icon: 'pencil-simple', onSelect: b },
      ]}
      {...over}
    />,
  );
  return { a, b };
};

describe('ActionMenu', () => {
  it('opens a menu of menuitems with the note, closes on select and runs the item', () => {
    const { a } = mk();
    const btn = screen.getByRole('button', { name: 'More actions' });
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Message Oleh',
      'Edit program',
    ]);
    expect(screen.getByText('Reads are logged and visible to the client.')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Message Oleh' }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('arrow keys move between items', () => {
    mk({ defaultOpen: true });
    const menu = screen.getAllByRole('menuitem');
    menu[0].focus();
    fireEvent.keyDown(menu[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(menu[1]);
    fireEvent.keyDown(menu[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(menu[0]);
    fireEvent.keyDown(menu[0], { key: 'End' });
    expect(document.activeElement).toBe(menu[1]);
  });

  it('the unread dot is part of the spoken name', () => {
    mk({ dot: true, dotLabel: '3 unread' });
    expect(screen.getByRole('button', { name: 'More actions, 3 unread' })).toBeTruthy();
  });
});
