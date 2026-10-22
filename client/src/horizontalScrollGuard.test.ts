// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installHorizontalScrollGuard } from './horizontalScrollGuard';

describe('installHorizontalScrollGuard (SPO-146)', () => {
  let off = () => {};
  afterEach(() => off());

  it('undoes a horizontal document scroll and keeps the vertical position', () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, configurable: true });
    Object.defineProperty(window, 'scrollX', { value: 234, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 40, configurable: true });
    off = installHorizontalScrollGuard();
    window.dispatchEvent(new Event('touchcancel'));
    expect(scrollTo).toHaveBeenCalledWith(0, 40);
  });

  it('does nothing while the document is not scrolled sideways', () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, configurable: true });
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
    off = installHorizontalScrollGuard();
    window.dispatchEvent(new Event('scroll'));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stops listening after the returned cleanup runs', () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, configurable: true });
    Object.defineProperty(window, 'scrollX', { value: 50, configurable: true });
    off = installHorizontalScrollGuard();
    off();
    window.dispatchEvent(new Event('scroll'));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
