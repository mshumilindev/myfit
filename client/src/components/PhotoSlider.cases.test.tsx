import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { PhotoSlider } from './PhotoSlider';

const scrollTo = vi.fn();

beforeEach(() => {
  setLocale('en');
  scrollTo.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: scrollTo,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 300,
  });
});
afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
});

const IMGS = ['a.jpg', 'b.jpg', 'c.jpg'];

describe('PhotoSlider', () => {
  it('is a modal dialog labelled by the title, portalled to body, with one image per frame', () => {
    render(<PhotoSlider images={IMGS} title="Bench press" onClose={() => undefined} />);
    const dlg = screen.getByRole('dialog', { name: 'Bench press' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.parentElement).toBe(document.body);
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('alt'))).toEqual([
      '1 / 3',
      '2 / 3',
      '3 / 3',
    ]);
  });

  it('labels a two-frame movement Start / End', () => {
    render(<PhotoSlider images={['a', 'b']} title="Curl" onClose={() => undefined} />);
    expect(screen.getByAltText('Start')).toBeTruthy();
    expect(screen.getByAltText('End')).toBeTruthy();
  });

  it('hides the step controls for a single image', () => {
    render(<PhotoSlider images={['only']} title="One" onClose={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
  });

  it('scrolls to the start frame on mount', () => {
    render(<PhotoSlider images={IMGS} title="T" start={2} onClose={() => undefined} />);
    expect(scrollTo).toHaveBeenCalledWith({ left: 600, behavior: 'instant' });
  });

  it('closes via the scrim, the close button and Escape', () => {
    const onClose = vi.fn();
    render(<PhotoSlider images={IMGS} title="T" onClose={onClose} />);
    const closes = screen.getAllByRole('button', { name: 'Close' });
    expect(closes).toHaveLength(2);
    closes.forEach((b) => fireEvent.click(b));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('steps with the buttons and arrow keys, clamped to the frame range', () => {
    render(<PhotoSlider images={IMGS} title="T" onClose={() => undefined} />);
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    // idx 0 -> clamps at 0
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
  });

  it('tracks the visible frame from scroll position and disables Next on the last', () => {
    const { container } = render(<PhotoSlider images={IMGS} title="T" onClose={() => undefined} />);
    const track = container.ownerDocument.querySelector('.ps-track') as HTMLElement;
    track.scrollLeft = 600;
    fireEvent.scroll(track);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });
  });

  it('jumps to a frame from the segmented control', () => {
    render(<PhotoSlider images={IMGS} title="T" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '3 / 3' }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: 'smooth' });
  });
});
