import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Rail, RailItem } from './Rail';
import { TabBar } from './TabBar';
import { BellButton } from './BrandBar';
import { Segmented } from './Segmented';

afterEach(cleanup);

const brand = <span>S</span>;

describe('Rail (defaults = the real rail)', () => {
  it('keeps the title tooltip, no custom tooltip, no variant classes', () => {
    const { container } = render(
      <Rail brand={brand}>
        <RailItem icon="house" label="Today" />
      </Rail>,
    );
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.className).toBe('rail');
    const btn = screen.getByRole('button', { name: 'Today' });
    expect(btn.getAttribute('title')).toBe('Today');
    expect(container.querySelector('.rail-tip')).toBeNull();
    expect(btn.className).toBe('rail-item');
  });

  it('renders the legacy badge node exactly as before', () => {
    const { container } = render(
      <Rail brand={brand}>
        <RailItem icon="bell" ariaLabel="Alerts" badge="9+" />
      </Rail>,
    );
    expect(container.querySelector('.rail-notif-badge')?.textContent).toBe('9+');
    expect(container.querySelector('.uibadge')).toBeNull();
  });
});

describe('Rail labelled / compact (R-KIT-20)', () => {
  it('labelled adds the class and keeps visible labels', () => {
    const { container } = render(
      <Rail brand={brand} labelled>
        <RailItem icon="house" label="Today" />
      </Rail>,
    );
    expect((container.querySelector('aside') as HTMLElement).className).toContain('rail--labelled');
    expect(container.querySelector('.rail-label')?.textContent).toBe('Today');
    expect(container.querySelector('.rail-tip')).toBeNull();
  });

  it('compact: aria-label, tooltip text equals the name, no native title', () => {
    const { container } = render(
      <Rail brand={brand} compact labelled>
        <RailItem icon="house" label="Today" />
        <RailItem icon="bell" ariaLabel="Notifications" />
      </Rail>,
    );
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.className).toContain('rail--compact');
    expect(aside.className).not.toContain('rail--labelled'); // compact wins
    for (const name of ['Today', 'Notifications']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.getAttribute('aria-label')).toBe(name);
      expect(btn.hasAttribute('title')).toBe(false);
      expect(btn.querySelector('.rail-tip')?.textContent).toBe(name);
      // The tip is visual only: it must not be announced twice.
      expect(btn.querySelector('.rail-tip')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('Esc dismisses the tooltip without moving focus; blur re-arms it', () => {
    render(
      <Rail brand={brand} compact>
        <RailItem icon="house" label="Today" />
      </Rail>,
    );
    const btn = screen.getByRole('button', { name: 'Today' });
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(btn.className).toContain('is-tip-off');
    expect(document.activeElement).toBe(btn);
    fireEvent.blur(btn);
    expect(btn.className).not.toContain('is-tip-off');
  });

  it('count shows the kit badge and extends the accessible name', () => {
    const { container } = render(
      <Rail brand={brand} labelled>
        <RailItem
          icon="chat"
          label="Chat"
          count={23}
          countLabel="23 unread"
          live
          liveLabel="2 live"
        />
        <RailItem icon="bell" ariaLabel="Zero" count={0} countLabel="0 unread" />
      </Rail>,
    );
    expect(screen.getByRole('button', { name: 'Chat, 23 unread, 2 live' })).toBeTruthy();
    expect(container.querySelector('.uibadge--corner')?.textContent).toBe('9+');
    // 0 → no badge, and the count label is not spoken
    expect(screen.getByRole('button', { name: 'Zero' })).toBeTruthy();
    expect(container.querySelectorAll('.uibadge')).toHaveLength(1);
  });

  it('an explicit tooltip works on a non-compact rail', () => {
    const { container } = render(
      <Rail brand={brand}>
        <RailItem icon="bell" ariaLabel="Alerts" tooltip="Alerts" />
      </Rail>,
    );
    expect(container.querySelector('.rail-tip')?.textContent).toBe('Alerts');
  });

  it('breakpoint="coach" marks the rail; the default does not', () => {
    const a = render(
      <Rail brand={brand} breakpoint="coach">
        <span />
      </Rail>,
    );
    expect((a.container.querySelector('aside') as HTMLElement).className).toContain('rail--coach');
    cleanup();
    const b = render(
      <Rail brand={brand}>
        <span />
      </Rail>,
    );
    expect((b.container.querySelector('aside') as HTMLElement).className).not.toContain('coach');
  });
});

describe('TabBar badge (R-KIT-21)', () => {
  const base = [
    { id: 'a', label: 'Today', icon: 'house', active: true },
    { id: 'b', label: 'Chat', icon: 'chat' },
  ];

  it('without badges the markup has no wrapper (identical to before)', () => {
    const { container } = render(<TabBar items={base} onSelect={() => undefined} />);
    expect(container.querySelector('.tabbar-ico')).toBeNull();
    expect(container.querySelector('.uibadge')).toBeNull();
    expect(container.querySelector('.tabbar-wrap')?.className).toBe('tabbar-wrap');
  });

  it('a numeric badge renders the kit Badge (9+) and ariaLabel names the button', () => {
    const { container } = render(
      <TabBar
        items={[base[0], { ...base[1], badge: 12, ariaLabel: 'Chat, 12 unread' }]}
        onSelect={() => undefined}
      />,
    );
    expect(container.querySelector('.tabbar-ico .uibadge')?.textContent).toBe('9+');
    expect(screen.getByRole('button', { name: 'Chat, 12 unread' })).toBeTruthy();
  });

  it('badge 0 renders nothing; a node badge is placed as given', () => {
    const { container } = render(
      <TabBar
        items={[
          { ...base[0], badge: 0 },
          { ...base[1], badge: <i data-testid="dot" /> },
        ]}
        onSelect={() => undefined}
      />,
    );
    expect(container.querySelectorAll('.tabbar-ico')).toHaveLength(1);
    expect(screen.getByTestId('dot')).toBeTruthy();
  });

  it('breakpoint="coach" adds the coach classes', () => {
    const { container } = render(
      <TabBar items={base} onSelect={() => undefined} breakpoint="coach" />,
    );
    expect(container.querySelector('.tabbar-wrap--coach')).toBeTruthy();
    expect(container.querySelector('.tabbar--coach')).toBeTruthy();
  });
});

describe('BellButton uses badgeText', () => {
  it('shows 3, 9+, nothing', () => {
    const { container, rerender } = render(<BellButton label="Bell" onClick={vi.fn()} count={3} />);
    expect(container.querySelector('.app-bell-badge')?.textContent).toBe('3');
    rerender(<BellButton label="Bell" onClick={vi.fn()} count={40} />);
    expect(container.querySelector('.app-bell-badge')?.textContent).toBe('9+');
    rerender(<BellButton label="Bell" onClick={vi.fn()} count={0} />);
    expect(container.querySelector('.app-bell-badge')).toBeNull();
  });
});

describe('Segmented fill / badge (R-KIT-29)', () => {
  it('fill drops the inline columns and adds the class; default keeps them', () => {
    const opts = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
    const f = render(<Segmented fill options={opts} value="a" onChange={() => undefined} />);
    const el = f.container.firstChild as HTMLElement;
    expect(el.className).toContain('uiseg--fill');
    expect(el.style.gridTemplateColumns).toBe('');
    cleanup();
    const d = render(<Segmented options={opts} value="a" onChange={() => undefined} />);
    expect((d.container.firstChild as HTMLElement).style.gridTemplateColumns).toContain('repeat(2');
  });

  it('numeric badge: kit Badge, accessible name includes the count; 0 hidden', () => {
    const { container } = render(
      <Segmented
        value="a"
        onChange={() => undefined}
        options={[
          { value: 'a', label: 'Programs', badge: 3 },
          { value: 'b', label: 'Workouts', badge: 0 },
          { value: 'c', label: 'Chat', badge: 40, ariaLabel: '40 messages' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Programs, 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Workouts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '40 messages' })).toBeTruthy();
    expect(container.querySelectorAll('.uibadge')).toHaveLength(2);
  });
});

describe('Segmented value = null (no selection)', () => {
  it('renders every option unpressed (and unselected as tabs) and still fires onChange', () => {
    const onChange = vi.fn();
    render(
      <Segmented
        value={null}
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    const btns = screen.getAllByRole('button');
    expect(btns.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    expect(
      document.querySelector('.uiseg-opt.active, .uiseg .is-active, [aria-pressed="true"]'),
    ).toBeNull();
    fireEvent.click(btns[1]);
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
