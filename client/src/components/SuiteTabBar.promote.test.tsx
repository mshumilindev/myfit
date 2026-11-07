import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SuiteTabBar } from './SuiteTabBar';
import { setViewport } from '../coach/testViewport';

afterEach(cleanup);

const more = (id: string, extra: object = {}) => ({
  id,
  label: id,
  icon: 'lock',
  onSelect: vi.fn(),
  ...extra,
});

// Owner rule 07.11: a phone bar with fewer than 5 buttons (More included) pulls destinations out of More.
describe('SuiteTabBar fills a short bar from More', () => {
  it('Users + More becomes Users, two promoted destinations and More; a submenu row stays in More', () => {
    setViewport(390);
    const addons = more('addons');
    const privacy = more('privacy');
    const onSelect = vi.fn();
    render(
      <SuiteTabBar
        app="roster"
        noAccount
        items={[{ id: 'users', label: 'Users', icon: 'user' }]}
        onSelect={onSelect}
        moreItems={[
          addons,
          privacy,
          more('language', {
            submenu: { title: 'L', value: 'en', options: [], onChange: vi.fn() },
          }),
        ]}
      />,
    );
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Users', 'addons', 'privacy']));
    expect(labels.filter((l) => l === 'language')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'addons' }));
    expect(addons.onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('a full bar (4 tabs + More) is left alone', () => {
    setViewport(390);
    const addons = more('addons');
    render(
      <SuiteTabBar
        app="roster"
        noAccount
        items={['a', 'b', 'c', 'd'].map((id) => ({ id, label: id, icon: 'user' }))}
        onSelect={vi.fn()}
        moreItems={[addons]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'addons' })).toBeNull();
  });
});
