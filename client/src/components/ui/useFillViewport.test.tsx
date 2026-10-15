import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useFillViewport } from './useFillViewport';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Probe() {
  const ref = useFillViewport();
  return (
    <div id="frame" style={{ overflowY: 'auto', paddingBottom: '20px' }}>
      <div id="el" ref={ref} />
    </div>
  );
}

function avail(wide: boolean): string {
  window.matchMedia = ((q: string) => ({
    matches: wide && q.includes('720'),
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const top = this.id === 'el' ? 100 : 0;
    const bottom = this.id === 'frame' ? 700 : 0;
    return {
      top,
      bottom,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    };
  });
  const { container } = render(<Probe />);
  return (container.querySelector('#el') as HTMLElement).style.getPropertyValue('--chs-avail');
}

describe('useFillViewport (SPO-110)', () => {
  it('desktop: the chat frame stops above the frame’s bottom padding', () => {
    expect(avail(true)).toBe('580px'); // 700 - 20 padding - 100 top
  });
  it('phone: edge to edge, padding is not reserved', () => {
    expect(avail(false)).toBe('600px');
  });
});
