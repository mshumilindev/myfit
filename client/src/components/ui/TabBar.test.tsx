import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('with the notch the bar stays symmetric: fewer tabs leave empty slots, the notch is always in the middle', () => {
    const three = items.slice(0, 3);
    const { container } = render(
      <TabBar items={three} onSelect={() => {}} fab={{ ariaLabel: 'Start', onClick: () => {} }} />,
    );
    const nav = container.querySelector('nav.tabbar') as HTMLElement;
    expect(nav.style.gridTemplateColumns).toBe('repeat(5, minmax(0, 1fr))');
    const kids = [...nav.children];
    expect(kids).toHaveLength(5);
    expect(kids[2].classList.contains('tabbar-gap')).toBe(true); // the notch is the 3rd of 5
    expect(kids[4].classList.contains('tabbar-pad')).toBe(true); // the missing right tab is an empty slot
    cleanup();
    const two = render(
      <TabBar
        items={items.slice(0, 2)}
        onSelect={() => {}}
        fab={{ ariaLabel: 'Start', onClick: () => {} }}
      />,
    );
    expect((two.container.querySelector('nav.tabbar') as HTMLElement).children).toHaveLength(5);
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

  describe('Start fab → × (SPO-470)', () => {
    const fab = (open: boolean, onClick = () => {}) => ({
      ariaLabel: 'Start',
      closeLabel: 'Close',
      open,
      onClick,
    });

    it('closed: a "Start" button, collapsed, no open classes', () => {
      const { container } = render(<TabBar items={items} onSelect={() => {}} fab={fab(false)} />);
      const b = screen.getByRole('button', { name: 'Start' });
      expect(b.getAttribute('aria-expanded')).toBe('false');
      expect(b.className).not.toContain('is-open');
      expect(container.querySelector('.tabbar-wrap--fab-open')).toBeNull();
    });

    it('open: renamed "Close", expanded; a twin above the drawer turns while the bar button hides', async () => {
      const { container } = render(<TabBar items={items} onSelect={() => {}} fab={fab(true)} />);
      const b = screen.getByRole('button', { name: 'Close' });
      expect(b.getAttribute('aria-expanded')).toBe('true');
      expect(container.querySelector('.tabbar-wrap--fab-open')).not.toBeNull();
      expect(container.querySelector('.tabbar-fab')?.getAttribute('aria-hidden')).toBe('true');
      const twin = document.body.querySelector('.tabbar-fab-layer .tabbar-fab');
      expect(twin).not.toBeNull();
      await waitFor(() => expect(twin?.className).toContain('is-open'));
    });

    it('open: the bar button keeps its attention ripple under the drawer; the twin has none', () => {
      const { container } = render(
        <TabBar
          items={items}
          onSelect={() => {}}
          fab={{
            ariaLabel: 'Start',
            closeLabel: 'Close',
            onClick: () => {},
            attention: true,
            open: true,
          }}
        />,
      );
      expect(container.querySelector('.tabbar-fab')?.className).toContain('is-attention');
      expect(document.body.querySelector('.tabbar-fab-layer .tabbar-fab')?.className).not.toContain(
        'is-attention',
      );
    });

    it('closing turns the twin back first, then removes it', async () => {
      const { rerender, container } = render(
        <TabBar items={items} onSelect={() => {}} fab={fab(true)} />,
      );
      const twin = document.body.querySelector('.tabbar-fab-layer .tabbar-fab');
      await waitFor(() => expect(twin?.className).toContain('is-open'));
      rerender(<TabBar items={items} onSelect={() => {}} fab={fab(false)} />);
      await waitFor(() => expect(twin?.className).not.toContain('is-open'));
      await waitFor(() => expect(document.body.querySelector('.tabbar-fab-layer')).toBeNull(), {
        timeout: 1500,
      });
      expect(container.querySelector('.tabbar-wrap--fab-open')).toBeNull();
    });

    it('steps back while another drawer is open on top of the Start drawer', async () => {
      render(<TabBar items={items} onSelect={() => {}} fab={fab(true)} />);
      const layer = () => document.body.querySelector('.tabbar-fab-layer');
      expect(layer()?.className).not.toContain('is-covered');
      const over = document.createElement('div');
      over.className = 'portal-layer';
      over.innerHTML = '<div class="sheet"></div>';
      document.body.appendChild(over);
      await waitFor(() => expect(layer()?.className).toContain('is-covered'));
      over.remove();
      await waitFor(() => expect(layer()?.className).not.toContain('is-covered'));
    });

    it('the same button opens and closes: it only reports the click', () => {
      const onClick = vi.fn();
      const { rerender } = render(
        <TabBar items={items} onSelect={() => {}} fab={fab(false, onClick)} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      rerender(<TabBar items={items} onSelect={() => {}} fab={fab(true, onClick)} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('without a closeLabel the name stays "Start" (older callers)', () => {
      render(
        <TabBar
          items={items}
          onSelect={() => {}}
          fab={{ ariaLabel: 'Start', onClick: () => {}, open: true }}
        />,
      );
      expect(screen.getByRole('button', { name: 'Start' }).getAttribute('aria-expanded')).toBe(
        'true',
      );
    });
  });
});
