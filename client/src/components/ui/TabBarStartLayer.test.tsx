import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { TabBar, coversStartDrawer } from './TabBar';
import { Sheet } from './Overlays';

// SPO-470 regression: the × must sit above the Start drawer wherever that drawer lands in <body> (the app
// lazy-loads it, so it is mounted AFTER the button's twin), and step back only for a layer that is not the Start drawer.

afterEach(cleanup);

const items = [{ id: 'today', label: 'Today', icon: 'house', active: true }];
const twin = () => document.body.querySelector('.tabbar-fab-layer');
const bar = (open: boolean) => (
  <TabBar
    items={items}
    onSelect={() => {}}
    fab={{ ariaLabel: 'Start', closeLabel: 'Close', open, onClick: () => {} }}
  />
);

function Host(props: { startFirst: boolean; withOther?: boolean }) {
  const [late, setLate] = useState(props.startFirst);
  return (
    <>
      {bar(true)}
      <button onClick={() => setLate(true)}>load</button>
      {late && (
        <Sheet className="start-sheet" onClose={() => {}}>
          start
        </Sheet>
      )}
      {props.withOther && (
        <Sheet className="gym-sheet" onClose={() => {}}>
          other
        </Sheet>
      )}
    </>
  );
}

describe('Start fab twin vs the Start drawer (SPO-470)', () => {
  it('Start drawer mounted BEFORE the twin: the twin stays visible', async () => {
    render(<Host startFirst />);
    await waitFor(() => expect(twin()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 30));
    expect(twin()?.className).not.toContain('is-covered');
  });

  it('Start drawer mounted AFTER the twin (lazy chunk): the twin is NOT covered by it', async () => {
    render(<Host startFirst={false} />);
    await waitFor(() => expect(twin()).not.toBeNull());
    act(() => screen.getByText('load').click());
    await waitFor(() => expect(document.body.querySelector('.start-sheet')).not.toBeNull());
    await new Promise((r) => setTimeout(r, 30));
    expect(twin()?.className).not.toContain('is-covered');
    // and it sits later-or-earlier in <body> — either way it is what the user can press
    expect(twin()?.querySelector('button')?.getAttribute('aria-label')).toBe('Close');
  });

  it('another drawer on top of the Start drawer (gym picker, activity…): the twin steps back', async () => {
    render(<Host startFirst withOther />);
    await waitFor(() => expect(twin()?.className).toContain('is-covered'));
  });

  it('a dialog or full page on top also covers it; closing it brings the twin back', async () => {
    render(<Host startFirst />);
    await waitFor(() => expect(twin()).not.toBeNull());
    const dlg = document.createElement('div');
    dlg.className = 'portal-layer';
    dlg.innerHTML = '<div class="dialog-scrim"></div>';
    document.body.appendChild(dlg);
    await waitFor(() => expect(twin()?.className).toContain('is-covered'));
    dlg.remove();
    await waitFor(() => expect(twin()?.className).not.toContain('is-covered'));
    const page = document.createElement('div');
    page.className = 'portal-layer uifp-layer';
    document.body.appendChild(page);
    await waitFor(() => expect(twin()?.className).toContain('is-covered'));
    page.remove();
  });

  it('coversStartDrawer is order-independent and ignores its own layer', () => {
    const own = document.createElement('div');
    own.className = 'portal-layer';
    const start = document.createElement('div');
    start.className = 'portal-layer';
    start.innerHTML = '<div class="scrim"></div><div class="sheet start-sheet"></div>';
    const other = document.createElement('div');
    other.className = 'portal-layer';
    other.innerHTML = '<div class="scrim"></div><div class="sheet"></div>';
    document.body.append(own, start);
    expect(coversStartDrawer(own)).toBe(false);
    document.body.append(other);
    expect(coversStartDrawer(own)).toBe(true);
    other.remove();
    document.body.prepend(other); // before the Start drawer: same answer
    expect(coversStartDrawer(own)).toBe(true);
    other.remove();
    start.remove();
    own.remove();
    expect(coversStartDrawer(own)).toBe(false);
  });

  it('no flicker on close: the twin turns back to a plus first and only then is removed', async () => {
    vi.useRealTimers();
    const { rerender } = render(bar(true));
    await waitFor(() => expect(twin()?.querySelector('.is-open')).not.toBeNull());
    rerender(bar(false));
    await waitFor(() => expect(twin()?.querySelector('.is-open')).toBeNull());
    await waitFor(() => expect(twin()).toBeNull(), { timeout: 1500 });
  });
});

describe('the × never hides for a stray element (owner rule: it must not disappear)', () => {
  it('a .sheet / .scrim inside the app root does not cover the twin', async () => {
    render(
      <>
        {bar(true)}
        <div className="sheet scrim">stray, not an overlay layer</div>
        <Sheet className="start-sheet" onClose={() => {}}>
          start
        </Sheet>
      </>,
    );
    await waitFor(() => expect(twin()).not.toBeNull());
    await new Promise((r) => setTimeout(r, 30));
    expect(twin()?.className).not.toContain('is-covered');
  });

  it('a foreign layer that is already closing does not cover the twin', () => {
    const layer = document.createElement('div');
    layer.className = 'portal-layer';
    layer.innerHTML =
      '<div class="scrim scrim-closing"></div><div class="sheet sheet-closing"></div>';
    document.body.appendChild(layer);
    expect(coversStartDrawer(null)).toBe(false);
    layer.innerHTML = '<div class="scrim"></div><div class="sheet"></div>';
    expect(coversStartDrawer(null)).toBe(true);
    layer.remove();
  });
});
