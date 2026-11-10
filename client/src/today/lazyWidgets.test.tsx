import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { lazyWidgets } from './lazyWidgets';
import type { WidgetCtx, WidgetDef } from './registry';

const meta = [{ id: 'w1', group: 'apex', icon: 'flame', tone: 'apex', name: () => 'W' }] as never;
const ctx = {} as WidgetCtx;

describe('lazyWidgets', () => {
  it('renders nothing until the chunk is loaded, then the real widget body', async () => {
    const load = vi.fn(async () => [
      { id: 'w1', render: () => <p>real body</p> } as unknown as WidgetDef,
    ]);
    const [w] = lazyWidgets(meta, load);
    expect(load).not.toHaveBeenCalled();
    const { container } = render(<>{w.render('S', ctx)}</>);
    expect(container.textContent).toBe('');
    await waitFor(() => expect(screen.getByText('real body')).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(1);
    // A second mount reuses the loaded chunk synchronously.
    render(<>{w.render('S', ctx)}</>);
    expect(screen.getAllByText('real body')).toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('stays empty when the chunk fails to load', async () => {
    const [w] = lazyWidgets(meta, async () => {
      throw new Error('chunk');
    });
    const { container } = render(<>{w.render('S', ctx)}</>);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe('');
  });
});
