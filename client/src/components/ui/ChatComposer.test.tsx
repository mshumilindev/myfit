import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChatComposer, type ChatComposerProps } from './ChatComposer';

afterEach(cleanup);

function setup(over: Partial<ChatComposerProps> = {}) {
  const props: ChatComposerProps = {
    value: '',
    onChange: vi.fn(),
    onSend: vi.fn(),
    placeholder: 'Write to Oleh',
    sendLabel: 'Send',
    emptyReason: 'Write a message to send it',
    ...over,
  };
  const utils = render(<ChatComposer {...props} />);
  const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
  const field = screen.getByRole('textbox', { name: 'Write to Oleh' }) as HTMLTextAreaElement;
  return { props, send, field, ...utils };
}

describe('ChatComposer', () => {
  it('empty: Send is disabled and the field is described by a visually hidden empty reason', () => {
    const { send, field } = setup();
    expect(send.disabled).toBe(true);
    const why = document.getElementById('uicomp-why') as HTMLElement;
    expect(why.textContent).toBe('Write a message to send it');
    expect(why.className).toBe('visually-hidden');
    expect(field.getAttribute('aria-describedby')).toBe('uicomp-why');
    expect(send.getAttribute('aria-describedby')).toBe('uicomp-why');
  });

  it('whitespace only counts as empty', () => {
    const { send } = setup({ value: '   \n ' });
    expect(send.disabled).toBe(true);
  });

  it('with text Send is enabled, fires onSend, and nothing is announced', () => {
    const { send, field, props } = setup({ value: 'hi' });
    expect(send.disabled).toBe(false);
    expect(document.getElementById('uicomp-why')).toBeNull();
    expect(field.getAttribute('aria-describedby')).toBeNull();
    fireEvent.click(send);
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it('typing reports the new value; Enter does not send', () => {
    const { field, props } = setup();
    fireEvent.change(field, { target: { value: 'abc' } });
    expect(props.onChange).toHaveBeenCalledWith('abc');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('too long: Send disabled, field invalid and the too-long text is shown', () => {
    const { send, field } = setup({ value: 'abcdef', maxLength: 5, tooLongText: 'Too long' });
    expect(send.disabled).toBe(true);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const why = document.getElementById('uicomp-why') as HTMLElement;
    expect(why.textContent).toBe('Too long');
    expect(why.className).toBe('uicomp-why');
  });

  it('exactly at maxLength is allowed', () => {
    const { send, field } = setup({ value: 'abcde', maxLength: 5, tooLongText: 'Too long' });
    expect(send.disabled).toBe(false);
    expect(field.getAttribute('aria-invalid')).toBeNull();
  });

  it('blockedReason disables Send and is shown once there is text', () => {
    const { send } = setup({ value: 'hi', blockedReason: 'Vault locked' });
    expect(send.disabled).toBe(true);
    expect(document.getElementById('uicomp-why')?.textContent).toBe('Vault locked');
  });

  it('empty with a blockedReason still shows the empty reason, not the blocked one', () => {
    setup({ blockedReason: 'Vault locked' });
    expect(document.getElementById('uicomp-why')?.textContent).toBe('Write a message to send it');
  });

  it('allowEmpty lets an empty field send, and blockedReason shows then', () => {
    const { send, rerender, props } = setup({ allowEmpty: true });
    expect(send.disabled).toBe(false);
    expect(document.getElementById('uicomp-why')).toBeNull();
    rerender(<ChatComposer {...props} allowEmpty blockedReason="Offline queue full" />);
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById('uicomp-why')?.textContent).toBe('Offline queue full');
  });

  it('disabled disables both field and Send and announces no reason', () => {
    const { send, field } = setup({ value: 'hi', disabled: true, blockedReason: 'x' });
    expect(send.disabled).toBe(true);
    expect(field.disabled).toBe(true);
    expect(document.getElementById('uicomp-why')).toBeNull();
  });

  it('renders lead, chips and footnote only when given', () => {
    const { container, rerender, props } = setup();
    expect(container.querySelector('.uicomp-lead')).toBeNull();
    expect(container.querySelector('.uicomp-chips')).toBeNull();
    expect(container.querySelector('.uicomp-foot')).toBeNull();
    rerender(
      <ChatComposer
        {...props}
        lead={<button>Share</button>}
        chips={<span>Private note</span>}
        footnote="End-to-end encrypted"
      />,
    );
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(container.querySelector('.uicomp-chips')?.textContent).toBe('Private note');
    expect(container.querySelector('.uicomp-foot')?.textContent).toBe('End-to-end encrypted');
  });
});
