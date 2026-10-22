import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DocReader, END_SLACK, atEnd } from './DocReader';

afterEach(cleanup);

describe('atEnd', () => {
  it('is true at the bottom, within the slack, and when the content fits', () => {
    expect(atEnd(700, 300, 1000)).toBe(true);
    expect(atEnd(1000 - 300 - END_SLACK, 300, 1000)).toBe(true);
    expect(atEnd(0, 300, 300)).toBe(true);
    expect(atEnd(0, 0, 0)).toBe(true);
  });
  it('is false anywhere above the end', () => {
    expect(atEnd(0, 300, 1000)).toBe(false);
    expect(atEnd(1000 - 300 - END_SLACK - 1, 300, 1000)).toBe(false);
  });
});

const docs = [
  { id: 'terms', label: 'Terms of Use', body: <p>terms text</p> },
  { id: 'privacy', label: 'Privacy Policy', body: <p>privacy text</p> },
];
const view = (read: Record<string, boolean>, onRead = vi.fn()) =>
  render(
    <DocReader
      docs={docs}
      read={read}
      onRead={onRead}
      readLabel="Read"
      unreadLabel="Scroll to the end"
    />,
  );

describe('DocReader', () => {
  it('lists the documents closed, each saying "Scroll to the end" until read', () => {
    view({ privacy: true });
    expect(screen.queryByText('terms text')).toBeNull();
    expect(screen.getAllByText('Scroll to the end')).toHaveLength(1);
    expect(screen.getAllByText('Read')).toHaveLength(1);
    expect(document.querySelectorAll('.uidrd-doc.is-read')).toHaveLength(1);
  });

  it('opens one document at a time and closes it again', () => {
    view({});
    fireEvent.click(screen.getByRole('button', { name: /^Terms of Use/ }));
    expect(screen.getByText('terms text')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Privacy Policy/ }));
    expect(screen.queryByText('terms text')).toBeNull();
    expect(screen.getByText('privacy text')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Privacy Policy/ }));
    expect(screen.queryByText('privacy text')).toBeNull();
  });

  it('a document that fits without scrolling is read as soon as it is shown', () => {
    const onRead = vi.fn();
    view({}, onRead);
    fireEvent.click(screen.getByRole('button', { name: /^Terms of Use/ }));
    expect(onRead).toHaveBeenCalledWith('terms');
  });

  it('a long document is read only when scrolled to its end', () => {
    const def = (k: 'scrollHeight' | 'clientHeight', v: number) =>
      Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
    def('scrollHeight', 1000);
    def('clientHeight', 300);
    try {
      const onRead = vi.fn();
      view({}, onRead);
      fireEvent.click(screen.getByRole('button', { name: /^Terms of Use/ }));
      const box = screen.getByRole('region', { name: 'Terms of Use' }) as HTMLElement;
      expect(onRead).not.toHaveBeenCalled();
      Object.defineProperty(box, 'scrollTop', { configurable: true, writable: true, value: 350 });
      fireEvent.scroll(box);
      expect(onRead).not.toHaveBeenCalled();
      expect(document.querySelector('.uidrd-prog i')?.getAttribute('style')).toContain('50%');
      box.scrollTop = 700;
      fireEvent.scroll(box);
      expect(onRead).toHaveBeenCalledWith('terms');
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
      Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
    }
  });
});
