import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Header, Inspector, Page, Split, Toolbar } from './Layout';
import { CoachChromeProvider } from './chrome';

afterEach(cleanup);

describe('coach layout kit', () => {
  it('Header: one h1, eyebrow, subtitle, pills on the title row, actions flush right', () => {
    const { container } = render(
      <Header
        eyebrow="Coach"
        title="Clients"
        subtitle="14 clients, 5 need attention"
        pills={<span>5 need you</span>}
        actions={<span>Invite</span>}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelector('.co-title-row .co-pills')?.textContent).toBe('5 need you');
    expect(container.querySelector('.co-header > .co-actions')?.textContent).toBe('Invite');
    expect(screen.getByText('14 clients, 5 need attention').tagName).toBe('P');
  });

  it('Split: ratio class; Inspector is an aside', () => {
    const { container } = render(
      <Page>
        <Split ratio="8-4">
          <div>main</div>
          <Inspector label="Details">side</Inspector>
        </Split>
        <Split ratio="5-7">
          <div>a</div>
          <div>b</div>
        </Split>
      </Page>,
    );
    expect(container.querySelector('.co-split--8-4')).not.toBeNull();
    expect(container.querySelector('.co-split--5-7')).not.toBeNull();
    expect(screen.getByRole('complementary', { name: 'Details' })).toBeTruthy();
  });

  it('Toolbar is a labelled toolbar only when it has a label', () => {
    const { rerender } = render(<Toolbar>x</Toolbar>);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<Toolbar label="Filters">x</Toolbar>);
    expect(screen.getByRole('toolbar', { name: 'Filters' })).toBeTruthy();
  });
});

describe('Header slots (F3)', () => {
  it('renders no slots without the shell provider (backward compatible)', () => {
    render(<Header title="Today" />);
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
  });
  it('desktop: no search (parked); phone: bell with unread badge + avatar', () => {
    const chrome = {
      desktop: true,
      searchLabel: 'Search',
      onSearch: () => undefined,
      bellLabel: 'Notifications',
      bellCount: 12,
      onBell: () => undefined,
      live: null,
      avatar: <button type="button">Me</button>,
    };
    const { unmount } = render(
      <CoachChromeProvider value={chrome}>
        <Header title="Today" />
      </CoachChromeProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Notifications/ })).toBeNull();
    unmount();
    render(
      <CoachChromeProvider value={{ ...chrome, desktop: false }}>
        <Header title="Today" />
      </CoachChromeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Notifications (12)' })).toBeTruthy();
    expect(screen.getByText('9+')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Me' })).toBeTruthy();
  });
});
