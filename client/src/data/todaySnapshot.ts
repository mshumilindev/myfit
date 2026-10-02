/**
 * A frozen copy of Today as it looks right now — taken when the user taps
 * "Themes", so the Themes page can show the real screen (current layout, current
 * theme) instead of a drawing. Kept in memory only; a page opened by link
 * (no snapshot) shows a neutral tile instead.
 */
export interface TodaySnapshot {
  html: string;
  /** Layout width of the live screen in px, so the copy can be scaled down exactly. */
  width: number;
}

let snap: TodaySnapshot | null = null;

/** Copy `el` (the Today screen). Ids are dropped so the copy never clashes with the live DOM. */
export function captureToday(el: Element | null): void {
  if (!(el instanceof HTMLElement)) return;
  const copy = el.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');
  copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  copy.querySelectorAll('script,iframe,video,audio').forEach((n) => n.remove());
  snap = { html: copy.outerHTML, width: Math.max(el.clientWidth, 320) };
}

export function todaySnapshot(): TodaySnapshot | null {
  return snap;
}

export function clearTodaySnapshot(): void {
  snap = null;
}
