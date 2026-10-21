import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RangeBar } from './RangeBar';

afterEach(cleanup);

const vars = (el: HTMLElement) => ({
  v: el.style.getPropertyValue('--uirange-v'),
  b0: el.style.getPropertyValue('--uirange-b0'),
  bw: el.style.getPropertyValue('--uirange-bw'),
});

describe('RangeBar', () => {
  it('is an image named by its label', () => {
    render(<RangeBar value={7} max={20} label="Chest 7 sets" />);
    const el = screen.getByRole('img', { name: 'Chest 7 sets' });
    expect(el.className).toContain('uirange');
    expect(el.className).toContain('uit--accent');
  });

  it('positions the fill and the band as percentages of max', () => {
    render(<RangeBar value={5} max={20} band={[10, 16]} label="x" />);
    const el = screen.getByRole('img');
    expect(vars(el)).toEqual({ v: '25%', b0: '50%', bw: '30%' });
    expect(el.querySelector('.uirange-band')).not.toBeNull();
    expect(el.querySelector('.uirange-fill')).not.toBeNull();
  });

  it('without a band there is no band element and zero width', () => {
    render(<RangeBar value={5} max={10} label="x" />);
    const el = screen.getByRole('img');
    expect(el.querySelector('.uirange-band')).toBeNull();
    expect(vars(el).bw).toBe('0%');
  });

  it('clamps the value to 0..100% and tolerates max 0', () => {
    const a = render(<RangeBar value={50} max={10} label="a" />);
    expect(vars(screen.getByRole('img')).v).toBe('100%');
    a.unmount();
    const b = render(<RangeBar value={-3} max={10} label="b" />);
    expect(vars(screen.getByRole('img')).v).toBe('0%');
    b.unmount();
    render(<RangeBar value={1} max={0} label="c" />);
    expect(vars(screen.getByRole('img')).v).toBe('100%');
  });

  it('maps tone, className and merges style', () => {
    render(
      <RangeBar value={1} max={2} tone="danger" className="x" style={{ margin: 3 }} label="x" />,
    );
    const el = screen.getByRole('img');
    expect(el.className).toContain('uit--danger');
    expect(el.className).toContain('x');
    expect(el.style.margin).toBe('3px');
    expect(vars(el).v).toBe('50%');
  });
});
