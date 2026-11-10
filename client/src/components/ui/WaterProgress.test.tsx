import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WaterProgress, gravityAngle, waterLevel } from './WaterProgress';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WaterProgress', () => {
  it('is a progressbar with the real percentage and a name', () => {
    render(<WaterProgress value={66.4} label="Program" tilt={false} />);
    const bar = screen.getByRole('progressbar', { name: 'Program' });
    expect(bar.getAttribute('aria-valuenow')).toBe('66');
  });
  it('clamps the level to 0..100 and steps the colour', () => {
    expect(waterLevel(0)).toBe('low');
    expect(waterLevel(24.9)).toBe('low');
    expect(waterLevel(25)).toBe('warn');
    expect(waterLevel(49.9)).toBe('warn');
    expect(waterLevel(50)).toBe('mid');
    expect(waterLevel(74.9)).toBe('mid');
    expect(waterLevel(75)).toBe('high');
    render(<WaterProgress value={140} label="x" tilt={false} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByRole('progressbar').className).toContain('uiwater--high');
  });
  it('turns the water against the phone: the tilt goes into --wp-tilt', () => {
    render(<WaterProgress value={50} label="x" angle={30} />);
    expect(screen.getByRole('progressbar').style.getPropertyValue('--wp-tilt')).toBe('-30deg');
  });
  it('never asks for motion access on iOS (the prompt came back on every launch): the water stays level', async () => {
    const request = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal(
      'DeviceOrientationEvent',
      Object.assign(function () {}, { requestPermission: request }),
    );
    render(<WaterProgress value={50} label="x" />);
    await act(async () => {
      fireEvent.pointerUp(document.body);
    });
    expect(request).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 0, beta: -90 }));
    });
    expect(screen.getByRole('progressbar').style.getPropertyValue('--wp-tilt')).toBe('0deg');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
  it('follows the phone where no permission is needed (turned over = water at the top)', async () => {
    vi.stubGlobal('DeviceOrientationEvent', function () {});
    render(<WaterProgress value={50} label="x" />);
    await act(async () => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 0, beta: -90 }));
    });
    expect(screen.getByRole('progressbar').style.getPropertyValue('--wp-tilt')).toBe('-180deg');
  });
  it('turns the water with gravity: upright = bottom, turned over = top, flat = no direction', () => {
    expect(gravityAngle(0, 90)).toBeCloseTo(0);
    expect(Math.abs(gravityAngle(0, -90) ?? 0)).toBeCloseTo(Math.PI);
    expect(gravityAngle(0, 0)).toBeNull();
    // rolled a quarter turn in the screen plane (gamma 90, beta 0): gravity along the screen's side
    expect(Math.abs(gravityAngle(90, 0) ?? 0)).toBeCloseTo(Math.PI / 2);
  });
  it('draws the water on the canvas; 0 % is an empty tank', () => {
    const fill = vi.fn();
    const ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill,
      globalAlpha: 1,
      fillStyle: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const run = () => frames.splice(0).forEach((cb) => cb(16));
    const full = render(<WaterProgress value={40} label="x" tilt={false} />);
    run();
    expect(fill).toHaveBeenCalledTimes(2); // two wave layers
    full.unmount();
    frames.length = 0; // the first tank's next frame is gone with it
    fill.mockClear();
    render(<WaterProgress value={0} label="x" tilt={false} />);
    run();
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(fill).not.toHaveBeenCalled();
    // a level that only ROUNDS to 0 % (the number reads "0 %") is empty too, not a 12 % film
    frames.length = 0;
    render(<WaterProgress value={0.4} label="x" tilt={false} />);
    run();
    expect(fill).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('shows no permission button without a sensor', () => {
    render(<WaterProgress value={50} label="x" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
