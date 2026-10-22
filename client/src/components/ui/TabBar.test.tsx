import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TabBar, type TabBarItem } from './TabBar';

afterEach(cleanup);

const items: TabBarItem[] = [
  { id: 'today', label: 'Today', icon: 'house', active: true },
  { id: 'overview', label: 'Overview', icon: 'chart-bar' },
  { id: 'gyms', label: 'Gyms', icon: 'barbell' },
  { id: 'chat', label: 'Chat', icon: 'chat', badge: 3, ariaLabel: 'Chat, 3 unread' },
];

describe('TabBar', () => {
  it('renders a plain nav with one button per item and marks the active one', () => {
    const { container } = render(<TabBar items={items} onSelect={() => {}} />);
    expect(container.querySelector('nav.tabbar')).not.toBeNull();
    expect(container.querySelector('nav')?.getAttribute('role')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText('Today').closest('button')?.className).toBe('active');
    expect(screen.getByText('Gyms').closest('button')?.className).toBe('');
  });

  it('calls onSelect with the item id', () => {
    const onSelect = vi.fn();
    render(<TabBar items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Overview'));
    expect(onSelect).toHaveBeenCalledWith('overview');
  });

  it('tabs mode adds tablist / tab / aria-selected', () => {
    render(<TabBar items={items} onSelect={() => {}} tabs />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: /Today/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Gyms/ }).getAttribute('aria-selected')).toBe('false');
  });

  it('numeric badge uses the Badge and ariaLabel names the tab; 0 shows none', () => {
    const { container, rerender } = render(<TabBar items={items} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Chat, 3 unread' })).toBeTruthy();
    expect(container.querySelector('.tabbar-ico .uibadge')).not.toBeNull();
    rerender(
      <TabBar
        items={[{ id: 'chat', label: 'Chat', icon: 'chat', badge: 0 }]}
        onSelect={() => {}}
      />,
    );
    expect(container.querySelector('.tabbar-ico')).toBeNull();
    expect(container.querySelector('.uibadge')).toBeNull();
  });

  it('a node badge is placed as given', () => {
    render(
      <TabBar
        items={[
          { id: 'a', label: 'A', icon: 'house', badge: <i data-testid="dot" /> },
          { id: 'b', label: 'B', icon: 'chart-line-up' },
        ]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId('dot').closest('.tabbar-ico')).not.toBeNull();
  });

  it('a bar with a single destination is not shown (it navigates nowhere)', () => {
    const { container } = render(
      <TabBar items={[{ id: 'a', label: 'A', icon: 'house' }]} onSelect={() => {}} />,
    );
    expect(container.querySelector('.tabbar')).toBeNull();
    const withMore = render(
      <TabBar
        items={[{ id: 'a', label: 'A', icon: 'house' }]}
        more={{ label: 'More', onClick: () => {} }}
        onSelect={() => {}}
      />,
    );
    expect(withMore.container.querySelector('.tabbar')).not.toBeNull();
  });

  it('fab adds the notch, the Start button and splits tabs 2 + rest', () => {
    const onClick = vi.fn();
    const { container } = render(
      <TabBar items={items} onSelect={() => {}} fab={{ ariaLabel: 'Start', onClick }} />,
    );
    expect(container.querySelector('.tabbar-wrap--fab')).not.toBeNull();
    expect(container.querySelector('nav')?.className).toContain('tabbar-notched');
    const navChildren = Array.from(container.querySelector('nav')!.children);
    expect(navChildren[2].className).toBe('tabbar-gap');
    expect(navChildren).toHaveLength(5);
    const fab = screen.getByRole('button', { name: 'Start' });
    expect(fab.className).not.toContain('is-attention');
    fireEvent.click(fab);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fab attention adds the pulse class', () => {
    render(
      <TabBar items={items} onSelect={() => {}} fab={{ ariaLabel: 'Start', onClick: () => {} }} />,
    );
    cleanup();
    render(
      <TabBar
        items={items}
        onSelect={() => {}}
        fab={{ ariaLabel: 'Start', onClick: () => {}, attention: true }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Start' }).className).toContain('is-attention');
  });

  it('apps button fires its handler and counts as a column', () => {
    const onClick = vi.fn();
    const { container } = render(
      <TabBar
        items={items}
        onSelect={() => {}}
        apps={{ label: 'Apps', ariaLabel: 'All apps', onClick }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'All apps' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector('nav')?.style.gridTemplateColumns).toBe(
      'repeat(5, minmax(0, 1fr))',
    );
  });

  it('more tab exposes dialog popup state and lights when open or active', () => {
    const { rerender } = render(
      <TabBar items={items} onSelect={() => {}} more={{ label: 'More', onClick: () => {} }} />,
    );
    let more = screen.getByText('More').closest('button')!;
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.className).toBe('');
    rerender(
      <TabBar
        items={items}
        onSelect={() => {}}
        more={{ label: 'More', open: true, onClick: () => {} }}
      />,
    );
    more = screen.getByText('More').closest('button')!;
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(more.className).toBe('active');
    rerender(
      <TabBar
        items={items}
        onSelect={() => {}}
        more={{ label: 'More', open: true, active: false, onClick: () => {} }}
      />,
    );
    expect(screen.getByText('More').closest('button')!.className).toBe('');
  });

  it('coach breakpoint adds the coach classes', () => {
    const { container } = render(<TabBar items={items} onSelect={() => {}} breakpoint="coach" />);
    expect(container.querySelector('.tabbar-wrap--coach')).not.toBeNull();
    expect(container.querySelector('nav')?.className).toContain('tabbar--coach');
  });
});
