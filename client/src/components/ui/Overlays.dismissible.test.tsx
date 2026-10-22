import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sheet } from './Overlays';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const scrim = () => document.querySelector('.scrim') as HTMLElement;
const grip = () => document.querySelector('.sheet-grip') as HTMLElement;

describe('Sheet dismissible', () => {
  it('default: the close button, the scrim and Escape all close it', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Sheet onClose={onClose} label="Plain">
        body
      </Sheet>,
    );
    expect(document.querySelector('.sheet-close')).not.toBeNull();
    fireEvent.click(scrim());
    act(() => void vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('default: Escape closes it', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Sheet onClose={onClose}>body</Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => void vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismissible={false}: no close button; scrim, Escape and a swipe on the grabber do nothing', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onScrim = vi.fn();
    render(
      <Sheet onClose={onClose} onScrimClick={onScrim} dismissible={false} label="Blocking">
        <button>Inside</button>
      </Sheet>,
    );
    expect(document.querySelector('.sheet-close')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Blocking' })).toBeTruthy();
    fireEvent.click(scrim());
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.touchStart(grip(), { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(grip(), { touches: [{ clientY: 700 }] });
    fireEvent.touchEnd(grip());
    act(() => void vi.advanceTimersByTime(1000));
    expect(onClose).not.toHaveBeenCalled();
    expect(onScrim).not.toHaveBeenCalled();
    expect(document.querySelector('.sheet-closing')).toBeNull();
    expect(screen.getByText('Inside')).toBeTruthy();
  });
});

describe('Sheet dismissible={false}: focus trap and inert page', () => {
  const sheetButtons = () => Array.from(document.querySelectorAll<HTMLElement>('.sheet button'));
  const press = (shiftKey = false) => fireEvent.keyDown(document, { key: 'Tab', shiftKey });

  function mountBlocking() {
    const page = document.createElement('div');
    page.id = 'page';
    page.innerHTML = '<button id="behind">behind</button>';
    document.body.appendChild(page);
    const r = render(
      <Sheet onClose={() => undefined} dismissible={false} label="Blocking">
        <button>One</button>
        <button>Two</button>
        <button>Three</button>
      </Sheet>,
    );
    return { page, ...r };
  }

  it('Tab on the last control goes to the first, Shift+Tab on the first goes to the last', () => {
    const { page } = mountBlocking();
    const [one, , three] = sheetButtons();
    three.focus();
    press();
    expect(document.activeElement).toBe(one);
    press(true);
    expect(document.activeElement).toBe(three);
    page.remove();
  });

  it('Tab from the sheet itself enters the controls; Tab from outside it is pulled back in', () => {
    const { page } = mountBlocking();
    const [one, , three] = sheetButtons();
    (document.querySelector('.sheet') as HTMLElement).focus();
    press();
    expect(document.activeElement).toBe(one);
    (page.querySelector('#behind') as HTMLElement).focus();
    press(true);
    expect(document.activeElement).toBe(three);
    page.remove();
  });

  it('a middle control is left to the browser (no cycle, not prevented)', () => {
    const { page } = mountBlocking();
    sheetButtons()[1].focus();
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    page.remove();
  });

  it('with no control inside, focus stays on the sheet', () => {
    render(
      <Sheet onClose={() => undefined} dismissible={false} label="Empty">
        text only
      </Sheet>,
    );
    press();
    expect(document.activeElement).toBe(document.querySelector('.sheet'));
  });

  it('the page behind is inert while it is mounted, restored on unmount; later layers stay usable', () => {
    const { page, unmount } = mountBlocking();
    expect(page.hasAttribute('inert')).toBe(true);
    const later = document.createElement('div');
    document.body.appendChild(later); // a confirm dialog opened from the sheet
    expect(later.hasAttribute('inert')).toBe(false);
    unmount();
    expect(page.hasAttribute('inert')).toBe(false);
    page.remove();
    later.remove();
  });

  it('focus inside a later portal layer / aria-modal (a Sheet of a confirm dialog) keeps its own Tab', () => {
    const { page } = mountBlocking();
    const later = document.createElement('div');
    later.className = 'portal-layer';
    later.innerHTML =
      '<div aria-modal="true"><button id="later-a">a</button><button id="later-b">b</button></div>';
    document.body.appendChild(later);
    (later.querySelector('#later-b') as HTMLElement).focus();
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(later.querySelector('#later-b'));
    page.remove();
    later.remove();
  });

  it('two blocking sheets: only the top one acts on Tab, and closing the lower keeps the page inert', () => {
    const page = document.createElement('div');
    page.innerHTML = '<button id="behind">behind</button>';
    document.body.appendChild(page);
    const low = render(
      <Sheet onClose={() => undefined} dismissible={false} label="Low">
        <button id="l1">l1</button>
        <button id="l2">l2</button>
      </Sheet>,
    );
    const high = render(
      <Sheet onClose={() => undefined} dismissible={false} label="High">
        <button id="h1">h1</button>
        <button id="h2">h2</button>
      </Sheet>,
    );
    const h2 = document.querySelector('#h2') as HTMLElement;
    h2.focus();
    press();
    expect(document.activeElement).toBe(document.querySelector('#h1'));
    expect(page.hasAttribute('inert')).toBe(true);
    low.unmount();
    expect(page.hasAttribute('inert')).toBe(true); // the upper sheet still blocks
    high.unmount();
    expect(page.hasAttribute('inert')).toBe(false);
    page.remove();
  });

  it('closing the upper of two blocking sheets makes the lower usable again and the page stays inert', () => {
    const page = document.createElement('div');
    document.body.appendChild(page);
    const low = render(
      <Sheet onClose={() => undefined} dismissible={false} label="Low">
        <button>l1</button>
      </Sheet>,
    );
    const lowLayer = document.querySelector('.portal-layer') as HTMLElement;
    const high = render(
      <Sheet onClose={() => undefined} dismissible={false} label="High">
        <button>h1</button>
      </Sheet>,
    );
    expect(lowLayer.hasAttribute('inert')).toBe(true);
    high.unmount();
    expect(lowLayer.hasAttribute('inert')).toBe(false);
    expect(page.hasAttribute('inert')).toBe(true);
    low.unmount();
    expect(page.hasAttribute('inert')).toBe(false);
    page.remove();
  });

  it('a dismissible sheet changes nothing about the page or Tab', () => {
    const page = document.createElement('div');
    document.body.appendChild(page);
    render(
      <Sheet onClose={() => undefined}>
        <button>A</button>
      </Sheet>,
    );
    expect(page.hasAttribute('inert')).toBe(false);
    page.remove();
  });
});
