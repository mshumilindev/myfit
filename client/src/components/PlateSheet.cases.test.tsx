import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { PlateSheet } from './PlateSheet';

afterEach(cleanup);

function mount(targetKg: number, initialUnit?: 'kg' | 'lb') {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <PlateSheet
      targetKg={targetKg}
      initialUnit={initialUnit}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  return { onApply, onClose };
}
const total = () => document.querySelector('.pl-total')!.textContent!.replace(/\s+/g, ' ').trim();

describe('PlateSheet · solve', () => {
  it('breaks 100 kg on a 20 kg bar into plates per side and applies it', async () => {
    const { onApply, onClose } = mount(100);
    expect(total()).toBe('100 kg');
    expect(document.querySelector('.pl-perside')!.textContent).toContain('Per side');
    expect(document.querySelector('.pl-perside')!.textContent).toContain('25');
    expect(document.querySelector('.pl-perside')!.textContent).toContain('15');
    expect(document.querySelector('.pl-closest')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Use 100 kg' }));
    expect(onApply).toHaveBeenCalledWith(100);
    expect(onClose).toHaveBeenCalled();
  });

  it('snaps an unloadable target to the closest weight below it and says so', () => {
    mount(61.3); // smallest step is 0.5 kg a side = 1 kg total
    expect(total()).toBe('61 kg');
    expect(document.querySelector('.pl-closest')!.textContent).toBe(
      'Closest loadable: 61 kg (−0.3)',
    );
  });

  it('shows "just the bar" for a target at or under the bar and uses 60 when none was given', () => {
    mount(0);
    expect(total()).toBe('60 kg');
    cleanup();
    mount(20);
    expect(document.querySelector('.pl-perside')!.textContent).toBe('Just the bar');
    expect(total()).toBe('20 kg');
  });

  it('re-solves when the target is typed, treating junk as zero', async () => {
    mount(100);
    const field = document.querySelector('.pl-target input') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '140' } });
    expect(total()).toBe('140 kg');
    fireEvent.change(field, { target: { value: '' } });
    expect(total()).toBe('20 kg');
  });

  it('collars take 2.5 kg a side off the plate budget', async () => {
    mount(100);
    await userEvent.click(screen.getByRole('button', { name: 'Collars' }));
    // 100 - 20 bar - 2*2.5 collars = 75 -> 37.5 a side
    expect(total()).toBe('100 kg');
    expect(document.querySelector('.pl-perside')!.textContent).toContain('25');
    await userEvent.click(screen.getByRole('button', { name: 'Collars' }));
    expect(document.querySelector('.pl-perside')!.textContent).toContain('15');
  });

  it('picks another bar weight', async () => {
    mount(100);
    await userEvent.click(screen.getByRole('button', { name: '15' }));
    expect(total()).toBe('100 kg');
    expect(document.querySelector('.pl-perside')!.textContent).toContain('25');
  });

  it('starts on pounds with a 45 lb bar and switches units back to kg with a 20 kg bar', async () => {
    mount(100, 'lb');
    expect(screen.getByRole('button', { name: '45 lb' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'kg' }));
    expect(screen.getByRole('button', { name: '20' })).toBeTruthy();
    expect(total()).toBe('100 kg');
  });
});

describe('PlateSheet · build', () => {
  const rackBtn = (d: string) =>
    [...document.querySelectorAll('.pl-rack-plate')].find((b) =>
      b.textContent!.startsWith(d),
    ) as HTMLElement;

  it('seeds the rack with the solved plates, then adds and removes plates by tap and context menu', async () => {
    const { onApply } = mount(100);
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(document.querySelector('.pl-target')).toBeNull();
    expect(total()).toBe('100 kg');
    // add a 1.25 plate: both sides -> +2.5 kg
    await userEvent.click(rackBtn('1.25'));
    expect(total()).toBe('102.5 kg');
    expect(rackBtn('1.25').querySelector('.pl-rack-count')!.textContent).toBe('1');
    fireEvent.contextMenu(rackBtn('1.25'));
    expect(total()).toBe('100 kg');
    // removing a plate that is not on the bar changes nothing
    fireEvent.contextMenu(rackBtn('0.5'));
    expect(total()).toBe('100 kg');
    await userEvent.click(screen.getByRole('button', { name: 'Use 100 kg' }));
    expect(onApply).toHaveBeenCalledWith(100);
  });

  it('keeps plates sorted heaviest first and clears back to the bar', async () => {
    mount(20);
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(document.querySelector('.pl-perside')!.textContent).toBe('Just the bar');
    await userEvent.click(rackBtn('5'));
    await userEvent.click(rackBtn('25'));
    const tags = within(document.querySelector('.pl-perside') as HTMLElement).getByText(/25/);
    expect(tags).toBeTruthy();
    expect(total()).toBe('80 kg');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(total()).toBe('20 kg');
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('groups equal plates as a count and does not re-seed once plates are chosen', async () => {
    mount(20);
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    await userEvent.click(rackBtn('10'));
    await userEvent.click(rackBtn('10'));
    expect(document.querySelector('.pl-perside')!.textContent).toContain('2×10');
    await userEvent.click(screen.getByRole('button', { name: 'Solve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(document.querySelector('.pl-perside')!.textContent).toContain('2×10');
  });

  it('switching unit empties the built stack', async () => {
    mount(20);
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    await userEvent.click(rackBtn('10'));
    await userEvent.click(screen.getByRole('button', { name: 'lb' }));
    expect(document.querySelector('.pl-perside')!.textContent).toBe('Just the bar');
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
