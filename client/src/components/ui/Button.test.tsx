import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, IconButton, LinkButton } from './Button';

afterEach(cleanup);

describe('Button', () => {
  it('defaults to a non-submitting primary md button with a label span', () => {
    render(<Button>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.className).toContain('uibtn--primary');
    expect(b.className).toContain('uibtn--md');
    expect(b.querySelector('.uibtn-label')?.textContent).toBe('Save');
    expect(b.getAttribute('aria-busy')).toBeNull();
  });

  it.each([
    'primary',
    'secondary',
    'ghost',
    'danger',
    'rest',
    'fill',
    'sleep',
    'sleep-fill',
    'link',
    'ok',
    'photo',
    'dashed',
  ] as const)('variant %s maps to a class', (variant) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole('button').className).toContain(`uibtn--${variant}`);
  });

  it.each(['xs', 'sm', 'md', 'lg'] as const)('size %s maps to a class', (size) => {
    render(<Button size={size}>x</Button>);
    expect(screen.getByRole('button').className).toContain(`uibtn--${size}`);
  });

  it('shape, fullWidth, inline, flush and hug add modifiers; className adds to the kit classes', () => {
    render(
      <Button shape="pill" fullWidth inline flush hug className="mine">
        x
      </Button>,
    );
    const cls = screen.getByRole('button').className;
    for (const c of ['uibtn--pill', 'uibtn--full', 'uibtn--inline', 'uibtn--flush', 'uibtn--hug'])
      expect(cls).toContain(c);
    expect(cls).toContain('mine');
    expect(cls).toContain('uibtn--primary');
  });

  it('renders leading and trailing icons around the label and no label span without children', () => {
    const { container, rerender } = render(
      <Button icon="bell" iconTrailing="user">
        x
      </Button>,
    );
    const kids = Array.from(screen.getByRole('button').children);
    expect(kids.map((k) => k.tagName + '.' + k.className.split(' ')[0])).toEqual([
      'I.ui-icon',
      'SPAN.uibtn-label',
      'I.ui-icon',
    ]);
    rerender(<Button icon="bell" aria-label="Alerts" />);
    expect(container.querySelector('.uibtn-label')).toBeNull();
  });

  it('loading disables, flags busy, shows the spinner and blocks clicks', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const b = screen.getByRole('button') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.className).toContain('is-loading');
    expect(container.querySelector('.uibtn-spin')?.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('click fires, disabled does not, type can be submit', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button type="submit" onClick={onClick}>
        Go
      </Button>,
    );
    const b = screen.getByRole('button');
    expect(b.getAttribute('type')).toBe('submit');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('IconButton', () => {
  it('is a ghost md icon button named by its label', () => {
    render(<IconButton label="Close" icon="x" />);
    const b = screen.getByRole('button', { name: 'Close' });
    expect(b.className).toContain('uibtn--icon');
    expect(b.className).toContain('uibtn--ghost');
    expect(b.className).toContain('uibtn--md');
    expect(b.getAttribute('type')).toBe('button');
    expect(b.querySelector('.uibadge')).toBeNull();
  });

  it('variant, size, shape map to classes and click/disabled work', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <IconButton
        label="Go"
        icon="x"
        variant="primary"
        size="lg"
        shape="round"
        onClick={onClick}
      />,
    );
    const b = screen.getByRole('button');
    for (const c of ['uibtn--primary', 'uibtn--lg', 'uibtn--round'])
      expect(b.className).toContain(c);
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<IconButton label="Go" icon="x" disabled onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('badge draws the unread count on the corner; zero draws nothing', () => {
    const { container, rerender } = render(<IconButton label="Inbox" icon="bell" badge={12} />);
    const pill = container.querySelector('.uibadge') as HTMLElement;
    expect(pill.className).toContain('uibadge--corner');
    expect(pill.textContent).toContain('9+');
    rerender(<IconButton label="Inbox" icon="bell" badge={0} />);
    expect(container.querySelector('.uibadge')).toBeNull();
  });
});

describe('LinkButton', () => {
  it('is an anchor styled as a button with variant, size, shape and full width', () => {
    render(
      <LinkButton href="#x" variant="secondary" size="sm" shape="pill" fullWidth icon="bell">
        Open
      </LinkButton>,
    );
    const a = screen.getByRole('link', { name: 'Open' });
    expect(a.getAttribute('href')).toBe('#x');
    for (const c of ['uibtn--secondary', 'uibtn--sm', 'uibtn--pill', 'uibtn--full'])
      expect(a.className).toContain(c);
    expect(a.querySelector('.ui-icon')).toBeTruthy();
  });

  it('defaults to primary md', () => {
    render(<LinkButton href="#x">Open</LinkButton>);
    const cls = screen.getByRole('link').className;
    expect(cls).toContain('uibtn--primary');
    expect(cls).toContain('uibtn--md');
  });
});
