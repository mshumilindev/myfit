// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkNavItem } from './SkNavItem';
import { SkSidebar, SkSidebarUser } from './SkSidebar';

afterEach(cleanup);

describe('SkSidebar', () => {
  it('renders a labelled landmark with title, nav items, back and user', () => {
    render(
      <SkSidebar
        title="Add-ons"
        label="Sections"
        back={<SkNavItem label="Back to Spotter" />}
        user={<SkSidebarUser avatar={<span>AK</span>} name="Alex" role="member" />}
      >
        <SkNavItem label="Discover" active />
      </SkSidebar>,
    );
    expect(screen.getAllByLabelText('Sections').length).toBeGreaterThan(0);
    expect(screen.getByText('Add-ons')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discover' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('button', { name: 'Back to Spotter' })).toBeTruthy();
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('member')).toBeTruthy();
  });
  it('omits optional blocks when not given', () => {
    const { container } = render(
      <SkSidebar title="t" label="l">
        <SkNavItem label="a" />
      </SkSidebar>,
    );
    expect(container.querySelector('.sk-sdb-back')).toBeNull();
    expect(container.querySelector('.sk-sdb-user')).toBeNull();
  });
});
