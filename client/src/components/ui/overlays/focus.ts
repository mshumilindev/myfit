/** The element focused now: where focus returns to when an overlay closes. */
export function activeAnchor(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function isTextEditableElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  // A <select> opens a native picker, not a text keyboard, so it must NOT put
  // the sheet into keyboard mode (that's what made the Range picker jump).
  if (el instanceof HTMLTextAreaElement) return true;
  // Only inputs that bring up a text keyboard: a checkbox / switch, radio, slider, button or file input takes focus on a
  // tap too, and treating it as typing moved the sheet under the finger so the tap was lost.
  return el instanceof HTMLInputElement && !NON_TEXT_INPUT.has(el.type);
}

const NON_TEXT_INPUT = new Set([
  'checkbox',
  'radio',
  'range',
  'button',
  'submit',
  'reset',
  'image',
  'file',
  'color',
]);
