import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShortcutTile } from './ShortcutTile';

afterEach(cleanup);

describe('ShortcutTile', () => {
  it('renders a button with label, defaults and no state decorations', () => {
    const { container } = render(<ShortcutTile label="Start" icon="barbell" />);
    const btn = screen.getByRole('button', { name: 'Start' });
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.className).toContain('uisc--default');
    expect(btn.className).toContain('uit--neutral');
    expect(btn.hasAttribute('aria-pressed')).toBe(false);
    for (const c of ['.uisc-dot', '.uisc-pick', '.uisc-done', '.uisc-meta']) {
      expect(container.querySelector(c)).toBeNull();
    }
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    render(<ShortcutTile label="Start" icon="barbell" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ariaLabel overrides the accessible name; tone maps to a class', () => {
    render(<ShortcutTile label="Log" icon="barbell" ariaLabel="Log activity" tone="sport" />);
    const btn = screen.getByRole('button', { name: 'Log activity' });
    expect(btn.className).toContain('uit--sport');
  });

  it('live shows the dot and the meta line', () => {
    const { container } = render(
      <ShortcutTile label="Run" icon="barbell" state="live" meta="12:30" />,
    );
    expect(container.querySelector('.uisc-dot')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('12:30').className).toContain('uisc-meta');
    expect(screen.getByRole('button').className).toContain('uisc--live');
  });

  it('selected is aria-pressed with a check badge', () => {
    const { container } = render(<ShortcutTile label="Run" icon="barbell" state="selected" />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.uisc-pick')).not.toBeNull();
  });

  it('done shows the done badge and is not a toggle', () => {
    const { container } = render(<ShortcutTile label="Run" icon="barbell" state="done" />);
    expect(container.querySelector('.uisc-done')).not.toBeNull();
    expect(screen.getByRole('button').hasAttribute('aria-pressed')).toBe(false);
  });

  it('primary uses the solid brass icon instead of an IconTile', () => {
    const { container, rerender } = render(<ShortcutTile label="Today" icon="play" primary />);
    expect(screen.getByRole('button').className).toContain('uisc--primary');
    expect(container.querySelector('.uisc-primary-icon')).not.toBeNull();
    rerender(<ShortcutTile label="Today" icon="play" />);
    expect(container.querySelector('.uisc-primary-icon')).toBeNull();
  });
});
