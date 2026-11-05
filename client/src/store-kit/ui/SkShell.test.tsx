// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkShell } from './SkShell';

afterEach(cleanup);

describe('SkShell', () => {
  it('renders the slots around a main landmark', () => {
    const { container } = render(
      <SkShell
        sidebar={<aside>side</aside>}
        header={<header>head</header>}
        tabBar={<nav>tabs</nav>}
        tray={<div>tray</div>}
      >
        <p>content</p>
      </SkShell>,
    );
    expect(screen.getByRole('main').textContent).toBe('content');
    for (const t of ['side', 'head', 'tabs', 'tray']) expect(screen.getByText(t)).toBeTruthy();
    expect(container.querySelector('.sk-shl-tray-bar')).toBeNull();
  });
  it('replaces the tab bar with the action bar', () => {
    const { container } = render(
      <SkShell tabBar={<nav>tabs</nav>} bar={<div>bar</div>} tray={<div>tray</div>}>
        x
      </SkShell>,
    );
    expect(screen.queryByText('tabs')).toBeNull();
    expect(screen.getByText('bar')).toBeTruthy();
    expect(container.querySelector('.sk-shl-tray-bar')).not.toBeNull();
  });
  it('omits empty slots', () => {
    const { container } = render(<SkShell>x</SkShell>);
    expect(container.querySelector('.sk-shl-side')).toBeNull();
    expect(container.querySelector('.sk-shl-hd')).toBeNull();
    expect(container.querySelector('.sk-shl-tray')).toBeNull();
  });
});
