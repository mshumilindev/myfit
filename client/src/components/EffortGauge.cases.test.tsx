import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { EffortGauge } from './EffortGauge';

afterEach(cleanup);

type Lvl = 'light' | 'moderate' | 'hard';
const OPTIONS: { value: Lvl; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
];

function mount(value: Lvl, onChange = vi.fn()) {
  const r = render(
    <EffortGauge title="Effort" value={value} options={OPTIONS} onChange={onChange} />,
  );
  const svg = r.container.querySelector('svg') as SVGSVGElement;
  // jsdom has no layout: give the dial a 200x112 box at the origin so client px = viewBox units.
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 112, right: 200, bottom: 112, x: 0, y: 0 }) as DOMRect;
  (svg as unknown as { setPointerCapture: () => void }).setPointerCapture = vi.fn();
  return { ...r, svg, onChange };
}
const down = (svg: Element, x: number, y: number) =>
  fireEvent.pointerDown(svg, { clientX: x, clientY: y, pointerId: 1 });

describe('EffortGauge', () => {
  it.each([
    ['light', 'rotate(-90deg)', '100', '0', 'var(--color-ok)'],
    ['moderate', 'rotate(0deg)', '50', '1', 'var(--color-accent)'],
    ['hard', 'rotate(90deg)', '0', '1', 'var(--color-danger)'],
  ] as const)(
    'draws %s: needle, arc fill and level colour',
    (level, rot, offset, opacity, color) => {
      const { container } = mount(level);
      expect((container.querySelector('.eg-needle') as HTMLElement).style.transform).toBe(rot);
      const arc = container.querySelector('.eg-arc') as SVGElement;
      expect(arc.style.strokeDashoffset).toBe(offset);
      expect(arc.style.opacity).toBe(opacity);
      expect(
        (container.querySelector('.eg-card') as HTMLElement).style.getPropertyValue('--eff'),
      ).toBe(color);
      expect(container.querySelector('.eg-current')!.textContent).toBe(
        OPTIONS.find((o) => o.value === level)!.label,
      );
    },
  );

  it('exposes the dial as a slider with the current level as its text', () => {
    mount('hard');
    const slider = screen.getByRole('slider', { name: 'Effort' });
    expect(slider.getAttribute('aria-valuetext')).toBe('Hard');
  });

  it('falls back to the first level for a value outside the options', () => {
    const { container } = mount('nope' as Lvl);
    expect(container.querySelector('.eg-current')!.textContent).toBe('Light');
  });

  it('snaps a press on the dial to the nearest level: left, top, right', () => {
    const { svg, onChange } = mount('moderate');
    down(svg, 20, 100); // far left, level with the hub -> Light
    expect(onChange).toHaveBeenLastCalledWith('light');
    down(svg, 180, 100); // far right -> Hard
    expect(onChange).toHaveBeenLastCalledWith('hard');
    onChange.mockClear();
    down(svg, 100, 20); // straight up == the current level: nothing to report
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps a press below the hub to the nearer end', () => {
    const { svg, onChange } = mount('moderate');
    down(svg, 30, 110);
    expect(onChange).toHaveBeenLastCalledWith('light');
    down(svg, 170, 110);
    expect(onChange).toHaveBeenLastCalledWith('hard');
  });

  it('follows a drag only while a button is held', () => {
    const { svg, onChange } = mount('light');
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 20, buttons: 0 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 20, buttons: 1 });
    expect(onChange).toHaveBeenCalledWith('moderate');
  });

  it('also works from the Light / Moderate / Hard selector row', () => {
    const { onChange } = mount('light');
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    expect(onChange).toHaveBeenCalledWith('hard');
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
