import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DeviceImage } from './DeviceImage';

afterEach(cleanup);

describe('DeviceImage', () => {
  it.each(['phone', 'tablet', 'computer', 'unknown'] as const)('draws %s', (kind) => {
    const { container } = render(<DeviceImage kind={kind} />);
    expect(container.querySelector(`svg[data-device]`)).toBeTruthy();
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
  it('falls back to the neutral question mark for a kind it does not know', () => {
    for (const kind of ['watch', undefined]) {
      const { container } = render(<DeviceImage kind={kind} />);
      expect(container.querySelector('svg')?.getAttribute('data-device')).toBe('device');
    }
    const { container } = render(<DeviceImage kind="fridge" />);
    expect(container.querySelector('svg')?.getAttribute('data-device')).toBe('device');
  });
  it('takes tone and size from the tile', () => {
    const { container } = render(<DeviceImage kind="phone" tone="ok" size={56} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('uit--ok');
    expect(el.style.getPropertyValue('--tile')).toBe('56px');
  });
});
