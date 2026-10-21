import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Chip, ChipGroup } from './Chip';

afterEach(cleanup);

describe('Chip', () => {
  it('without onClick is a static span at the sm size with the neutral tone', () => {
    render(<Chip data-testid="c">Legs</Chip>);
    const el = screen.getByTestId('c');
    expect(el.tagName).toBe('SPAN');
    expect(screen.queryByRole('button')).toBeNull();
    expect(el.className).toContain('uichip--sm');
    expect(el.className).not.toMatch(/uichip--(accent|danger|ok|rest|atlas)/);
    expect(el.querySelector('.uichip-l')?.textContent).toBe('Legs');
  });

  it.each(['accent', 'danger', 'ok', 'rest', 'atlas'] as const)(
    'tone %s maps to a class',
    (tone) => {
      render(
        <Chip tone={tone} data-testid="c">
          x
        </Chip>,
      );
      expect(screen.getByTestId('c').className).toContain(`uichip--${tone}`);
    },
  );

  it.each(['xs', 'sm', 'md', 'lg'] as const)('size %s maps to a class', (size) => {
    render(
      <Chip size={size} data-testid="c">
        x
      </Chip>,
    );
    expect(screen.getByTestId('c').className).toContain(`uichip--${size}`);
  });

  it('muted, onPhoto and className add modifiers', () => {
    render(
      <Chip muted onPhoto className="mine" data-testid="c">
        x
      </Chip>,
    );
    const cls = screen.getByTestId('c').className;
    for (const c of ['uichip--muted', 'uichip--photo', 'mine']) expect(cls).toContain(c);
  });

  it('with onClick is a toggle button: aria-pressed follows selected and click fires', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Chip onClick={onClick}>All</Chip>);
    let b = screen.getByRole('button', { name: 'All' });
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(b.getAttribute('type')).toBe('button');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Chip selected onClick={onClick}>
        All
      </Chip>,
    );
    b = screen.getByRole('button');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.className).toContain('is-selected');
  });

  it('a disabled chip button does not fire', () => {
    const onClick = vi.fn();
    render(
      <Chip disabled onClick={onClick}>
        All
      </Chip>,
    );
    const b = screen.getByRole('button') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('count follows the label in the same name; count alone has no stray space', () => {
    const { rerender } = render(
      <Chip data-testid="c" count={14}>
        All
      </Chip>,
    );
    expect(screen.getByTestId('c').querySelector('.uichip-l')?.textContent).toBe('All 14');
    expect(screen.getByTestId('c').querySelector('.uichip-n')?.textContent).toBe('14');
    rerender(<Chip data-testid="c" count={0} />);
    expect(screen.getByTestId('c').querySelector('.uichip-l')?.textContent).toBe('0');
  });

  it('lead renders a tab and marks the chip; icon renders a glyph', () => {
    const { container } = render(
      <Chip data-testid="c" lead="×2" icon="bell">
        Set
      </Chip>,
    );
    expect(screen.getByTestId('c').className).toContain('uichip--has-lead');
    expect(container.querySelector('b.uichip-lead')?.textContent).toBe('×2');
    expect(container.querySelector('.ui-icon')).toBeTruthy();
  });

  it('nested is a span[role=button] that handles click and Enter/Space without bubbling', () => {
    const onClick = vi.fn();
    const outer = vi.fn();
    render(
      <div onClick={outer} onKeyDown={outer}>
        <Chip nested onClick={onClick}>
          Edit
        </Chip>
      </div>,
    );
    const el = screen.getByRole('button', { name: 'Edit' });
    expect(el.tagName).toBe('SPAN');
    expect(el.getAttribute('tabindex')).toBe('0');
    fireEvent.click(el);
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    fireEvent.keyDown(el, { key: 'a' });
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(outer).toHaveBeenCalledTimes(1); // only the unhandled 'a' key bubbles
  });

  it('nested without onClick stays a static span', () => {
    render(
      <Chip nested data-testid="c">
        x
      </Chip>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ChipGroup', () => {
  it('wraps its chips; scroll and fill add modifiers', () => {
    const { rerender } = render(
      <ChipGroup data-testid="g">
        <Chip>a</Chip>
        <Chip>b</Chip>
      </ChipGroup>,
    );
    let g = screen.getByTestId('g');
    expect(g.className).toBe('uichip-group');
    expect(g.children).toHaveLength(2);
    rerender(
      <ChipGroup data-testid="g" scroll fill className="mine">
        <Chip>a</Chip>
      </ChipGroup>,
    );
    g = screen.getByTestId('g');
    for (const c of ['uichip-group--scroll', 'uichip-group--fill', 'mine'])
      expect(g.className).toContain(c);
  });
});
