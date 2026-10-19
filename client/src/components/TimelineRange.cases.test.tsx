import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { TimelineRange } from './TimelineRange';

const units = { hrShort: 'h', minShort: 'm' };
const capture = vi.fn();

// jsdom's PointerEvent is missing/limited: use a MouseEvent subclass so clientX survives.
vi.hoisted(() => {
  class PE extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  (globalThis as { PointerEvent?: unknown }).PointerEvent = PE;
});

beforeEach(() => {
  setLocale('en');
  capture.mockReset();
  Element.prototype.setPointerCapture = capture;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        left: 0,
        right: 1000,
        top: 0,
        bottom: 10,
        width: 1000,
        height: 10,
        x: 0,
        y: 0,
      }) as DOMRect,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const track = () => document.querySelector('.tlr-track') as HTMLElement;
const startH = () => screen.getByRole('slider', { name: 'Start' });
const endH = () => screen.getByRole('slider', { name: 'End' });

function setup(start: number, duration: number) {
  const onChange = vi.fn();
  render(<TimelineRange start={start} duration={duration} onChange={onChange} units={units} />);
  return onChange;
}
// position the pointer at a minute on the 24h scale (1000px wide track = 1440 min)
const at = (min: number) => (min / 1440) * 1000;

describe('TimelineRange', () => {
  it('shows start, end (wrapping past midnight) and a compact duration', () => {
    setup(8 * 60 + 30, 90);
    expect(document.querySelector('.tlr-start')!.textContent).toBe('08:30');
    expect(document.querySelector('.tlr-end')!.textContent).toBe('10:00');
    expect(document.querySelector('.tlr-dur')!.textContent).toBe('1h 30m');
    cleanup();
    setup(23 * 60, 120);
    expect(document.querySelector('.tlr-end')!.textContent).toBe('01:00');
  });

  it('formats whole hours, bare minutes and clamps duration to 12h', () => {
    setup(60, 120);
    expect(document.querySelector('.tlr-dur')!.textContent).toBe('2h');
    cleanup();
    setup(60, 45);
    expect(document.querySelector('.tlr-dur')!.textContent).toBe('45m');
    cleanup();
    setup(60, 5000);
    expect(document.querySelector('.tlr-dur')!.textContent).toBe('12h');
    cleanup();
    setup(60, -10);
    expect(document.querySelector('.tlr-dur')!.textContent).toBe('0m');
  });

  it('draws a 00:00 → 00:00 scale with :15-rounded interior ticks', () => {
    setup(600, 60);
    expect([...document.querySelectorAll('.tlr-scale span')].map((s) => s.textContent)).toEqual([
      '00:00',
      '06:00',
      '12:00',
      '18:00',
      '00:00',
    ]);
  });

  it('extends the scale past midnight for a late start', () => {
    setup(22 * 60, 120); // winEnd = 22h + 12h = 34h
    const marks = [...document.querySelectorAll('.tlr-scale span')].map((s) => s.textContent);
    expect(marks[0]).toBe('00:00');
    expect(marks[2]).toBe('17:00');
    expect(marks[4]).toBe('10:00'); // 34h wraps to 10:00
  });

  it('places the handles proportionally on the scale', () => {
    setup(720, 360);
    expect(startH().style.left).toBe('50%');
    expect(endH().style.left).toBe('75%');
    expect((document.querySelector('.tlr-range') as HTMLElement).style.width).toBe('25%');
  });

  it('captures the pointer on the track when a handle is grabbed', () => {
    setup(600, 120);
    fireEvent.pointerDown(startH(), { pointerId: 7 });
    fireEvent.pointerDown(endH(), { pointerId: 8 });
    expect(capture).toHaveBeenCalledWith(7);
    expect(capture).toHaveBeenCalledWith(8);
  });

  it('ignores pointer moves when nothing is grabbed', () => {
    const onChange = setup(600, 120);
    fireEvent.pointerMove(track(), { clientX: 300 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drags the end handle, snapping to 5 minutes', () => {
    const onChange = setup(600, 120);
    fireEvent.pointerDown(endH());
    fireEvent.pointerMove(track(), { clientX: at(14 * 60 + 2) });
    expect(onChange).toHaveBeenLastCalledWith(600, 240); // 14:00 snapped
  });

  it('pushes the start left when the end is dragged below the 1h minimum', () => {
    const onChange = setup(600, 120);
    fireEvent.pointerDown(endH());
    fireEvent.pointerMove(track(), { clientX: at(10 * 60 + 20) });
    expect(onChange).toHaveBeenLastCalledWith(560, 60);
  });

  it('stops the start at 00:00 when the end is dragged to the very left', () => {
    const onChange = setup(600, 120);
    fireEvent.pointerDown(endH());
    fireEvent.pointerMove(track(), { clientX: 0 });
    expect(onChange).toHaveBeenLastCalledWith(0, 60);
  });

  it('caps the end drag at start + 12h', () => {
    const onChange = setup(0, 120);
    fireEvent.pointerDown(endH());
    fireEvent.pointerMove(track(), { clientX: 1000 });
    expect(onChange).toHaveBeenLastCalledWith(0, 720);
  });

  it('drags the start; the end stays put when the gap is within 1h..12h', () => {
    const onChange = setup(600, 240); // 10:00 - 14:00
    fireEvent.pointerDown(startH());
    fireEvent.pointerMove(track(), { clientX: at(12 * 60) });
    expect(onChange).toHaveBeenLastCalledWith(720, 120);
  });

  it('pushes the end right when the start is dragged within the 1h minimum', () => {
    const onChange = setup(600, 240);
    fireEvent.pointerDown(startH());
    fireEvent.pointerMove(track(), { clientX: at(13 * 60 + 30) });
    expect(onChange).toHaveBeenLastCalledWith(810, 60);
  });

  it('drags the end left when the start is dragged beyond a 12h gap', () => {
    const onChange = setup(600, 240);
    fireEvent.pointerDown(startH());
    fireEvent.pointerMove(track(), { clientX: 0 });
    expect(onChange).toHaveBeenLastCalledWith(0, 720);
  });

  it('never lets the start pass 23:45', () => {
    const onChange = setup(600, 240);
    fireEvent.pointerDown(startH());
    fireEvent.pointerMove(track(), { clientX: 1000 });
    expect(onChange).toHaveBeenLastCalledWith(1425, 60);
  });

  it('grabbing the range body moves the start handle', () => {
    const onChange = setup(600, 240);
    fireEvent.pointerDown(document.querySelector('.tlr-range')!);
    fireEvent.pointerMove(track(), { clientX: at(12 * 60) });
    expect(onChange).toHaveBeenCalledWith(720, 120);
  });

  it('stops dragging on release', () => {
    const onChange = setup(600, 240);
    fireEvent.pointerDown(startH());
    fireEvent.pointerUp(track());
    fireEvent.pointerMove(track(), { clientX: at(700) });
    expect(onChange).not.toHaveBeenCalled();
  });
});
