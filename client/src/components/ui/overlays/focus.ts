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
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}
