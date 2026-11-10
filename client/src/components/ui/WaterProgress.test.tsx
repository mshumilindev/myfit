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
  it('asks for motion access on the first tap anywhere (iOS), then follows the phone (turned over = water at the top)', async () => {
    const request = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal(
      'DeviceOrientationEvent',
      Object.assign(function () {}, { requestPermission: request }),
    );
    render(<WaterProgress value={50} label="x" />);
    expect(request).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.pointerUp(document.body);
    });
    expect(request).toHaveBeenCalledTimes(1);
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
  it('shows no permission button without a sensor', () => {
    render(<WaterProgress value={50} label="x" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
