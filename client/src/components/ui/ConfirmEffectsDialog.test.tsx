import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setViewport } from '../../coach/testViewport';
import { ConfirmEffectsDialog, type ConfirmEffectsDialogProps } from './ConfirmEffectsDialog';

afterEach(cleanup);

const base = (): ConfirmEffectsDialogProps => ({
  title: 'Delete thread?',
  cancelLabel: 'Keep',
  confirmLabel: 'Delete',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
});

describe('ConfirmEffectsDialog', () => {
  it('wide screen: a centred alertdialog named by its title with Cancel focused first', () => {
    setViewport(1280);
    render(<ConfirmEffectsDialog {...base()} />);
    const dlg = screen.getByRole('alertdialog', { name: 'Delete thread?' });
    expect(dlg.className).toContain('uicfx-dialog');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.className).toContain('uit--accent');
    expect(document.querySelector('.sheet')).toBeNull();
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Keep' }));
  });

  it('phone: a bottom sheet alertdialog; dismissable=false keeps the centred dialog', () => {
    setViewport(390);
    const { unmount } = render(<ConfirmEffectsDialog {...base()} />);
    expect(document.querySelector('.sheet')).toBeTruthy();
    expect(screen.getByRole('alertdialog', { name: 'Delete thread?' })).toBeTruthy();
    unmount();
    render(<ConfirmEffectsDialog {...base()} dismissable={false} />);
    expect(document.querySelector('.sheet')).toBeNull();
    expect(document.querySelector('.uicfx-dialog')).toBeTruthy();
  });

  it('confirm and cancel buttons fire their handlers; confirm is danger, cancel primary', () => {
    setViewport(1280);
    const p = base();
    render(<ConfirmEffectsDialog {...p} />);
    const del = screen.getByRole('button', { name: 'Delete' });
    const keep = screen.getByRole('button', { name: 'Keep' });
    expect(del.className).toContain('uibtn--danger');
    expect(keep.className).toContain('uibtn--primary');
    fireEvent.click(del);
    fireEvent.click(keep);
    expect(p.onConfirm).toHaveBeenCalledTimes(1);
    expect(p.onCancel).toHaveBeenCalledTimes(1);
  });

  it('variants and initialFocus change the buttons and the focused one', () => {
    setViewport(1280);
    render(
      <ConfirmEffectsDialog
        {...base()}
        confirmVariant="primary"
        cancelVariant="secondary"
        initialFocus="confirm"
      />,
    );
    const del = screen.getByRole('button', { name: 'Delete' });
    expect(del.className).toContain('uibtn--primary');
    expect(screen.getByRole('button', { name: 'Keep' }).className).toContain('uibtn--secondary');
    expect(document.activeElement).toBe(del);
  });

  it('Esc cancels when dismissable, not when dismissable=false', () => {
    setViewport(1280);
    const p = base();
    const { unmount } = render(<ConfirmEffectsDialog {...p} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    unmount();
    const q = base();
    render(<ConfirmEffectsDialog {...q} dismissable={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(q.onCancel).not.toHaveBeenCalled();
  });

  it('the scrim cancels only when dismissable; a press inside the dialog does not', () => {
    setViewport(1280);
    const p = base();
    const { unmount } = render(<ConfirmEffectsDialog {...p} />);
    fireEvent.click(screen.getByRole('alertdialog'));
    expect(p.onCancel).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('.dialog-scrim') as HTMLElement);
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    unmount();
    const q = base();
    render(<ConfirmEffectsDialog {...q} dismissable={false} />);
    fireEvent.click(document.querySelector('.dialog-scrim') as HTMLElement);
    expect(q.onCancel).not.toHaveBeenCalled();
  });

  it('shows body, quote, effects and small print only when given', () => {
    setViewport(1280);
    const { rerender } = render(<ConfirmEffectsDialog {...base()} />);
    for (const c of ['body', 'quote', 'fx', 'small', 'check'])
      expect(document.querySelector(`.uicfx-${c}`)).toBeNull();
    rerender(
      <ConfirmEffectsDialog
        {...base()}
        body="This removes it."
        quote="Leg day notes"
        effects={[
          { icon: 'user', text: 'Oleh stops seeing it' },
          { icon: 'bell', text: 'Alerts are cleared' },
        ]}
        small="You can undo for 8 seconds"
      />,
    );
    expect(document.querySelector('.uicfx-body')?.textContent).toBe('This removes it.');
    expect(document.querySelector('.uicfx-quote-t')?.textContent).toBe('Leg day notes');
    expect(document.querySelectorAll('.uicfx-fx li')).toHaveLength(2);
    expect(screen.getByText('Oleh stops seeing it')).toBeTruthy();
    expect(document.querySelector('.uicfx-small .ui-icon')).toBeTruthy();
  });

  it('smallIcon=false drops the icon before the small print', () => {
    setViewport(1280);
    render(<ConfirmEffectsDialog {...base()} small="fine" smallIcon={false} />);
    expect(document.querySelector('.uicfx-small .ui-icon')).toBeNull();
  });

  it('the optional check reports its new value', () => {
    setViewport(1280);
    const onChange = vi.fn();
    render(
      <ConfirmEffectsDialog
        {...base()}
        check={{ label: 'Also delete my notes', checked: false, onChange }}
      />,
    );
    const box = screen.getByLabelText('Also delete my notes') as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('loading disables the confirm button and ignores taps', () => {
    setViewport(1280);
    const p = base();
    render(<ConfirmEffectsDialog {...p} loading />);
    const del = screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    expect(del.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(del);
    expect(p.onConfirm).not.toHaveBeenCalled();
  });

  it('without confirmLabel it is an information dialog with only the cancel button', () => {
    setViewport(1280);
    render(
      <ConfirmEffectsDialog title="Code" cancelLabel="Close" onCancel={vi.fn()}>
        <span>123456</span>
      </ConfirmEffectsDialog>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('123456')).toBeTruthy();
  });

  it('iconTone accent is calm; a custom icon and tone are applied', () => {
    setViewport(1280);
    render(<ConfirmEffectsDialog {...base()} iconTone="accent" tone="rest" icon="bell" />);
    expect(document.querySelector('.uicfx')?.className).toContain('uicfx--calm');
    expect(screen.getByRole('alertdialog').className).toContain('uit--rest');
  });
});
