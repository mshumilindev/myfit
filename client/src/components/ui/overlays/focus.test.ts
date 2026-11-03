import { describe, expect, it } from 'vitest';
import { isTextEditableElement } from './focus';

const input = (type: string) => {
  const el = document.createElement('input');
  el.type = type;
  return el;
};

describe('isTextEditableElement', () => {
  it.each(['text', 'search', 'email', 'password', 'tel', 'url', 'number'])(
    'a %s field raises the phone keyboard',
    (type) => expect(isTextEditableElement(input(type))).toBe(true),
  );

  // A tap on a switch focuses its checkbox; that must not put the sheet into keyboard mode: the layout moves under the
  // finger and the tap is lost (SPO-446: the first tap on "Direct connection" did nothing on a phone).
  it.each(['checkbox', 'radio', 'range', 'button', 'submit', 'file', 'color'])(
    'a %s input is not a text field',
    (type) => expect(isTextEditableElement(input(type))).toBe(false),
  );

  it('textarea and contenteditable are text fields; select and a plain div are not', () => {
    expect(isTextEditableElement(document.createElement('textarea'))).toBe(true);
    const ce = document.createElement('div');
    Object.defineProperty(ce, 'isContentEditable', { value: true });
    expect(isTextEditableElement(ce)).toBe(true);
    expect(isTextEditableElement(document.createElement('select'))).toBe(false);
    expect(isTextEditableElement(document.createElement('div'))).toBe(false);
    expect(isTextEditableElement(null)).toBe(false);
  });
});
