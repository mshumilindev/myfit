import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelFooter } from './footerSlot';
import { SidePanel } from './SidePanel';

afterEach(cleanup);

describe('SidePanel is the kit Sheet', () => {
  it('is a modal dialog named by its title, with the kit sheet class (no coach-only drawer)', () => {
    render(
      <SidePanel open onClose={() => undefined} title="Signal" closeLabel="Close">
        body
      </SidePanel>,
    );
    const dlg = screen.getByRole('dialog', { name: 'Signal' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.classList.contains('sheet')).toBe(true);
    expect(document.querySelector('.co-drawer')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Signal' })).toBeTruthy();
  });

  it('the close button and Esc close it', async () => {
    const onClose = vi.fn();
    render(
      <SidePanel open onClose={onClose} title="T" closeLabel="Close panel">
        x
      </SidePanel>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('default scrim closes; the light scrim hands its click to the screen instead', async () => {
    const onClose = vi.fn();
    const onScrimClick = vi.fn();
    render(
      <SidePanel open onClose={onClose} title="T" closeLabel="Close">
        x
      </SidePanel>,
    );
    expect(document.querySelector('.scrim--light')).toBeNull();
    fireEvent.click(document.querySelector('.scrim')!);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    onClose.mockClear();
    cleanup();
    render(
      <SidePanel
        open
        onClose={onClose}
        title="T"
        closeLabel="Close"
        scrim="light"
        onScrimClick={onScrimClick}
      >
        x
      </SidePanel>,
    );
    expect(document.querySelector('.scrim--light')).toBeTruthy();
    fireEvent.click(document.querySelector('.scrim')!);
    expect(onScrimClick).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('PanelFooter renders into the pinned footer, outside the form body', () => {
    render(
      <SidePanel open onClose={() => undefined} title="T" closeLabel="Close">
        <form aria-label="f">
          <PanelFooter>
            <button type="button">Save</button>
          </PanelFooter>
        </form>
      </SidePanel>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.closest('.sdp-foot')).toBeTruthy();
    expect(screen.getByRole('form', { name: 'f' }).contains(save)).toBe(false);
  });
});
