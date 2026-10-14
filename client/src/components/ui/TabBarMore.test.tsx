import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TabBar } from './TabBar';

afterEach(cleanup);
const items = [
  { id: 'a', label: 'A', icon: 'house' },
  { id: 'b', label: 'B', icon: 'map-pin', active: true },
];

describe('TabBar more', () => {
  it('adds a trailing More button that opens its sheet and counts as a column', () => {
    const onClick = vi.fn();
    const { container } = render(
      <TabBar items={items} onSelect={() => undefined} more={{ label: 'More', onClick }} />,
    );
    const buttons = [...container.querySelectorAll('.tabbar > button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['A', 'B', 'More']);
    expect((container.querySelector('.tabbar') as HTMLElement).style.gridTemplateColumns).toBe(
      'repeat(3, minmax(0, 1fr))',
    );
    const more = screen.getByRole('button', { name: 'More' });
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.className).toBe('');
    fireEvent.click(more);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is lit and expanded while open; lit but not expanded when only the current screen is inside', () => {
    const { rerender } = render(
      <TabBar
        items={items}
        onSelect={() => undefined}
        more={{ label: 'More', open: true, onClick: () => undefined }}
      />,
    );
    let more = screen.getByRole('button', { name: 'More' });
    expect(more.className).toBe('active');
    expect(more.getAttribute('aria-expanded')).toBe('true');
    rerender(
      <TabBar
        items={items}
        onSelect={() => undefined}
        more={{ label: 'More', active: true, onClick: () => undefined }}
      />,
    );
    more = screen.getByRole('button', { name: 'More' });
    expect(more.className).toBe('active');
    expect(more.getAttribute('aria-expanded')).toBe('false');
  });

  it('a bar without More or Apps is unchanged', () => {
    const { container } = render(<TabBar items={items} onSelect={() => undefined} />);
    expect(container.querySelectorAll('.tabbar > button')).toHaveLength(2);
  });

  it('with the FAB the notch splits the tabs two / rest, More is last', () => {
    const three = [...items, { id: 'c', label: 'C', icon: 'user' }];
    const { container } = render(
      <TabBar
        items={three}
        onSelect={() => undefined}
        more={{ label: 'More', onClick: () => undefined }}
        fab={{ ariaLabel: 'Start', onClick: () => undefined }}
      />,
    );
    const kids = [...(container.querySelector('.tabbar') as HTMLElement).children].map((e) =>
      e.className.includes('tabbar-gap') ? '|' : e.textContent,
    );
    expect(kids).toEqual(['A', 'B', '|', 'C', 'More']);
  });
});
