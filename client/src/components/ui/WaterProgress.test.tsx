import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WaterProgress, waterLevel } from './WaterProgress';

afterEach(cleanup);

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
  it('shows no permission button without a sensor', () => {
    render(<WaterProgress value={50} label="x" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
